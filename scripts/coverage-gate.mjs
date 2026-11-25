import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const COMPONENTS_DIR = "kustomization/components";
const TESTS_DIR = "kustomization/tests";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const MATRIX_KEY = "kustomization-test";

// A component path such as "pod-security/enforce-baseline" has the test name
// "pod-security-enforce-baseline". A top-level component has the same name.
export function testNameFor(componentPath) {
  return componentPath.split("/").join("-");
}

// Pure check. All inputs are plain values, so no file system is needed.
// components: component paths relative to the components directory.
// testDirs: test directory names. matrixEntries: names in the CI matrix.
// allowlist: names of components that have no test yet.
export function checkComponents({
  components,
  testDirs,
  matrixEntries,
  allowlist,
}) {
  const errors = [];
  const tests = new Set(testDirs);
  const matrix = new Set(matrixEntries);
  const allowed = new Set(allowlist);
  const known = new Set(components);

  for (const name of allowed) {
    if (!known.has(name)) {
      errors.push(
        `Allowlist entry "${name}" is not a component. Remove it from the allowlist.`,
      );
    }
  }
  for (const component of components) {
    const testName = testNameFor(component);
    const hasTest = tests.has(testName);
    const hasMatrix = matrix.has(testName);
    if (allowed.has(component)) {
      if (hasTest || hasMatrix) {
        errors.push(
          `Component "${component}" is on the allowlist but now has a test. Remove it from the allowlist.`,
        );
      }
      continue;
    }
    if (!hasTest) {
      errors.push(
        `Component "${component}" has no test directory "${TESTS_DIR}/${testName}".`,
      );
    }
    if (!hasMatrix) {
      errors.push(
        `Component "${component}" has no "${testName}" entry in the ${MATRIX_KEY} matrix of ${CI_WORKFLOW}.`,
      );
    }
  }
  return errors;
}

// Read the list under "matrix: kustomization-test:" in the CI file. The file must hold
// one plain list of unquoted names. Any other shape throws, so a change in the
// CI file never makes the check pass by accident.
export function parseMatrixEntries(workflowText) {
  const lines = workflowText.split("\n");
  const matrixIndex = lines.findIndex((line) => /^\s+matrix:\s*$/.test(line));
  const keyIndex = lines.findIndex(
    (line, index) =>
      index > matrixIndex && new RegExp(`^\\s+${MATRIX_KEY}:\\s*$`).test(line),
  );
  if (matrixIndex === -1 || keyIndex === -1) {
    throw new Error(`No "matrix: ${MATRIX_KEY}:" key in ${CI_WORKFLOW}.`);
  }
  const keyIndent = lines[keyIndex].search(/\S/);
  const entries = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") continue;
    if (line.search(/\S/) <= keyIndent) break;
    const match = line.match(/^\s+- ([A-Za-z0-9][A-Za-z0-9._-]*)\s*$/);
    if (!match) {
      throw new Error(
        `Cannot parse the matrix line "${line.trim()}" in ${CI_WORKFLOW}. Use one plain name for each list item.`,
      );
    }
    entries.push(match[1]);
  }
  if (entries.length === 0) {
    throw new Error(`The "${MATRIX_KEY}" matrix in ${CI_WORKFLOW} is empty.`);
  }
  return entries;
}

function listComponents(root) {
  const base = path.join(root, COMPONENTS_DIR);
  return readdirSync(base, { recursive: true })
    .map(String)
    .filter((entry) => path.basename(entry) === "kustomization.yml")
    .map((entry) => path.dirname(entry).split(path.sep).join("/"))
    .sort();
}

function listTestDirs(root) {
  const base = path.join(root, TESTS_DIR);
  return readdirSync(base, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(base, entry.name, "test.yml")),
    )
    .map((entry) => entry.name);
}

function nodeCoverageArgs(suite) {
  return [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include-all",
    ...suite.include.map((glob) => `--test-coverage-include=${glob}`),
    ...suite.exclude.map((glob) => `--test-coverage-exclude=${glob}`),
    `--test-coverage-lines=${suite.lines}`,
    `--test-coverage-branches=${suite.branches}`,
    `--test-coverage-functions=${suite.functions}`,
    ...suite.tests,
  ];
}

function runNodeSuite(root, suite) {
  console.log(`\n== Node coverage: ${suite.name} (${suite.directory})`);
  const result = spawnSync(process.execPath, nodeCoverageArgs(suite), {
    cwd: path.join(root, suite.directory),
    stdio: "inherit",
  });
  if (result.status === 0) return [];
  const why = result.error
    ? result.error.message
    : `exit code ${result.status}`;
  return [
    `Suite "${suite.name}" failed (${why}). A test failed or a coverage value is below ${JSON.stringify({ lines: suite.lines, branches: suite.branches, functions: suite.functions })}.`,
  ];
}

function main() {
  const thresholds = JSON.parse(
    readFileSync(path.join(repoRoot, ".coverage-thresholds.json"), "utf8"),
  );
  const errors = thresholds.node.flatMap((suite) =>
    runNodeSuite(repoRoot, suite),
  );

  console.log("\n== Component tests");
  try {
    errors.push(
      ...checkComponents({
        components: listComponents(repoRoot),
        testDirs: listTestDirs(repoRoot),
        matrixEntries: parseMatrixEntries(
          readFileSync(path.join(repoRoot, CI_WORKFLOW), "utf8"),
        ),
        allowlist: thresholds.components.allowlist.map((entry) => entry.name),
      }),
    );
  } catch (error) {
    errors.push(error.message);
  }

  if (errors.length > 0) {
    console.error("\nCoverage gate failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("\nCoverage gate passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
