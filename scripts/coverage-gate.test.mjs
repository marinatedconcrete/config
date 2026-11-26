import test from "node:test";
import assert from "node:assert/strict";
import {
  checkComponents,
  coverageBadge,
  parseMatrixEntries,
  sumLcov,
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

test("sumLcov adds the LF and LH lines of every file", () => {
  const report =
    "TN:\nSF:a.mjs\nLF:10\nLH:7\nend_of_record\nSF:b.mjs\nLF:5\nLH:5\nend_of_record\n";
  assert.deepEqual(sumLcov(report), { found: 15, hit: 12 });
  assert.deepEqual(sumLcov(""), { found: 0, hit: 0 });
});

test("sumLcov ignores the FNF, FNH, BRF, and BRH lines", () => {
  assert.deepEqual(sumLcov("FNF:9\nFNH:9\nBRF:8\nBRH:8\nLF:4\nLH:1\n"), {
    found: 4,
    hit: 1,
  });
});

test("the badge has the shields endpoint format with one decimal", () => {
  assert.deepEqual(coverageBadge({ found: 512, hit: 398 }), {
    schemaVersion: 1,
    label: "node coverage",
    message: "77.7%",
    color: "yellow",
  });
});

test("the badge color changes at 80 and 60 percent", () => {
  assert.equal(coverageBadge({ found: 100, hit: 80 }).color, "brightgreen");
  assert.equal(coverageBadge({ found: 100, hit: 79 }).color, "yellow");
  assert.equal(coverageBadge({ found: 100, hit: 60 }).color, "yellow");
  assert.equal(coverageBadge({ found: 100, hit: 59 }).color, "red");
});

test("the badge refuses a report with no line", () => {
  assert.throws(() => coverageBadge({ found: 0, hit: 0 }), /no line/);
  assert.throws(() => coverageBadge({ found: Number.NaN, hit: 0 }), /no line/);
});
