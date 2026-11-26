import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./publish-badge.sh", import.meta.url));
const badge =
  '{"schemaVersion":1,"label":"node coverage","message":"77.7%","color":"yellow"}\n';

// The fake gh logs each call. It answers by the route of the call.
const fakeGh = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$LOG"
case "$*" in
  *"git/ref/heads/badges"*) [[ "$BRANCH" == yes ]] && exit 0 || exit 1 ;;
  *"Accept: application/vnd.github.raw+json"*) printf '%s' "$CURRENT" ;;
  *"contents/coverage.json?ref=badges --jq .sha"*) echo oldsha ;;
  *"git/blobs"*) [[ "$FAIL" == blobs ]] && exit 1; echo blobsha ;;
  *"git/trees"*) cat > "$LOG.tree"; echo treesha ;;
  *"git/commits"*) echo commitsha ;;
esac
`;

function publish({ branch, current = "", fail = "" }) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "publish-badge-"));
  writeFileSync(path.join(dir, "gh"), fakeGh);
  chmodSync(path.join(dir, "gh"), 0o755);
  const file = path.join(dir, "badge.json");
  writeFileSync(file, badge);
  const log = path.join(dir, "log");
  writeFileSync(log, "");
  const result = spawnSync("bash", [script, file], {
    encoding: "utf8",
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      GH_REPO: "o/r",
      LOG: log,
      BRANCH: branch,
      CURRENT: current,
      FAIL: fail,
    },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
  const tree = (() => {
    try {
      return JSON.parse(readFileSync(`${log}.tree`, "utf8"));
    } catch {
      return null;
    }
  })();
  return { ...result, calls, tree };
}

test("a missing branch gets a commit with no parent, then the branch", () => {
  const result = publish({ branch: "no" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call.split(" ").slice(0, 4).join(" ")),
    [
      "api repos/o/r/git/ref/heads/badges",
      "api -X POST repos/o/r/git/blobs",
      "api -X POST repos/o/r/git/trees",
      "api -X POST repos/o/r/git/commits",
      "api -X POST repos/o/r/git/refs",
    ],
  );
  assert.deepEqual(result.tree, {
    tree: [
      { path: "coverage.json", mode: "100644", type: "blob", sha: "blobsha" },
    ],
  });
  const commit = result.calls.find((call) => call.includes("git/commits"));
  assert.equal(commit.includes("parents"), false);
  assert.match(result.calls.at(-1), /ref=refs\/heads\/badges -f sha=commitsha/);
});

test("an existing branch gets one update with the old file sha", () => {
  const result = publish({ branch: "yes", current: '{"message":"old"}' });
  assert.equal(result.status, 0, result.stderr);
  const put = result.calls.find((call) => call.includes("-X PUT"));
  assert.ok(put.includes("repos/o/r/contents/coverage.json"));
  assert.ok(put.includes("branch=badges"));
  assert.ok(put.includes("sha=oldsha"));
  assert.ok(put.includes(`content=${Buffer.from(badge).toString("base64")}`));
  assert.equal(
    result.calls.some((call) => call.includes("git/refs")),
    false,
  );
});

test("a badge that did not change makes no write", () => {
  const result = publish({ branch: "yes", current: badge });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.calls.some((call) => call.includes("-X")),
    false,
  );
  assert.match(result.stdout, /No commit/);
});

test("a failed call stops the script before it makes the branch", () => {
  const result = publish({ branch: "no", fail: "blobs" });
  assert.notEqual(result.status, 0);
  assert.equal(
    result.calls.some((call) => call.includes("git/refs")),
    false,
  );
});

test("the script needs a file and GH_REPO", () => {
  const noFile = spawnSync("bash", [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, GH_REPO: "o/r" },
  });
  assert.notEqual(noFile.status, 0);
  assert.match(noFile.stderr, /Usage/);
  const noRepo = spawnSync("bash", [script, "x"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  assert.notEqual(noRepo.status, 0);
  assert.match(noRepo.stderr, /GH_REPO/);
});
