import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./publish-badge.sh", import.meta.url));
const root = fileURLToPath(new URL("..", import.meta.url));
const names = ["coverage.json", "node-coverage.json", "shell-coverage.json"];
const badge = (name) =>
  `{"schemaVersion":1,"label":"${name}","message":"77.7%"}\n`;

const fakeGh = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$LOG"
case "$*" in
  *"git/ref/heads/main"*)
    if [[ -e "$LOG.main-read" ]]; then echo "$MAIN_SHA_AFTER_FIRST_READ"; else echo "$MAIN_SHA"; fi
    touch "$LOG.main-read" ;;
  *"git/ref/heads/badges"*) [[ "$BRANCH" == yes ]] && echo parentsha || exit 1 ;;
  *"git/commits/parentsha"*) echo basetreesha ;;
  *"Accept: application/vnd.github.raw+json"*)
    [[ "$*" =~ contents/([^?]+)[?]ref=parentsha$ ]] && cat "$CURRENT/\${BASH_REMATCH[1]}" 2>/dev/null || exit 1 ;;
  *"-X POST repos/o/r/git/trees"*)
    jq -c . >> "$LOG.trees"; [[ "$FAIL" == trees ]] && exit 1; echo treesha ;;
  *"-X POST repos/o/r/git/commits"*)
    jq -c . >> "$LOG.commits"; [[ "$FAIL" == commits ]] && exit 1; echo commitsha ;;
  *"-X PATCH"*)
    if [[ "$FAIL" == patch ]]; then echo "Update is not a fast forward" >&2; exit 1; fi ;;
