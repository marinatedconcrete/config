import { spawnSync } from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
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

// Add up the found and hit lines of an lcov report. Each file of the report has one LF and one LH line.
export function sumLcov(text) {
  let found = 0;
  let hit = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("LF:")) found += Number(line.slice(3));
    else if (line.startsWith("LH:")) hit += Number(line.slice(3));
  }
  return { found, hit };
}

export function addCounts(parts) {
  return parts.reduce(
    (sum, part) => ({
      found: sum.found + part.found,
      hit: sum.hit + part.hit,
    }),
    { found: 0, hit: 0 },
  );
}

const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`;

export function kcovWrapper({ bash, kcov, root, includePaths, runsDir }) {
  return `#!${bash}
if [[ -z "\${KCOV_WRAP_ACTIVE:-}" && "\${1:-}" == ${shellQuote(root)}/*.sh && "\${1:-}" != *.test.sh ]]; then
  export KCOV_WRAP_ACTIVE=1
  exec ${shellQuote(kcov)} ${shellQuote(`--include-path=${includePaths.join(",")}`)} --include-pattern=.sh --exclude-pattern=.test.sh ${shellQuote(runsDir)}"/run-$$-$RANDOM" "$@"
fi
exec ${shellQuote(bash)} "$@"
`;
}

export function parseKcovReport(text, root) {
  const report = JSON.parse(text);
  if (!Array.isArray(report?.files)) {
    throw new Error('The kcov report has no "files" list.');
  }
  return report.files
    .map((file) => {
      const found = Number(file?.total_lines);
      const hit = Number(file?.covered_lines);
      if (
        typeof file?.file !== "string" ||
        !Number.isInteger(found) ||
        !Number.isInteger(hit)
      ) {
        throw new Error(
          `The kcov report has a file entry with no path or no line counts: ${JSON.stringify(file)}.`,
        );
      }
      if (!file.file.startsWith(`${root}/`)) {
        throw new Error(
          `The kcov report has the file "${file.file}", which is not in "${root}".`,
        );
      }
      return { path: file.file.slice(root.length + 1), found, hit };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

const percentOf = ({ found, hit }) => (hit / found) * 100;

export function checkShellCoverage({ files, lines, minFoundLines }) {
  const errors = [];
  if (!Number.isFinite(lines)) {
    errors.push(
      `"shell.lines" must be a number, not ${JSON.stringify(lines)}.`,
    );
  }
  for (const [name, floor] of Object.entries(minFoundLines)) {
    if (!Number.isInteger(floor) || floor < 0) {
      errors.push(
        `"shell.minFoundLines" for "${name}" must be a whole number, not ${JSON.stringify(floor)}.`,
      );
    }
  }
  if (errors.length > 0) return errors;
  const reported = new Set(files.map((file) => file.path));
  for (const file of files) {
    if (!Object.hasOwn(minFoundLines, file.path)) {
      errors.push(
        `kcov measured "${file.path}", but "shell.minFoundLines" has no entry for it. Add an entry.`,
      );
    } else if (file.found < minFoundLines[file.path]) {
      errors.push(
        `kcov found ${file.found} lines in "${file.path}". The floor is ${minFoundLines[file.path]}. Lower the floor only when you deleted code from the script. Otherwise look for a multi-line quoted string inside $(...). A kcov parser bug (SimonKagstrom/kcov#519) drops the lines after it.`,
      );
    }
  }
  for (const name of Object.keys(minFoundLines)) {
    if (!reported.has(name)) {
      errors.push(
        `"shell.minFoundLines" has an entry for "${name}", but kcov did not measure it. Check that a test runs the script by its absolute path, or remove the entry.`,
      );
    }
  }
  const total = addCounts(files);
  if (!(total.found > 0)) {
    errors.push("The kcov report has no line.");
  } else if (percentOf(total) < lines) {
    errors.push(
      `Shell line coverage is ${percentOf(total).toFixed(1)}%. The minimum is ${lines}%.`,
    );
  }
  return errors;
}

export function formatShellReport({ files, lines, minFoundLines }) {
  const rows = files.map((file) => {
    const percent = file.found > 0 ? percentOf(file).toFixed(1) : "0.0";
    return `${file.path}: ${file.hit} of ${file.found} lines (${percent}%). Floor: ${minFoundLines[file.path] ?? "none"}.`;
  });
  const total = addCounts(files);
  const percent = total.found > 0 ? percentOf(total).toFixed(1) : "0.0";
  return [
    ...rows,
    `Total: ${total.hit} of ${total.found} lines (${percent}%). Minimum: ${lines}%.`,
  ].join("\n");
}

// The format is the shields endpoint JSON: https://shields.io/badges/endpoint-badge
export function coverageBadge(label, { found, hit }) {
  if (!(found > 0)) throw new Error("The coverage report has no line.");
  const percent = (hit / found) * 100;
  const color =
    percent >= 80 ? "brightgreen" : percent >= 60 ? "yellow" : "red";
  return {
    schemaVersion: 1,
    label,
    message: `${percent.toFixed(1)}%`,
    color,
  };
}

export function badgeFiles({ node, shell }) {
  return {
    "coverage.json": coverageBadge("coverage", addCounts([node, shell])),
    "node-coverage.json": coverageBadge("node coverage", node),
    "shell-coverage.json": coverageBadge("shell coverage", shell),
  };
}

function nodeCoverageArgs(suite, lcovFile) {
  return [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include-all",
    ...suite.include.map((glob) => `--test-coverage-include=${glob}`),
    ...suite.exclude.map((glob) => `--test-coverage-exclude=${glob}`),
    `--test-coverage-lines=${suite.lines}`,
    `--test-coverage-branches=${suite.branches}`,
    `--test-coverage-functions=${suite.functions}`,
    ...(lcovFile
      ? [
          "--test-reporter=spec",
          "--test-reporter-destination=stdout",
          "--test-reporter=lcov",
          `--test-reporter-destination=${lcovFile}`,
        ]
      : []),
    ...suite.tests,
  ];
}

function findOnPath(name, pathEnv) {
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

export function prepareKcov(root, shell, parentDir) {
  const kcov = findOnPath("kcov", process.env.PATH ?? "");
  const bash = findOnPath("bash", process.env.PATH ?? "");
  if (!kcov) {
    return {
      error:
        "kcov is not on PATH. Use the devcontainer, or install kcov 43 (apt-get install kcov).",
    };
  }
  if (!bash) return { error: "bash is not on PATH." };
  if (process.getuid?.() === 0) {
    return {
      error:
        "kcov cannot trace bash as root. Run the gate as a user that is not root.",
    };
  }
  mkdirSync(parentDir, { recursive: true });
  const kcovDir = mkdtempSync(path.join(parentDir, "kcov-"));
  const binDir = path.join(kcovDir, "bin");
  const runsDir = path.join(kcovDir, "runs");
  mkdirSync(binDir);
  mkdirSync(runsDir);
  const includePaths = [
    ...new Set(
      Object.keys(shell.minFoundLines).map((file) =>
        path.dirname(path.join(root, file)),
      ),
    ),
  ].sort();
  const wrapper = path.join(binDir, "bash");
  writeFileSync(
    wrapper,
    kcovWrapper({ bash, kcov, root, includePaths, runsDir }),
  );
  chmodSync(wrapper, 0o755);
  return {
    kcov,
    kcovDir,
    runsDir,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  };
}

function runShellTests(root, tests, env) {
  return tests.flatMap((test) => {
    console.log(`\n== Shell test: ${test}`);
    const result = spawnSync("bash", [path.join(root, test)], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    return result.status === 0
      ? []
      : [`The shell test "${test}" failed (exit code ${result.status}).`];
  });
}

function mergeKcov({ kcov, kcovDir, runsDir }, root) {
  const runs = readdirSync(runsDir).map((name) => path.join(runsDir, name));
  if (runs.length === 0) {
    throw new Error(
      "kcov recorded no run. No test called a measured script with bash and an absolute path.",
    );
  }
  const reportDir = path.join(kcovDir, "report");
  const result = spawnSync(kcov, ["--merge", reportDir, ...runs], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `kcov could not merge the runs (exit code ${result.status}). ${result.stderr}`,
    );
  }
  return parseKcovReport(
    readFileSync(path.join(reportDir, "kcov-merged", "coverage.json"), "utf8"),
    root,
  );
}

function runNodeSuite(root, suite, lcovFile, env) {
  console.log(`\n== Node coverage: ${suite.name} (${suite.directory})`);
  const result = spawnSync(
    process.execPath,
    nodeCoverageArgs(suite, lcovFile),
    {
      cwd: path.join(root, suite.directory),
      env,
      stdio: "inherit",
    },
  );
  if (result.status === 0) return [];
  const why = result.error
    ? result.error.message
    : `exit code ${result.status}`;
  return [
    `Suite "${suite.name}" failed (${why}). A test failed or a coverage value is below ${JSON.stringify({ lines: suite.lines, branches: suite.branches, functions: suite.functions })}.`,
  ];
}

const USAGE = `Usage: node scripts/coverage-gate.mjs [--badge-dir DIR] [--kcov-dir DIR]
  --badge-dir DIR  Write the badge files in DIR when every check passes.
  --kcov-dir DIR   Keep the kcov output and the HTML report in a new directory in DIR.`;

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) {
    console.error(USAGE);
    process.exit(2);
  }
  return value;
}

function main() {
  const badgeDir = optionValue("--badge-dir");
  const keepDir = optionValue("--kcov-dir");
  const thresholds = JSON.parse(
    readFileSync(path.join(repoRoot, ".coverage-thresholds.json"), "utf8"),
  );
  const lcovDir = badgeDir
    ? mkdtempSync(path.join(os.tmpdir(), "lcov-"))
    : null;
  const lcovFiles = [];
  const errors = [];
  let shellFiles = [];

  const kcov = prepareKcov(
    repoRoot,
    thresholds.shell,
    keepDir ? path.resolve(keepDir) : os.tmpdir(),
  );
  if (kcov.error) errors.push(kcov.error);
  errors.push(
    ...thresholds.node.flatMap((suite, index) => {
      const lcovFile = lcovDir
        ? path.join(lcovDir, `${index}.info`)
        : undefined;
      if (lcovFile) lcovFiles.push(lcovFile);
      return runNodeSuite(repoRoot, suite, lcovFile, kcov.env);
    }),
  );

  if (!kcov.error) {
    errors.push(...runShellTests(repoRoot, thresholds.shell.tests, kcov.env));
    console.log("\n== Shell coverage");
    try {
      shellFiles = mergeKcov(kcov, repoRoot);
      const shell = { files: shellFiles, ...thresholds.shell };
      console.log(formatShellReport(shell));
      errors.push(...checkShellCoverage(shell));
      if (keepDir) {
        console.log(
          `Report: ${path.join(kcov.kcovDir, "report", "kcov-merged", "index.html")}`,
        );
      }
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (!keepDir && !kcov.error) {
    rmSync(kcov.kcovDir, { recursive: true, force: true });
  }

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
    if (lcovDir) rmSync(lcovDir, { recursive: true });
    process.exit(1);
  }
  if (badgeDir) {
    const badges = badgeFiles({
      node: addCounts(
        lcovFiles.map((file) => sumLcov(readFileSync(file, "utf8"))),
      ),
      shell: addCounts(shellFiles),
    });
    mkdirSync(badgeDir, { recursive: true });
    for (const [name, badge] of Object.entries(badges)) {
      writeFileSync(path.join(badgeDir, name), `${JSON.stringify(badge)}\n`);
    }
    rmSync(lcovDir, { recursive: true });
  }
  console.log("\nCoverage gate passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
