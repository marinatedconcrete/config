import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addCounts,
  checkComponents,
  badgeFiles,
  checkShellCoverage,
  coverageBadge,
  formatShellReport,
  kcovWrapper,
  parseKcovReport,
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
  assert.deepEqual(coverageBadge("node coverage", { found: 512, hit: 398 }), {
    schemaVersion: 1,
    label: "node coverage",
    message: "77.7%",
    color: "yellow",
  });
});

test("the badge color changes at 80 and 60 percent", () => {
  assert.equal(
    coverageBadge("node coverage", { found: 100, hit: 80 }).color,
    "brightgreen",
  );
  assert.equal(
    coverageBadge("node coverage", { found: 100, hit: 79 }).color,
    "yellow",
  );
  assert.equal(
    coverageBadge("node coverage", { found: 100, hit: 60 }).color,
    "yellow",
  );
  assert.equal(
    coverageBadge("node coverage", { found: 100, hit: 59 }).color,
    "red",
  );
});

test("the badge takes its label from the caller", () => {
  assert.equal(
    coverageBadge("shell coverage", { found: 10, hit: 5 }).label,
    "shell coverage",
  );
});

test("coverage.json counts the Node and shell lines as one total", () => {
  const badges = badgeFiles({
    node: { found: 100, hit: 85 },
    shell: { found: 517, hit: 330 },
  });
  assert.deepEqual(Object.keys(badges).sort(), [
    "coverage.json",
    "node-coverage.json",
    "shell-coverage.json",
  ]);
  assert.deepEqual(badges["coverage.json"], {
    schemaVersion: 1,
    label: "coverage",
    message: "67.3%",
    color: "yellow",
  });
  assert.equal(badges["node-coverage.json"].label, "node coverage");
  assert.equal(badges["node-coverage.json"].message, "85.0%");
  assert.equal(badges["shell-coverage.json"].label, "shell coverage");
  assert.equal(badges["shell-coverage.json"].message, "63.8%");
});

test("the coverage.json color comes from the combined lines", () => {
  const badges = badgeFiles({
    node: { found: 100, hit: 90 },
    shell: { found: 100, hit: 10 },
  });
  assert.equal(badges["node-coverage.json"].color, "brightgreen");
  assert.equal(badges["shell-coverage.json"].color, "red");
  assert.equal(badges["coverage.json"].message, "50.0%");
  assert.equal(badges["coverage.json"].color, "red");
});

test("the badge refuses a report with no line", () => {
  assert.throws(
    () => coverageBadge("node coverage", { found: 0, hit: 0 }),
    /no line/,
  );
  assert.throws(
    () => coverageBadge("node coverage", { found: Number.NaN, hit: 0 }),
    /no line/,
  );
});

const floors = {
  "actions/image-release-notes/release-notes.sh": 266,
  "scripts/publish-badge.sh": 27,
};
const shellFiles = [
  {
    path: "actions/image-release-notes/release-notes.sh",
    found: 281,
    hit: 208,
  },
  { path: "scripts/publish-badge.sh", found: 29, hit: 28 },
];

test("kcov report: each file gets a relative path and its line counts", () => {
  const report = JSON.stringify({
    files: [
      { file: "/r/scripts/b.sh", covered_lines: "28", total_lines: "29" },
      { file: "/r/a.sh", covered_lines: 3, total_lines: 4 },
    ],
  });
  assert.deepEqual(parseKcovReport(report, "/r"), [
    { path: "a.sh", found: 4, hit: 3 },
    { path: "scripts/b.sh", found: 29, hit: 28 },
  ]);
});

