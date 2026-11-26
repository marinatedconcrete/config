// Apply the path policy in .github/policies/paths.json.
//
// The policy maps paths to an area and a risk tier. A pull request gets one label for each
// area that it touches and one label for the highest tier that it touches.
//
// Usage:
//   node scripts/path-policy.mjs check
//   node scripts/path-policy.mjs label PULL_REQUEST_NUMBER
// "check" needs git and reads the tracked files. "label" needs the gh CLI and GH_REPO.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const POLICY_FILE = path.join(REPO_ROOT, ".github/policies/paths.json");

export const TIERS = ["low", "medium", "high"];
export const AREA_PREFIX = "area/";
export const RISK_PREFIX = "risk/";
// The pull request files API returns at most 3000 files.
const MAX_FILES = 3000;

// A policy has this shape: { rules: [{ tier, area, paths: [glob] }] }
// A classification has this shape: { areas: [string], tier: string | null, unmatched: [string] }
// The tier is null when no file matches a rule.

export function parsePolicy(text) {
  const policy = JSON.parse(text);
  if (!Array.isArray(policy?.rules) || policy.rules.length === 0) {
    throw new Error("The policy needs a non-empty list named rules.");
  }
  policy.rules.forEach((rule, index) => {
    const where = `rules[${index}]`;
    if (!TIERS.includes(rule.tier)) {
      throw new Error(
        `${where}: tier must be one of ${TIERS.join(", ")}. Found ${JSON.stringify(rule.tier)}.`,
      );
    }
    if (
      typeof rule.area !== "string" ||
      !rule.area.startsWith(AREA_PREFIX) ||
      rule.area.length === AREA_PREFIX.length
    ) {
      throw new Error(
        `${where}: area must start with "${AREA_PREFIX}". Found ${JSON.stringify(rule.area)}.`,
      );
    }
    if (
      !Array.isArray(rule.paths) ||
      rule.paths.length === 0 ||
      rule.paths.some((glob) => typeof glob !== "string" || glob === "")
    ) {
      throw new Error(`${where}: paths must be a non-empty list of globs.`);
    }
  });
  return policy;
}

// "**" matches any characters, including "/" and a leading ".". "*" matches any characters except "/".
// path.matchesGlob skips names that start with a dot, so the script does its own conversion.
const globCache = new Map();
export function matches(file, glob) {
  let regex = globCache.get(glob);
  if (!regex) {
    const source = glob
      .split("**")
      .map((part) =>
        part
          .split("*")
          .map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join("[^/]*"),
      )
      .join(".*");
    regex = new RegExp(`^${source}$`);
    globCache.set(glob, regex);
  }
  return regex.test(file);
}

export function classify(policy, files) {
  const areas = new Set();
  const unmatched = [];
  let tierRank = -1;
  for (const file of files) {
    const rules = policy.rules.filter((rule) =>
      rule.paths.some((glob) => matches(file, glob)),
    );
    if (rules.length === 0) {
      unmatched.push(file);
      continue;
    }
    for (const rule of rules) {
      areas.add(rule.area);
      tierRank = Math.max(tierRank, TIERS.indexOf(rule.tier));
    }
  }
  return {
    areas: [...areas].sort(),
    tier: tierRank < 0 ? null : TIERS[tierRank],
    unmatched,
  };
}

// Return one message for each file that no rule covers and each glob that no file matches.
export function checkPolicy(policy, trackedFiles) {
  const errors = [];
  for (const file of trackedFiles) {
    if (
      !policy.rules.some((rule) => rule.paths.some((g) => matches(file, g)))
    ) {
      errors.push(
        `No rule covers "${file}". Add its path to a rule in .github/policies/paths.json.`,
      );
    }
  }
  for (const rule of policy.rules) {
    for (const glob of rule.paths) {
      if (!trackedFiles.some((file) => matches(file, glob))) {
        errors.push(
          `The glob "${glob}" matches no tracked file. Fix it or remove it from .github/policies/paths.json.`,
        );
      }
    }
  }
  return errors;
}

export function ownedLabels(policy) {
  return new Set([
    ...policy.rules.map((rule) => rule.area),
    ...TIERS.map((tier) => `${RISK_PREFIX}${tier}`),
  ]);
}

