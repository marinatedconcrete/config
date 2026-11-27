import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../.github/scripts/select-ci-checks.sh", import.meta.url),
);

test("a second push keeps the component selected until the branch merges", (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), "select-ci-checks-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=CI",
        "-c",
        "user.email=ci@example.org",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, encoding: "utf8" },
    ).trim();
  const commit = (message) => {
    git("add", ".");
    git("commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  const output = path.join(cwd, ".git", "output");
  function select(ref, before) {
    writeFileSync(output, "");
    execFileSync(script, [], {
      cwd,
      env: {
        ...process.env,
        BEFORE: before,
        DEFAULT_BRANCH: "main",
        GITHUB_REF: "refs/heads/" + ref,
        GITHUB_OUTPUT: output,
        KUSTOMIZATION_TESTS: "factorio\npaperless\n",
      },
    });
    return Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => {
          const [key, value] = line.split("=");
          return [key, JSON.parse(value)];
        }),
    );
  }
  git("init", "-q", "-b", "main");
  writeFileSync(path.join(cwd, "README.md"), "base\n");
  const base = commit("base");
  git("update-ref", "refs/remotes/origin/main", base);
  git("switch", "-qc", "feature");
  const component = path.join(cwd, "kustomization/components/paperless");
  mkdirSync(component, { recursive: true });
  writeFileSync(path.join(component, "deployment.yml"), "change\n");
  const first = commit("component");
  const expected = {
    build: false,
    matrix: ["factorio", "paperless"],
    components: ["paperless"],
  };
  assert.deepEqual(select("feature", base), expected);
  writeFileSync(path.join(cwd, "README.md"), "docs\n");
  commit("docs");
  assert.deepEqual(select("feature", first), expected);
  assert.deepEqual(select("main", first), { ...expected, components: [] });
  assert.deepEqual(select("main", "0".repeat(40)), {
    ...expected,
    build: true,
    components: expected.matrix,
  });
});
