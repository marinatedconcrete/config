import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The tests read action.yml with a line-based reader, because this package has
// no YAML dependency. The reader accepts only the layout that the files use
// now: one-line values at fixed indents. It throws on a line that it cannot
// read. A quoted value, a trailing comment, or a section that it does not find
// gives a value that does not match the README. A change of layout thus fails
// the test and does not skip a check.

const here = dirname(fileURLToPath(import.meta.url));
const readHere = (...parts) => readFileSync(join(here, ...parts), "utf8");

// Read the entries of a top-level section, such as `inputs` or `outputs`.
// Each entry is a key at two spaces with fields at four spaces.
function readSection(yaml, section) {
  const lines = yaml.split("\n");
  const start = lines.indexOf(`${section}:`);
  if (start === -1) {
    return {};
  }
  const entries = {};
  let current;
  for (const line of lines.slice(start + 1)) {
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    if (!line.startsWith(" ")) {
      break;
    }
    const entry = /^ {2}([\w-]+):$/.exec(line);
    const field = /^ {4}([\w-]+): (.+)$/.exec(line);
    if (entry) {
      current = entries[entry[1]] = {};
    } else if (field && current) {
      const value = field[2];
      assert.ok(
        !/^[>|]/.test(value),
        `a multi-line value is not supported: ${line}`,
      );
      current[field[1]] = value;
    } else {
      assert.fail(`unsupported line in ${section}: ${line}`);
    }
  }
  return entries;
}

// Read the rows of the table that follows a heading. A row becomes an object
// that uses the header cells as keys.
function readTable(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1, `README has no ${heading} heading`);
  const table = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("|")) {
      table.push(line);
    } else if (table.length > 0) {
      break;
    }
  }
  const cells = (line) =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
  const [header, , ...rows] = table.map(cells);
  assert.ok(header, `no table under ${heading}`);
  return rows.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index]])),
  );
}

const unquote = (cell) => (cell === '""' ? "" : cell.replace(/^`(.*)`$/, "$1"));

function expectedInputRows(inputs) {
  return Object.entries(inputs).map(([name, field]) => ({
    Input: `\`${name}\``,
    Required: field.required === "true" ? "yes" : "no",
    Default: unquote(field.default ?? ""),
    Description: field.description,
  }));
}

function actualInputRows(markdown, heading) {
  return readTable(markdown, heading).map((row) => ({
    ...row,
    Default: unquote(row.Default),
  }));
}

const sortByInput = (rows) =>
  [...rows].sort((a, b) => a.Input.localeCompare(b.Input));

const readme = readHere("README.md");

test("the inputs table of the README matches action.yml", () => {
  const inputs = readSection(readHere("action.yml"), "inputs");
  assert.deepEqual(
    sortByInput(actualInputRows(readme, "## Inputs")),
    sortByInput(expectedInputRows(inputs)),
  );
});

test("the outputs table of the README matches action.yml", () => {
  const outputs = readSection(readHere("action.yml"), "outputs");
  const expected = Object.entries(outputs).map(([name, field]) => ({
    Output: `\`${name}\``,
    Description: field.description,
  }));
  const sort = (rows) =>
    [...rows].sort((a, b) => a.Output.localeCompare(b.Output));
  assert.deepEqual(sort(readTable(readme, "## Outputs")), sort(expected));
});

test("the publish inputs table of the README matches publish/action.yml", () => {
  const inputs = readSection(readHere("publish", "action.yml"), "inputs");
  assert.deepEqual(
    sortByInput(actualInputRows(readme, "## Publish Inputs")),
    sortByInput(expectedInputRows(inputs)),
  );
});

test("the reader finds a difference in a description", () => {
  const inputs = readSection(
    "inputs:\n  a:\n    description: Original text.\n",
    "inputs",
  );
  const table = (description) =>
    [
      "## Inputs",
      "",
      "| Input | Required | Default | Description |",
      "| --- | --- | --- | --- |",
      `| \`a\` | no | | ${description} |`,
    ].join("\n");
  assert.deepEqual(
    actualInputRows(table("Original text."), "## Inputs"),
    expectedInputRows(inputs),
  );
  assert.notDeepEqual(
    actualInputRows(table("Changed text."), "## Inputs"),
    expectedInputRows(inputs),
  );
});

test("the reader rejects a multi-line value", () => {
  const yaml = "inputs:\n  a:\n    description: >\n";
  assert.throws(() => readSection(yaml, "inputs"), /multi-line/);
});