// Labels the policy owns are the only ones that this function adds or removes.
export function planLabels(policy, files, current) {
  const { areas, tier } = classify(policy, files);
  const wanted = new Set(areas);
  if (tier) wanted.add(`${RISK_PREFIX}${tier}`);
  const owned = ownedLabels(policy);
  const have = new Set(current);
  return {
    add: [...wanted].filter((label) => !have.has(label)).sort(),
    remove: [...have]
      .filter((label) => owned.has(label) && !wanted.has(label))
      .sort(),
  };
}

// run(args) runs "gh" with the arguments and returns its standard output.
export async function labelPullRequest({ repo, number, policy, run }) {
  const lines = async (args) =>
    (await run(args)).split("\n").filter((line) => line !== "");
  const files = await lines([
    "api",
    "--paginate",
    `repos/${repo}/pulls/${number}/files`,
    "--jq",
    ".[] | .filename, (.previous_filename // empty)",
  ]);
  const current = await lines([
    "api",
    "--paginate",
    `repos/${repo}/issues/${number}/labels`,
    "--jq",
    ".[].name",
  ]);
  if (files.length >= MAX_FILES) {
    throw new Error(
      `The pull request has ${files.length} files. The API lists at most ${MAX_FILES}, so the tier cannot be trusted.`,
    );
  }
  const { unmatched } = classify(policy, files);
  const plan = planLabels(policy, files, current);

  if (plan.add.length > 0) {
    const existing = new Set(
      await lines([
        "api",
        "--paginate",
        `repos/${repo}/labels`,
        "--jq",
        ".[].name",
      ]),
    );
    const known = new Set([...existing].map((label) => label.toLowerCase()));
    for (const name of plan.add.filter((l) => !known.has(l.toLowerCase()))) {
      try {
        await run([
          "api",
          "-X",
          "POST",
          `repos/${repo}/labels`,
          "-f",
          `name=${name}`,
          "-f",
          "color=ededed",
        ]);
      } catch (error) {
        // Another run can create the same label between the list and the create.
        if (!/already_exists/.test(`${error.stderr ?? ""}${error.message}`))
          throw error;
      }
    }
    await run([
      "api",
      "-X",
      "POST",
      `repos/${repo}/issues/${number}/labels`,
      ...plan.add.flatMap((label) => ["-f", `labels[]=${label}`]),
    ]);
  }
  for (const label of plan.remove) {
    await run([
      "api",
      "-X",
      "DELETE",
      `repos/${repo}/issues/${number}/labels/${encodeURIComponent(label)}`,
    ]);
  }
  return { ...plan, unmatched };
}

async function ghRun(args) {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function main(argv) {
  const [command, number] = argv;
  const policy = parsePolicy(await readFile(POLICY_FILE, "utf8"));
  if (command === "check") {
    const { stdout } = await execFileAsync("git", ["ls-files"], {
      cwd: REPO_ROOT,
      maxBuffer: 64 * 1024 * 1024,
    });
    const errors = checkPolicy(policy, stdout.split("\n").filter(Boolean));
    errors.forEach((message) => console.error(message));
    return errors.length === 0 ? 0 : 1;
  }
  if (command === "label" && /^[0-9]+$/.test(number ?? "")) {
    const repo = process.env.GH_REPO;
    if (!repo) {
      console.error("Set GH_REPO to owner/name.");
      return 2;
    }
    const result = await labelPullRequest({ repo, number, policy, run: ghRun });
    console.log(`Added: ${result.add.join(", ") || "none"}`);
    console.log(`Removed: ${result.remove.join(", ") || "none"}`);
    if (result.unmatched.length > 0) {
      // The job reads the policy of the default branch, so a pull request that adds the rule is not red here.
      // "just path-policy-lint" checks the policy of the pull request itself.
      console.log(
        `::warning::The default branch policy has no rule for: ${result.unmatched.join(", ")}`,
      );
    }
    return 0;
  }
  console.error(
    "Usage: node scripts/path-policy.mjs check | label PULL_REQUEST_NUMBER",
  );
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
