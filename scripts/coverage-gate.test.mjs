import test from "node:test";
import assert from "node:assert/strict";
import {
  checkComponents,
  parseMatrixEntries,
  testNameFor,
} from "./coverage-gate.mjs";

const base = {
  components: ["factorio", "pod-security/enforce-baseline", "redis"],
  testDirs: ["factorio", "pod-security-enforce-baseline"],
  matrixEntries: ["factorio", "pod-security-enforce-baseline"],
  allowlist: ["redis"],
};

test("a component with a test, a matrix entry, or an allowlist entry passes", () => {
  assert.deepEqual(checkComponents(base), []);
});

test("a nested component maps to the test name with a hyphen", () => {
  assert.equal(
    testNameFor("pod-security/enforce-baseline"),
    "pod-security-enforce-baseline",
  );
  assert.equal(testNameFor("factorio"), "factorio");
});

test("a test directory with a slash in its name does not satisfy a nested component", () => {
  const wrong = {
    ...base,
    testDirs: ["factorio", "pod-security/enforce-baseline"],
  };
  const errors = checkComponents(wrong);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /pod-security-enforce-baseline/);
});

test("a component with no test directory fails", () => {
  const errors = checkComponents({ ...base, testDirs: ["factorio"] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no test directory/);
  assert.match(errors[0], /pod-security-enforce-baseline/);
});

test("a component with no matrix entry fails", () => {
  const errors = checkComponents({ ...base, matrixEntries: ["factorio"] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no "pod-security-enforce-baseline" entry/);
});

test("an allowlist entry that has a test fails", () => {
  const errors = checkComponents({
    ...base,
    testDirs: [...base.testDirs, "redis"],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"redis" is on the allowlist but now has a test/);
});

test("an allowlist entry that has a matrix entry fails", () => {
  const errors = checkComponents({
    ...base,
    matrixEntries: [...base.matrixEntries, "redis"],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"redis" is on the allowlist/);
});

test("an allowlist entry for a missing component fails", () => {
  const errors = checkComponents({ ...base, allowlist: ["redis", "gone"] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"gone" is not a component/);
});

const workflow = `jobs:
  kustomization-test:
    strategy:
      matrix:
        kustomization-test:
          - factorio
          - pod-security-enforce-baseline
  lint:
    runs-on: ubuntu-latest
`;

test("the matrix parser reads the plain list and stops at the next key", () => {
  assert.deepEqual(parseMatrixEntries(workflow), [
    "factorio",
    "pod-security-enforce-baseline",
  ]);
});

test("the matrix parser rejects a missing key, an empty list, and a quoted item", () => {
  assert.throws(
    () => parseMatrixEntries("jobs: {}\n"),
    /No "matrix: kustomization-test:"/,
  );
  assert.throws(
    () =>
      parseMatrixEntries(
        "      matrix:\n        kustomization-test:\n  lint:\n",
      ),
    /empty/,
  );
  assert.throws(
    () =>
      parseMatrixEntries(
        '      matrix:\n        kustomization-test:\n          - "a"\n',
      ),
    /Cannot parse/,
  );
});