test("kcov report: a report with no file list, a bad count, or a file outside the root throws", () => {
  assert.throws(() => parseKcovReport("{}", "/r"), /no "files" list/);
  assert.throws(
    () =>
      parseKcovReport(
        JSON.stringify({
          files: [{ file: "/r/a.sh", covered_lines: "x", total_lines: 4 }],
        }),
        "/r",
      ),
    /no path or no line counts/,
  );
  assert.throws(
    () =>
      parseKcovReport(
        JSON.stringify({
          files: [{ file: "/other/a.sh", covered_lines: 1, total_lines: 4 }],
        }),
        "/r",
      ),
    /not in "\/r"/,
  );
  assert.throws(
    () =>
      parseKcovReport(
        JSON.stringify({
          files: [{ file: "/rr/a.sh", covered_lines: 1, total_lines: 4 }],
        }),
        "/r",
      ),
    /not in "\/r"/,
  );
});

test("shell check: a total at the minimum and files at their floors pass", () => {
  const files = [
    {
      path: "actions/image-release-notes/release-notes.sh",
      found: 266,
      hit: 133,
    },
    { path: "scripts/publish-badge.sh", found: 34, hit: 17 },
  ];
  assert.deepEqual(
    checkShellCoverage({ files, lines: 50, minFoundLines: floors }),
    [],
  );
});

