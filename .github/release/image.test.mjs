import test from "node:test";
import assert from "node:assert/strict";
import { promoteImage } from "./image.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const other = `sha256:${"b".repeat(64)}`;
function registry(existing, denied = false) {
  const calls = [];
  const run = (_, args) => {
    calls.push(args);
    if (args[2] === "create") {
      existing = digest;
      return "";
    }
    if (args[3].includes("@")) return `Digest: ${digest}\n`;
    if (denied)
      throw Object.assign(new Error("Denied"), {
        stderr: Buffer.from("unauthorized"),
      });
    if (!existing)
      throw Object.assign(new Error("Missing"), {
        stderr: Buffer.from("manifest unknown"),
      });
    return `Digest: ${existing}\n`;
  };
  return { calls, run };
}

test("image promotion copies the digest without a rebuild or a new index", () => {
  const { calls, run } = registry();
  promoteImage("registry/example", "1.0.0", digest, run);
  assert.deepEqual(
    calls.find((args) => args[2] === "create"),
    [
      "buildx",
      "imagetools",
      "create",
      "--prefer-index=false",
      "--tag",
      "registry/example:1.0.0",
      `registry/example@${digest}`,
    ],
  );
});

test("identical image publication does not write the version tag", () => {
  const { calls, run } = registry(digest);
  promoteImage("registry/example", "1.0.0", digest, run);
  assert(calls.every((args) => args[2] === "inspect"));
});

test("conflicting image publication preserves the existing version tag", () => {
  const { calls, run } = registry(other);
  assert.throws(
    () => promoteImage("registry/example", "1.0.0", digest, run),
    /different digest/,
  );
  assert(calls.every((args) => args[2] === "inspect"));
});

test("registry authentication failure is not treated as a missing image", () => {
  const { calls, run } = registry(null, true);
  assert.throws(
    () => promoteImage("registry/example", "1.0.0", digest, run),
    /Denied/,
  );
  assert(calls.every((args) => args[2] === "inspect"));
});