esac
`;

function readJsonLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function setup({
  branch,
  current = {},
  fail = "",
  mainSha,
  mainShaAfterFirstRead,
}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "publish-badge-"));
  writeFileSync(path.join(dir, "gh"), fakeGh);
  chmodSync(path.join(dir, "gh"), 0o755);
  const badges = path.join(dir, "badges");
  mkdirSync(badges);
  for (const name of names) writeFileSync(path.join(badges, name), badge(name));
  const currentDir = path.join(dir, "current");
  mkdirSync(currentDir);
  for (const [name, text] of Object.entries(current)) {
    writeFileSync(path.join(currentDir, name), text);
  }
  const log = path.join(dir, "log");
  writeFileSync(log, "");
  const env = {
    PATH: `${dir}:${process.env.PATH}`,
    GH_REPO: "o/r",
    LOG: log,
    BRANCH: branch,
    CURRENT: currentDir,
    FAIL: fail,
    MAIN_SHA: mainSha,
    MAIN_SHA_AFTER_FIRST_READ: mainShaAfterFirstRead,
    EXPECTED_SHA: "run1",
  };
  const result = (spawned) => ({
    ...spawned,
    calls: readFileSync(log, "utf8").split("\n").filter(Boolean),
    trees: readJsonLines(`${log}.trees`),
    commits: readJsonLines(`${log}.commits`),
  });
  return { dir, badges, env, result };
}

function publish({ branch, current, fail, mainSha = "run1" }) {
  const { badges, env, result } = setup({
    branch,
    current,
    fail,
    mainSha,
    mainShaAfterFirstRead: mainSha,
  });
  const files = names.map((name) => path.join(badges, name));
  return result(
    spawnSync("bash", [script, ...files], { encoding: "utf8", env }),
  );
}

const entry = (name) => ({
  path: name,
  mode: "100644",
  type: "blob",
  content: badge(name),
});
const writes = (calls) => calls.filter((call) => call.includes(" -X "));

test("a missing branch gets one commit with no parent and all files, then the branch", () => {
  const result = publish({ branch: "no" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call.split(" ").slice(0, 4).join(" ")),
    [
      "api repos/o/r/git/ref/heads/badges --jq .object.sha",
      "api repos/o/r/git/ref/heads/main --jq .object.sha",
      "api -X POST repos/o/r/git/trees",
      "api -X POST repos/o/r/git/commits",
      "api -X POST repos/o/r/git/refs",
    ],
  );
  assert.deepEqual(result.trees, [{ tree: names.map(entry) }]);
  assert.equal(result.commits.length, 1);
  assert.equal(result.commits[0].tree, "treesha");
  assert.equal("parents" in result.commits[0], false);
  assert.match(result.calls.at(-1), /ref=refs\/heads\/badges -f sha=commitsha/);
});

test("an existing branch gets one commit with all changed files and a fast-forward update", () => {
  const result = publish({ branch: "yes" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.trees, [
    { base_tree: "basetreesha", tree: names.map(entry) },
  ]);
  assert.equal(result.commits.length, 1);
  assert.equal(result.commits[0].tree, "treesha");
  assert.deepEqual(result.commits[0].parents, ["parentsha"]);
  assert.deepEqual(writes(result.calls).slice(-1), [
    "api -X PATCH repos/o/r/git/refs/heads/badges -f sha=commitsha -F force=false",
  ]);
  assert.equal(
    result.calls.some((call) => call.includes("-X PUT")),
    false,
  );
});

test("only the changed files go in the tree", () => {
  const result = publish({
    branch: "yes",
    current: {
      "coverage.json": badge("coverage.json"),
      "node-coverage.json": '{"message":"old"}',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.trees, [
    {
      base_tree: "basetreesha",
      tree: [entry("node-coverage.json"), entry("shell-coverage.json")],
    },
  ]);
  assert.equal(result.commits.length, 1);
});

test("a set of badges that did not change makes no write", () => {
  const current = Object.fromEntries(names.map((name) => [name, badge(name)]));
  const result = publish({ branch: "yes", current });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(writes(result.calls), []);
  assert.match(result.stdout, /No commit/);
});

test("a ref update that is not a fast-forward fails the script", () => {
  const result = publish({ branch: "yes", fail: "patch" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a fast forward/);
  assert.deepEqual(
    writes(result.calls).map((call) => call.split(" ").slice(0, 3).join(" ")),
    ["api -X POST", "api -X POST", "api -X PATCH"],
  );
  assert.equal(result.commits.length, 1);
});

test("a failed call stops the script before it makes a commit or the branch", () => {
  for (const branch of ["no", "yes"]) {
    for (const fail of ["trees", "commits"]) {
      const result = publish({ branch, fail });
      assert.notEqual(result.status, 0, `${branch} ${fail}`);
      assert.equal(
        result.calls.some((call) => call.includes("git/refs")),
        false,
        `${branch} ${fail}`,
      );
    }
  }
});

test("a run for an older commit writes nothing", () => {
  for (const branch of ["no", "yes"]) {
    const result = publish({ branch, mainSha: "run2" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /run2.*run1.*No write/);
    assert.deepEqual(writes(result.calls), []);
  }
});

test("the workflow publishes a complete set when main moves after the head check", () => {
  const workflow = readFileSync(
    path.join(root, ".github/workflows/coverage-gate.yml"),
    "utf8",
  );
  const step = workflow.split("- name: Publish Coverage Badges")[1];
  const run = step.split(/\n {8}run: \|\n/)[1].split(/\n(?! {10})/)[0];
  for (const branch of ["no", "yes"]) {
    const { dir, env, result } = setup({
      branch,
      mainSha: "run1",
      mainShaAfterFirstRead: "run2",
    });
    const published = result(
      spawnSync("bash", ["-e", "-c", run], {
        cwd: root,
        encoding: "utf8",
        env: { ...env, RUNNER_TEMP: dir },
      }),
    );
    assert.equal(published.status, 0, published.stderr);
    assert.equal(published.commits.length, 1, branch);
    assert.deepEqual(
      published.trees.map(({ tree }) => tree.map(({ path }) => path)),
      [names],
      branch,
    );
  }
});

test("the script needs EXPECTED_SHA", () => {
  const result = spawnSync("bash", [script, "x"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, GH_REPO: "o/r" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EXPECTED_SHA/);
});

test("the script needs a file and GH_REPO", () => {
  const noFile = spawnSync("bash", [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, GH_REPO: "o/r", EXPECTED_SHA: "x" },
  });
  assert.notEqual(noFile.status, 0);
  assert.match(noFile.stderr, /Usage/);
  const noRepo = spawnSync("bash", [script, "x"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, EXPECTED_SHA: "x" },
  });
  assert.notEqual(noRepo.status, 0);
  assert.match(noRepo.stderr, /GH_REPO/);
});

test("a bad file name stops the script before any gh call", () => {
  for (const name of [
    "coverage",
    "Coverage.json",
    "coverage.json.txt",
    ".json",
    "cov_erage.json",
  ]) {
    const { badges, env, result } = setup({ branch: "no", mainSha: "run1" });
    writeFileSync(path.join(badges, name), badge(name));
    const files = [path.join(badges, "coverage.json"), path.join(badges, name)];
    const published = result(
      spawnSync("bash", [script, ...files], { encoding: "utf8", env }),
    );
    assert.equal(published.status, 2, `${name}: ${published.stderr}`);
    assert.deepEqual(published.calls, [], name);
    assert.match(
      published.stderr,
      /must have only lowercase letters, digits, and hyphens/,
    );
  }
});