test("shell check: a minimum or a floor that is not a number fails", () => {
  const errors = checkShellCoverage({
    files: [{ path: "a.sh", found: 10, hit: 0 }],
    lines: "63%",
    minFoundLines: { "a.sh": null },
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /"shell.lines" must be a number/);
  assert.match(errors[1], /"a.sh" must be a whole number/);
  assert.equal(
    checkShellCoverage({
      files: [{ path: "a.sh", found: 10, hit: 0 }],
      lines: undefined,
      minFoundLines: { "a.sh": 1 },
    }).length,
    1,
  );
});

test("shell check: a total below the minimum fails and names both numbers", () => {
  const errors = checkShellCoverage({
    files: shellFiles,
    lines: 90,
    minFoundLines: floors,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /76\.1%/);
  assert.match(errors[0], /minimum is 90%/);
});

test("shell check: a script below its floor fails and names the script and the kcov bug", () => {
  const errors = checkShellCoverage({
    files: [{ ...shellFiles[0], found: 162, hit: 125 }, shellFiles[1]],
    lines: 50,
    minFoundLines: floors,
  });
  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /found 162 lines in "actions\/image-release-notes\/release-notes\.sh"/,
  );
  assert.match(errors[0], /floor is 266/);
  assert.match(errors[0], /kcov#519/);
});

test("shell check: a script with no floor fails, and a floor with no script fails", () => {
  const errors = checkShellCoverage({
    files: [...shellFiles, { path: "scripts/new.sh", found: 5, hit: 5 }],
    lines: 50,
    minFoundLines: { ...floors, "scripts/gone.sh": 4 },
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /measured "scripts\/new\.sh".*no entry/);
  assert.match(errors[1], /entry for "scripts\/gone\.sh".*did not measure/);
});

test("shell check: an empty report fails with no division by zero", () => {
  const errors = checkShellCoverage({
    files: [],
    lines: 50,
    minFoundLines: {},
  });
  assert.deepEqual(errors, ["The kcov report has no line."]);
});

test("shell report: one line for each script and one for the total", () => {
  assert.equal(
    formatShellReport({ files: shellFiles, lines: 63, minFoundLines: floors }),
    [
      "actions/image-release-notes/release-notes.sh: 208 of 281 lines (74.0%). Floor: 266.",
      "scripts/publish-badge.sh: 28 of 29 lines (96.6%). Floor: 27.",
      "Total: 236 of 310 lines (76.1%). Minimum: 63%.",
    ].join("\n"),
  );
});

test("addCounts adds the found and hit counts of each part", () => {
  assert.deepEqual(
    addCounts([
      { found: 4, hit: 1 },
      { found: 6, hit: 5, path: "x" },
    ]),
    { found: 10, hit: 6 },
  );
  assert.deepEqual(addCounts([]), { found: 0, hit: 0 });
});

const REAL_BASH = existsSync("/usr/bin/bash") ? "/usr/bin/bash" : "/bin/bash";

function runWrapper({ rootName = "repo", args, env = {} }) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kcov-wrapper-"));
  const root = path.join(dir, rootName);
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  const log = path.join(dir, "kcov.log");
  const fakeKcov = path.join(dir, "kcov");
  writeFileSync(
    fakeKcov,
    `#!${REAL_BASH}\nprintf '%s\\n' "$@" > ${JSON.stringify(log)}\nprintf '%s' "\${KCOV_WRAP_ACTIVE:-}" > ${JSON.stringify(`${log}.env`)}\nexit 7\n`,
  );
  chmodSync(fakeKcov, 0o755);
  const plain = path.join(root, "scripts", "plain.sh");
  writeFileSync(plain, '#!/usr/bin/env bash\necho ran-plain "$1"\nexit 3\n');
  const wrapper = path.join(dir, "bash");
  writeFileSync(
    wrapper,
    kcovWrapper({
      bash: REAL_BASH,
      kcov: fakeKcov,
      root,
      includePaths: [path.join(root, "scripts"), path.join(root, "other")],
      runsDir: path.join(dir, "runs dir"),
    }),
  );
  chmodSync(wrapper, 0o755);
  const result = spawnSync(wrapper, args(root, dir), {
    encoding: "utf8",
    env: { PATH: dir, ...env },
  });
  const logged = existsSync(log)
    ? readFileSync(log, "utf8").split("\n").filter(Boolean)
    : null;
  const wrapActive = existsSync(`${log}.env`)
    ? readFileSync(`${log}.env`, "utf8")
    : null;
  rmSync(dir, { recursive: true, force: true });
  return { ...result, logged, wrapActive, root, dir };
}

test("wrapper: with only PATH in the environment, a script of the repository runs under kcov with the include paths", () => {
  const result = runWrapper({
    args: (root) => [path.join(root, "scripts", "plain.sh"), "one"],
  });
  assert.equal(result.status, 7);
  assert.equal(result.wrapActive, "1", "kcov gets KCOV_WRAP_ACTIVE=1");
  assert.equal(
    result.logged[0],
    `--include-path=${path.join(result.root, "scripts")},${path.join(result.root, "other")}`,
  );
  assert.deepEqual(result.logged.slice(1, 3), [
    "--include-pattern=.sh",
    "--exclude-pattern=.test.sh",
  ]);
  assert.match(result.logged[3], /^.*\/runs dir\/run-\d+-\d+$/);
  assert.deepEqual(result.logged.slice(4), [
    path.join(result.root, "scripts", "plain.sh"),
    "one",
  ]);
});

test("wrapper: a call to a test script, an outside script, a command string, or a nested call runs the real bash", () => {
  const cases = [
    (root) => [path.join(root, "scripts", "plain.test.sh")],
    (root, dir) => [path.join(dir, "outside.sh")],
    () => ["-c", "echo ran-command"],
  ];
  for (const args of cases) {
    const result = runWrapper({
      args: (root, dir) => {
        writeFileSync(
          path.join(root, "scripts", "plain.test.sh"),
          "echo ran-test\n",
        );
        writeFileSync(path.join(dir, "outside.sh"), "echo ran-outside\n");
        return args(root, dir);
      },
    });
    assert.equal(result.logged, null);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ran-(test|outside|command)\n$/);
  }
  const nested = runWrapper({
    args: (root) => [path.join(root, "scripts", "plain.sh"), "two"],
    env: { KCOV_WRAP_ACTIVE: "1" },
  });
  assert.equal(nested.logged, null);
  assert.equal(nested.status, 3);
  assert.equal(nested.stdout, "ran-plain two\n");
});

test("wrapper: a root path with a space and a quote still matches", () => {
  const result = runWrapper({
    rootName: "my 'repo",
    args: (root) => [path.join(root, "scripts", "plain.sh")],
  });
  assert.equal(result.status, 7);
  assert.equal(
    result.logged.at(-1),
    path.join(result.root, "scripts", "plain.sh"),
  );
});
