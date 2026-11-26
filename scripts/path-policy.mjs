// Apply the path policy in .github/policies/paths.json.
//
// The policy maps paths to an area and a risk tier. A pull request gets one label for each
// area that it touches and one label for the highest tier that it touches.
// A path with no rule counts as the highest tier.
// The script owns every label that starts with "area/" or "risk/". It adds and removes only those.
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
// Each line is the name of a file or the old name of a renamed file.
export const FILES_JQ = ".[] | .filename, (.previous_filename // empty)";

// A policy has this shape: { rules: [{ tier, area, paths: [glob] }] }
// A classification has this shape: { areas: [string], tier: string | null, unmatched: [string] }
// The tier is null only when the list of files is empty.

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

// Glob syntax: "*" matches any characters except "/". "**" matches any characters, including "/".
// "**/" matches zero or more directories. A name that starts with a dot matches like any other name.
// The other characters of a glob, such as "?", "[", and "{", match themselves.
// path.matchesGlob skips names that start with a dot, so the script does its own conversion.
function globToRegex(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

const globCache = new Map();
export function matches(file, glob) {
  if (!globCache.has(glob)) globCache.set(glob, globToRegex(glob));
  return globCache.get(glob).test(file);
}

const covers = (policy, file) =>
  policy.rules.some((rule) => rule.paths.some((glob) => matches(file, glob)));

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
      tierRank = TIERS.length - 1;
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
    if (!covers(policy, file)) {
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

// GitHub ignores the case of a label name, so the script compares names in lower case.
export const isOwned = (label) => {
  const name = label.toLowerCase();
  return name.startsWith(AREA_PREFIX) || name.startsWith(RISK_PREFIX);
};

export function planLabels(policy, files, current) {
  const { areas, tier } = classify(policy, files);
  const wanted = new Set(areas.map((label) => label.toLowerCase()));
  if (tier) wanted.add(`${RISK_PREFIX}${tier}`);
  const have = new Set(current.map((label) => label.toLowerCase()));
  return {
    add: [...wanted].filter((label) => !have.has(label)).sort(),
    remove: current
      .filter((label) => isOwned(label) && !wanted.has(label.toLowerCase()))
      .sort(),
  };
}

// Run the action. If it fails, run it again only when the wanted state is not there yet.
// Another person or run can change the labels between the read and the write.
async function attempt(action, alreadyDone) {
  try {
    await action();
  } catch (error) {
    if (!(await alreadyDone())) throw error;
  }
}

// run(args) runs "gh" with the arguments and returns its standard output.
export async function labelPullRequest({ repo, number, policy, run }) {
  const lines = async (args) =>
    (await run(args)).split("\n").filter((line) => line !== "");
  const names = (route) =>
    lines(["api", "--paginate", `${route}?per_page=100`, "--jq", ".[].name"]);
  const issueRoute = `repos/${repo}/issues/${number}/labels`;

  const changed = Number(
    await run([
      "api",
      `repos/${repo}/pulls/${number}`,
      "--jq",
      ".changed_files",
    ]),
  );
  if (!(changed <= MAX_FILES)) {
    throw new Error(
      `The pull request changes ${changed} files. The API lists at most ${MAX_FILES}. The script cannot find the tier.`,
    );
  }
  const files = await lines([
    "api",
    "--paginate",
    `repos/${repo}/pulls/${number}/files?per_page=100`,
    "--jq",
    FILES_JQ,
  ]);
  const current = await names(issueRoute);
  const { unmatched } = classify(policy, files);
  const plan = planLabels(policy, files, current);

  if (plan.add.length > 0) {
    const exists = async (name) =>
      (await names(`repos/${repo}/labels`)).some(
        (label) => label.toLowerCase() === name,
      );
    const known = new Set(
      (await names(`repos/${repo}/labels`)).map((label) => label.toLowerCase()),
    );
    for (const name of plan.add.filter((label) => !known.has(label))) {
      await attempt(
        () =>
          run([
            "api",
            "-X",
            "POST",
            `repos/${repo}/labels`,
            "-f",
            `name=${name}`,
            "-f",
            "color=ededed",
          ]),
        () => exists(name),
      );
    }
    await run([
      "api",
      "-X",
      "POST",
      issueRoute,
      ...plan.add.flatMap((label) => ["-f", `labels[]=${label}`]),
    ]);
  }
  for (const label of plan.remove) {
    await attempt(
      () =>
        run([
          "api",
          "-X",
          "DELETE",
          `${issueRoute}/${encodeURIComponent(label)}`,
        ]),
      async () =>
        !(await names(issueRoute)).some(
          (name) => name.toLowerCase() === label.toLowerCase(),
        ),
    );
  }
  return { ...plan, unmatched };
}

async function ghRun(args) {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function gitListFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split("\0").filter(Boolean);
}

// A workflow command reads "%", a carriage return, and a line feed as escapes.
export const escapeCommand = (text) =>
  text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

// Return the exit code.
export async function main(
  argv,
  {
    env = process.env,
    run = ghRun,
    listFiles = gitListFiles,
    log = console.log,
    error = console.error,
    policyText,
  } = {},
) {
  const [command, number] = argv;
  const policy = parsePolicy(
    policyText ?? (await readFile(POLICY_FILE, "utf8")),
  );
  if (command === "check") {
    const errors = checkPolicy(policy, await listFiles());
    errors.forEach((message) => error(message));
    return errors.length === 0 ? 0 : 1;
  }
  if (command === "label" && /^[0-9]+$/.test(number ?? "")) {
    const repo = env.GH_REPO;
    if (!repo) {
      error("Set GH_REPO to owner/name.");
      return 2;
    }
    const result = await labelPullRequest({ repo, number, policy, run });
    log(`Added: ${result.add.join(", ") || "none"}`);
    log(`Removed: ${result.remove.join(", ") || "none"}`);
    if (result.unmatched.length > 0) {
      // The job reads the policy of the default branch. A pull request that adds the rule does not fail here.
      // "just path-policy-lint" checks the policy of the pull request itself.
      log(
        `::warning::The default branch policy has no rule for: ${escapeCommand(result.unmatched.join(", "))}`,
      );
    }
    return 0;
  }
  error(
    "Usage: node scripts/path-policy.mjs check | label PULL_REQUEST_NUMBER",
  );
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
