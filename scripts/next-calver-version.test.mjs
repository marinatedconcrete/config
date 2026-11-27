import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../.github/scripts/next-calver-version.sh", import.meta.url),
);
const prefix = "devcontainer-base-2026.11";

function nextVersion(input) {
  return execFileSync("bash", [script, prefix], { input, encoding: "utf8" });
}

test("an empty tag list starts at zero", () => {
  assert.equal(nextVersion(""), "2026.11.0\n");
});

test("tag numbers are compared numerically across digit lengths", () => {
  assert.equal(
    nextVersion(`${prefix}.9\n${prefix}.10\n${prefix}.2\n`),
    "2026.11.11\n",
  );
});

test("a leading zero does not change the tag number", () => {
  assert.equal(nextVersion(`${prefix}.008\n`), "2026.11.9\n");
});

test("tags with a different prefix are ignored", () => {
  assert.equal(
    nextVersion(`${prefix}.2\nother-image-2026.11.99\n`),
    "2026.11.3\n",
  );
});

test("the last tag is read without a trailing newline", () => {
  assert.equal(nextVersion(`${prefix}.2\n${prefix}.5`), "2026.11.6\n");
});

test("a missing prefix fails with a usage message", () => {
  const result = spawnSync("bash", [script], { input: "", encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /usage: .*next-calver-version\.sh <name-YYYY\.M>/,
  );
});
