// Check the Renovate configuration for mistakes that renovate-config-validator accepts.
//
// Rule 1: Each regex custom manager must match at least one file in the repository.
// The manager must also find a match for at least one of its matchStrings in a file that it reads.
// Rule 2: Each extends entry that starts with github>marinatedconcrete/config// or
// local>marinatedconcrete/config// must name a file that exists. The check reads the
// extends entries at all levels of the file. It does not check other forms of entry.
//
// Usage: node scripts/renovate-checks.mjs
// Run the script from the repository root. The script reads the files that git tracks.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CONFIG_FILES_PATTERN = /^(renovate\.json|renovate\/[^/]+\.json)$/;
export const REPOSITORY = "marinatedconcrete/config";

// A shared preset can hold a manager for files that only other repositories have.
// The check skips a manager that this list names. Each entry needs the file, the
// complete matchStrings of the manager, and the reason. A manager that has other
// matchStrings is not skipped, also when it reads the same files.
export const CONSUMER_ONLY_MANAGERS = [
  {
    file: "renovate/marinatedconcrete.json",
    matchStrings: [
      "- https://github\\.com/marinatedconcrete/config/releases/download/(?<currentValue>.*?)/",
      "- https://github\\.com/marinatedconcrete/config/?\\?ref=(?<currentValue>.+?)$",
    ],
    reason:
      "The manager reads release URLs in kustomization files of consumer repositories. This repository uses local component paths.",
  },
];

// Convert a glob to a regular expression. Renovate uses minimatch for a glob. The result
// can differ from minimatch, for example for "[...]" or for "**" inside a directory name.
// Renovate ignores case in a glob, so the expression ignores case too.
function globToRegExp(glob) {
  let source = "";
  let braceDepth = 0;
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else if (char === "{") {
      braceDepth++;
      source += "(?:";
    } else if (char === "}" && braceDepth > 0) {
      braceDepth--;
      source += ")";
    } else if (char === "," && braceDepth > 0) source += "|";
    else source += char.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i");
}

// Renovate reads a pattern that starts with / or !/ and ends with / or /i as a regular
// expression. A "!" at the start negates the expression. Renovate reads any other
// pattern as a glob. This check does not support the !/ form and reads it as a glob.
export function patternToRegExp(pattern) {
  const form = /^\/(.+)\/(i?)$/s.exec(pattern);
  return form ? new RegExp(form[1], form[2]) : globToRegExp(pattern);
}

function describeManager(file, index, manager) {
  const label = manager.description ? ` (${manager.description})` : "";
  return `${file}: customManagers[${index}]${label} with managerFilePatterns ${JSON.stringify(manager.managerFilePatterns)}`;
}

// config: the parsed contents of one Renovate file. files: the repository paths.
// readFile: a function that returns the text of a path.
// The result is a list of failure messages. The check skips a manager that is not a
// regex manager or that the allowed list names.
export function findDeadManagers({
  file,
  config,
  files,
  readFile,
  allowed = CONSUMER_ONLY_MANAGERS,
}) {
  const failures = [];
  (config.customManagers ?? []).forEach((manager, index) => {
    if (manager.customType !== "regex") return;
    const strings = JSON.stringify(manager.matchStrings ?? []);
    if (
      allowed.some(
        (a) => a.file === file && JSON.stringify(a.matchStrings) === strings,
      )
    )
      return;
    const name = describeManager(file, index, manager);
    let patterns;
    let matchers;
    try {
      patterns = (manager.managerFilePatterns ?? []).map(patternToRegExp);
      matchers = (manager.matchStrings ?? []).map(
        (source) => new RegExp(source, "g"),
      );
    } catch (error) {
      failures.push(
        `${name} has a pattern that does not compile: ${error.message}`,
      );
      return;
    }
    const candidates = files.filter((path) =>
      patterns.some((pattern) => pattern.test(path)),
    );
    if (candidates.length === 0) {
      failures.push(`${name} matches no file in the repository.`);
      return;
    }
    const found = candidates.some((path) => {
      const text = readFile(path);
      return matchers.some((matcher) => {
        matcher.lastIndex = 0;
        return matcher.test(text);
      });
    });
    if (!found) {
      failures.push(
        `${name} matches ${candidates.length} file(s), but no matchStrings entry matches in any of them.`,
      );
    }
  });
  return failures;
}

// Return the repository file that an extends entry points at, or null.
// The entry must start with github>marinatedconcrete/config// or
// local>marinatedconcrete/config//.
// Renovate uses an explicit .json, .jsonc, or .json5 extension as written.
// An entry with no extension names a .json file.
export function presetPath(entry) {
  const form = new RegExp(
    `^(?:github|local)>${REPOSITORY}//([^#:]+?)(\\.json[c5]?)?(?:#.*)?$`,
  ).exec(entry);
  return form ? `${form[1]}${form[2] ?? ".json"}` : null;
}

// Renovate reads extends at the top level and in nested objects, for example in a
// packageRules entry. A string value is one entry.
function extendsEntries(node) {
  if (Array.isArray(node)) return node.flatMap(extendsEntries);
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "extends" ? [value].flat() : extendsEntries(value),
  );
}

export function findMissingPresets({ file, config, files }) {
  const known = new Set(files);
  return extendsEntries(config).flatMap((entry) => {
    const path = presetPath(entry);
    if (path === null || known.has(path)) return [];
    return [
      `${file}: extends entry "${entry}" needs ${path}, which does not exist.`,
    ];
  });
}

export function checkRenovateConfig({ configs, files, readFile }) {
  return configs.flatMap(({ file, config }) => [
    ...findDeadManagers({ file, config, files, readFile }),
    ...findMissingPresets({ file, config, files }),
  ]);
}

function main() {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const configs = files
    .filter((path) => CONFIG_FILES_PATTERN.test(path))
    .map((file) => ({ file, config: JSON.parse(readFileSync(file, "utf8")) }));
  const failures = checkRenovateConfig({
    configs,
    files,
    readFile: (path) => readFileSync(path, "utf8"),
  });
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log(`Checked ${configs.length} Renovate file(s). No problems found.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
