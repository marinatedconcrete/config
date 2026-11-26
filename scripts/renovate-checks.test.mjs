import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONSUMER_ONLY_MANAGERS,
  checkRenovateConfig,
  findDeadManagers,
  findMissingPresets,
  patternToRegExp,
  presetPath,
} from "./renovate-checks.mjs";

const manager = (overrides) => ({
  customType: "regex",
  managerFilePatterns: ["/^a\\.yml$/"],
  matchStrings: ["version: (?<currentValue>.+)"],
  ...overrides,
});
const run = (customManagers, contents) =>
  findDeadManagers({
    file: "renovate.json",
    config: { customManagers },
    files: Object.keys(contents),
    readFile: (path) => contents[path],
  });

test("a regex string matches a path like Renovate does", () => {
  assert.ok(patternToRegExp("/^actions/.*\\.sh$/").test("actions/x/run.sh"));
  assert.ok(!patternToRegExp("/^actions/.*\\.sh$/").test("images/run.sh"));
  assert.ok(patternToRegExp("/readme/i").test("docs/README.md"));
});

test("a plain string is a glob", () => {
  assert.ok(patternToRegExp("**/*.yml").test("a/b/c.yml"));
  assert.ok(patternToRegExp("**/*.yml").test("c.yml"));
  assert.ok(!patternToRegExp("*.yml").test("a/c.yml"));
  assert.ok(patternToRegExp("a/{b,c}.json").test("a/c.json"));
  assert.ok(!patternToRegExp("a/{b,c}.json").test("a/d.json"));
  assert.ok(!patternToRegExp("a?.json").test("a.json"));
});

test("a manager that finds a file and a match passes", () => {
  assert.deepEqual(run([manager({})], { "a.yml": "version: 1" }), []);
});

test("a manager whose patterns match no file fails and is named", () => {
  const [failure] = run([manager({ description: "Update tools" })], {
    "b.yml": "version: 1",
  });
  assert.match(failure, /renovate\.json: customManagers\[0\] \(Update tools\)/);
  assert.match(failure, /matches no file/);
});

test("a manager whose matchStrings match no text fails", () => {
  const [failure] = run([manager({})], { "a.yml": "nothing here" });
  assert.match(failure, /customManagers\[0\]/);
  assert.match(failure, /no matchStrings entry matches/);
});

test("one matching matchStrings entry is enough", () => {
  const strings = ["zzz(?<currentValue>.+)", "version: (?<currentValue>.+)"];
  assert.deepEqual(
    run([manager({ matchStrings: strings })], { "a.yml": "version: 1" }),
    [],
  );
});

test("two managers with the same patterns both pass", () => {
  const contents = { "a.yml": "version: 1", "b.yml": "version: 2" };
  const both = manager({ managerFilePatterns: ["/\\.yml$/"] });
  assert.deepEqual(run([both, both], contents), []);
});

test("a pattern that does not compile fails", () => {
  const [failure] = run([manager({ matchStrings: ["("] })], {
    "a.yml": "x",
  });
  assert.match(failure, /does not compile/);
});

test("a manager on the consumer-only list is skipped", () => {
  const allowed = [
    {
      file: "renovate.json",
      matchStrings: ["version: (?<currentValue>.+)"],
      reason: "Test.",
    },
  ];
  const check = (file) =>
    findDeadManagers({
      file,
      config: { customManagers: [manager({})] },
      files: ["a.yml"],
      readFile: () => "nothing",
      allowed,
    });
  assert.deepEqual(check("renovate.json"), []);
  assert.equal(check("renovate/other.json").length, 1);
});

