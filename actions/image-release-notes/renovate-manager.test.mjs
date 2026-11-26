import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// These tests apply the regex manager of renovate.json to release-notes.sh
// with the JavaScript regular expression engine. Renovate uses the RE2 engine.
// Renovate matches a pattern against the whole file, so ^ and $ match only at
// the start and the end of the file. The test sets no multiline flag.
// The pattern uses no feature that differs, but this test does not run
// Renovate.

const here = dirname(fileURLToPath(import.meta.url));
const repository = join(here, "..", "..");
const scriptRelativePath = "actions/image-release-notes/release-notes.sh";
// RELEASE_NOTES_SCRIPT lets a reviewer run the tests on a changed copy.
const scriptText = readFileSync(
  process.env.RELEASE_NOTES_SCRIPT ?? join(repository, scriptRelativePath),
  "utf8",
);

const config = JSON.parse(
  readFileSync(join(repository, "renovate.json"), "utf8"),
);

// Renovate writes a file pattern as "/pattern/" in a string. A string without
// the slashes is a glob, which this test does not support.
function toRegExp(text) {
  const match = /^\/(.*)\/$/s.exec(text);
  assert.ok(match, `not a /regex/ string: ${text}`);
  return new RegExp(match[1]);
}

const manager = config.customManagers.find((candidate) =>
  candidate.managerFilePatterns?.some((pattern) =>
    toRegExp(pattern).test(scriptRelativePath),
  ),
);

function dependencies(text) {
  return manager.matchStrings.flatMap((matchString) =>
    [...text.matchAll(new RegExp(matchString, "g"))].map(
      (match) => match.groups,
    ),
  );
}

test("a regex manager selects release-notes.sh", () => {
  assert.ok(manager, `no manager has a file pattern for ${scriptRelativePath}`);
});

test("the regex manager finds the Syft and CycloneDX CLI images", () => {
  const found = dependencies(scriptText).map(
    ({ datasource, depName, currentValue, currentDigest }) => ({
      datasource,
      depName,
      currentValue,
      hasDigest: /^sha256:[a-f0-9]{64}$/.test(currentDigest),
    }),
  );
  const line = (name) =>
    scriptText.match(new RegExp(`^${name}=".*:([^:@]+)@sha256:`, "m"))[1];
  assert.deepEqual(found, [
    {
      datasource: "docker",
      depName: "anchore/syft",
      currentValue: line("SYFT_IMAGE"),
      hasDigest: true,
    },
    {
      datasource: "docker",
      depName: "cyclonedx/cyclonedx-cli",
      currentValue: line("CYCLONEDX_IMAGE"),
      hasDigest: true,
    },
  ]);
});

test("the regex manager does not find a renamed variable", () => {
  const renamed = scriptText.replaceAll("SYFT_IMAGE", "SYFT_REF");
  assert.deepEqual(
    dependencies(renamed).map((found) => found.depName),
    ["cyclonedx/cyclonedx-cli"],
  );
});

test("the regex manager does not find a line without the comment", () => {
  const stripped = scriptText.replace(/^# renovate: .*anchore\/syft\n/m, "");
  assert.deepEqual(
    dependencies(stripped).map((found) => found.depName),
    ["cyclonedx/cyclonedx-cli"],
  );
});
