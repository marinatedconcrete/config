import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// These tests run .github/scripts/next-calver-version.sh with bash.
// The script reads tag names on standard input and prints the next CalVer
// version for the tag prefix in $1. The devcontainer-base workflow reserves
// the release version number with this script.

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(
  here,
  "..",
  ".github",
  "scripts",
  "next-calver-version.sh",
);

function nextVersion(tags, prefix) {
  return spawnSync("bash", [scriptPath, prefix], {
    input: tags.map((tag) => `${tag}\n`).join(""),
    encoding: "utf8",
  });
}

test("an empty tag list gives the first version of the prefix", () => {
  const result = nextVersion([], "devcontainer-base-2026.11");
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "2026.11.0\n");
});

test("a tag number above 9 orders by value, not by string", () => {
  const result = nextVersion(
    ["devcontainer-base-2026.11.9", "devcontainer-base-2026.11.1"],
    "devcontainer-base-2026.11",
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "2026.11.10\n");
});

test("a leading zero does not change the tag number", () => {
  const result = nextVersion(
    ["devcontainer-base-2026.11.007"],
    "devcontainer-base-2026.11",
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "2026.11.8\n");
});

test("a tag with a different prefix does not change the result", () => {
  const result = nextVersion(
    ["other-image-2026.11.3", "devcontainer-base-2026.11.1"],
    "devcontainer-base-2026.11",
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "2026.11.2\n");
});

test("a tag name without a final newline is read", () => {
  const result = spawnSync("bash", [scriptPath, "devcontainer-base-2026.11"], {
    input: "devcontainer-base-2026.11.5",
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "2026.11.6\n");
});

test("a missing prefix argument fails with a usage message", () => {
  const result = spawnSync("bash", [scriptPath], {
    input: "devcontainer-base-2026.11.1\n",
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage/);
  assert.equal(result.stdout, "");
});
