import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyReleasePath } from "./plan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const schemaPath = join(
  dirname(fileURLToPath(import.meta.resolve("release-please"))),
  "..",
  "..",
  "schemas",
  "config.json",
);

// Keywords that only describe a schema. They do not restrict a value.
const annotations = new Set([
  "$schema",
  "title",
  "description",
  "default",
  "format",
  "definitions",
]);

// Check a value against the subset of JSON Schema draft-07 that the
// release-please schema uses. An unknown keyword throws, so a schema change
// in a new release-please version cannot pass without a check.
export function schemaErrors(schema, value, root, at = "$") {
  if (schema === true) return [];
  if (schema === false) return [`${at}: no value is allowed`];
  if (schema.$ref) {
    const target = schema.$ref
      .replace("#/", "")
      .split("/")
      .reduce((node, key) => node[key], root);
    return schemaErrors(target, value, root, at);
  }
  const errors = [];
  for (const [keyword, rule] of Object.entries(schema)) {
    if (annotations.has(keyword)) continue;
    const kind = Array.isArray(value) ? "array" : typeof value;
    if (keyword === "type") {
      if (kind !== rule) {
        errors.push(`${at}: expected ${rule}, found ${kind}`);
      }
    } else if (keyword === "enum") {
      if (!rule.includes(value))
        errors.push(`${at}: ${JSON.stringify(value)} is not in ${rule}`);
    } else if (keyword === "allOf") {
      for (const part of rule)
        errors.push(...schemaErrors(part, value, root, at));
    } else if (keyword === "anyOf") {
      if (rule.every((part) => schemaErrors(part, value, root, at).length))
        errors.push(`${at}: matches none of the allowed shapes`);
    } else if (keyword === "required") {
      if (kind === "object")
        for (const key of rule)
          if (!(key in value)) errors.push(`${at}: missing ${key}`);
    } else if (keyword === "items") {
      if (kind === "array")
        value.forEach((item, index) =>
          errors.push(...schemaErrors(rule, item, root, `${at}[${index}]`)),
        );
    } else if (keyword === "properties" || keyword === "additionalProperties") {
      if (kind !== "object") continue;
      for (const [key, item] of Object.entries(value)) {
        const known = schema.properties && key in schema.properties;
        if (keyword === "properties" && known) {
          errors.push(...schemaErrors(rule[key], item, root, `${at}.${key}`));
        } else if (keyword === "additionalProperties" && !known) {
          if (rule === false) errors.push(`${at}: unknown property ${key}`);
          else errors.push(...schemaErrors(rule, item, root, `${at}.${key}`));
        }
      }
    } else {
      throw new Error(`Unsupported schema keyword ${keyword} at ${at}`);
    }
  }
  return errors;
}

// Return one message for each broken rule. Each message names the package.
export function configProblems({ config, manifest, schema, exists }) {
  const problems = [];
  const paths = Object.keys(config.packages);
  for (const path of paths) {
    const settings = config.packages[path];
    if (!(path in manifest))
      problems.push(
        `${path}: has no entry in .release-please-manifest.json (rule: manifest entry)`,
      );
    if (!exists(path))
      problems.push(`${path}: does not exist in the repository (rule: path)`);
    try {
      classifyReleasePath(path);
    } catch (error) {
      problems.push(
        `${path}: ${error.message}; update plan.mjs (rule: plan.mjs allow list)`,
      );
    }
    if (path.startsWith("images/")) {
      if (settings["include-v-in-tag"] !== false)
        problems.push(
          `${path}: image package must set include-v-in-tag to false (rule: image tag)`,
        );
      if (settings["tag-separator"] !== "-")
        problems.push(
          `${path}: image package must set tag-separator to "-" (rule: image tag)`,
        );
    }
  }
  for (const path of Object.keys(manifest))
    if (!(path in config.packages))
      problems.push(
        `${path}: has a manifest entry but no package in release-please-config.json (rule: manifest entry)`,
      );
  for (const error of schemaErrors(schema, config, schema))
    problems.push(`release-please-config.json: ${error} (rule: schema)`);
  return problems;
}

const real = () => ({
  config: readJson(join(root, "release-please-config.json")),
  manifest: readJson(join(root, ".release-please-manifest.json")),
  schema: readJson(schemaPath),
  exists: (path) => existsSync(join(root, path)),
});

test("the real release configuration has no problems", () => {
  assert.deepEqual(configProblems(real()), []);
});

test("a package with no manifest entry is reported", () => {
  const input = real();
  delete input.manifest["images/kairos-fedora"];
  assert.deepEqual(configProblems(input), [
    "images/kairos-fedora: has no entry in .release-please-manifest.json (rule: manifest entry)",
  ]);
});

test("a manifest entry with no package is reported", () => {
  const input = real();
  delete input.config.packages["renovate"];
  assert.deepEqual(configProblems(input), [
    "renovate: has a manifest entry but no package in release-please-config.json (rule: manifest entry)",
  ]);
});

test("a package path that does not exist is reported", () => {
  const input = real();
  input.exists = (path) => path !== "ansible";
  assert.deepEqual(configProblems(input), [
    "ansible: does not exist in the repository (rule: path)",
  ]);
});

test("a package path that plan.mjs rejects is reported", () => {
  const input = real();
  input.config.packages["tools/new"] = { "release-type": "simple" };
  input.manifest["tools/new"] = "0.0.0";
  input.exists = () => true;
  assert.deepEqual(configProblems(input), [
    "tools/new: Unsupported release path: tools/new; update plan.mjs (rule: plan.mjs allow list)",
  ]);
});

test("an image package with component tag settings is reported", () => {
  const input = real();
  input.config.packages["images/kairos-fedora"] = {
    "package-name": "kairos-fedora",
    "release-type": "simple",
  };
  assert.deepEqual(configProblems(input), [
    "images/kairos-fedora: image package must set include-v-in-tag to false (rule: image tag)",
    'images/kairos-fedora: image package must set tag-separator to "-" (rule: image tag)',
  ]);
});

test("a config that breaks the release-please schema is reported", () => {
  const input = real();
  input.config.packages["ansible"]["release-type"] = 5;
  input.config["separate-pull-requests"] = "yes";
  input.config.unknownOption = true;
  assert.deepEqual(configProblems(input), [
    "release-please-config.json: $: unknown property unknownOption (rule: schema)",
    "release-please-config.json: $.separate-pull-requests: expected boolean, found string (rule: schema)",
    "release-please-config.json: $.packages.ansible.release-type: expected string, found number (rule: schema)",
  ]);
});

test("a property that the schema forbids is reported", () => {
  const input = real();
  input.config["component-no-space"] = true;
  assert.deepEqual(configProblems(input), [
    "release-please-config.json: $.component-no-space: no value is allowed (rule: schema)",
  ]);
});

test("the schema check rejects a keyword it does not support", () => {
  assert.throws(
    () => schemaErrors({ minimum: 1 }, 2, {}),
    /Unsupported schema keyword minimum/,
  );
});