test("a second manager that reads the same files is not skipped", () => {
  const allowed = [
    {
      file: "renovate.json",
      matchStrings: ["version: (?<currentValue>.+)"],
      reason: "Test.",
    },
  ];
  const failures = findDeadManagers({
    file: "renovate.json",
    config: {
      customManagers: [manager({}), manager({ matchStrings: ["never"] })],
    },
    files: ["a.yml"],
    readFile: () => "nothing",
    allowed,
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /customManagers\[1\]/);
  assert.match(failures[0], /no matchStrings entry matches/);
});

test("the real consumer-only list names real managers", () => {
  for (const { file, matchStrings, reason } of CONSUMER_ONLY_MANAGERS) {
    const config = JSON.parse(
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    );
    assert.ok(
      config.customManagers.some(
        (m) => JSON.stringify(m.matchStrings) === JSON.stringify(matchStrings),
      ),
      `${file} has no manager with these matchStrings: ${matchStrings}`,
    );
    assert.ok(reason.length > 0);
  }
});

test("a glob ignores case and a regular expression does not", () => {
  assert.ok(patternToRegExp("**/containerfile").test("images/a/Containerfile"));
  assert.ok(patternToRegExp("/^a\\.yml$/").test("a.yml"));
  assert.equal(patternToRegExp("/^a\\.yml$/").test("A.yml"), false);
});

test("a manager of another type is ignored", () => {
  assert.deepEqual(run([manager({ customType: "jsonata" })], {}), []);
});

test("an entry for this repository gives a path", () => {
  const base = "marinatedconcrete/config//renovate/recommended";
  assert.equal(
    presetPath(`github>${base}#renovate-config-2.9.0`),
    "renovate/recommended.json",
  );
  assert.equal(presetPath(`local>${base}`), "renovate/recommended.json");
  assert.equal(
    presetPath(`github>${base}.json#tag`),
    "renovate/recommended.json",
  );
  assert.equal(
    presetPath(`github>${base}.json5#tag`),
    "renovate/recommended.json5",
  );
  assert.equal(
    presetPath(`github>${base}.jsonc`),
    "renovate/recommended.jsonc",
  );
});

test("other presets give no path", () => {
  assert.equal(presetPath(":semanticCommitScope(package)"), null);
  assert.equal(presetPath("helpers:pinGitHubActionDigestsToSemver"), null);
  assert.equal(presetPath("github>other/config//renovate/x#v1"), null);
  assert.equal(presetPath("marinatedconcrete/config//renovate/x"), null);
});

test("a missing preset file fails and names the entry", () => {
  const entry = "github>marinatedconcrete/config//renovate/doesnotexist#nope";
  const [failure] = findMissingPresets({
    file: "renovate.json",
    config: { extends: [entry, "config:best-practices"] },
    files: ["renovate/recommended.json"],
  });
  assert.match(failure, /doesnotexist#nope/);
  assert.match(failure, /renovate\/doesnotexist\.json,/);
});

test("an explicit extension must match the file that exists", () => {
  const check = (entry, files) =>
    findMissingPresets({
      file: "renovate.json",
      config: { extends: [entry] },
      files,
    });
  const base = "github>marinatedconcrete/config//renovate/recommended";
  const [failure] = check(`${base}.json5`, ["renovate/recommended.json"]);
  assert.match(failure, /needs renovate\/recommended\.json5,/);
  assert.deepEqual(check(`${base}.json5`, ["renovate/recommended.json5"]), []);
  assert.deepEqual(check(`${base}.json`, ["renovate/recommended.json"]), []);
});

test("an existing preset file passes", () => {
  assert.deepEqual(
    findMissingPresets({
      file: "renovate.json",
      config: {
        extends: ["github>marinatedconcrete/config//renovate/recommended#v1"],
      },
      files: ["renovate/recommended.json"],
    }),
    [],
  );
});

test("a file with no extends and no managers passes", () => {
  assert.deepEqual(
    checkRenovateConfig({
      configs: [{ file: "renovate.json", config: {} }],
      files: [],
      readFile: () => "",
    }),
    [],
  );
});

test("the combined check reports both rules", () => {
  const failures = checkRenovateConfig({
    configs: [
      {
        file: "renovate.json",
        config: {
          extends: ["local>marinatedconcrete/config//renovate/nope"],
          customManagers: [manager({})],
        },
      },
    ],
    files: ["b.yml"],
    readFile: () => "",
  });
  assert.equal(failures.length, 2);
});

test("an extends entry in a package rule or a nested object is checked", () => {
  const missing = (name) =>
    `github>marinatedconcrete/config//renovate/${name}#v1`;
  const failures = findMissingPresets({
    file: "renovate.json",
    config: {
      packageRules: [{ matchPackageNames: ["x"], extends: [missing("rule")] }],
      vulnerabilityAlerts: { extends: missing("alerts") },
    },
    files: [],
  });
  assert.equal(failures.length, 2);
  assert.match(failures[0], /needs renovate\/rule\.json,/);
  assert.match(failures[1], /needs renovate\/alerts\.json,/);
});

test("only the /regex/ and /regex/i forms are regular expressions", () => {
  assert.ok(patternToRegExp("/^A$/i").test("a"));
  assert.equal(patternToRegExp("/^a$/g").test("a"), false);
  assert.ok(patternToRegExp("/^a$/g").test("/^a$/g"));
});
