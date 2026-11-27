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
const READ_ATTEMPTS = 3;
export const PULL_JQ = "[.changed_files, .head.sha, .base.sha] | @tsv";
// Each line is a JSON array with the file name and the old name of a renamed file.
// JSON keeps a file name with a line feed in one piece.
export const FILES_JQ =
  ".[] | [.filename, (.previous_filename // empty)] | tojson";

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
      rule.area.length === AREA_PREFIX.length ||
      rule.area !== rule.area.toLowerCase()
    ) {
      throw new Error(
        `${where}: area must be lower case and start with "${AREA_PREFIX}". Found ${JSON.stringify(rule.area)}.`,
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

// Glob syntax: "*" matches any characters except "/". "**" matches any characters, including "/" and a line feed.
// "**/" at the start of a glob or after a "/" matches zero or more directories. A name that starts with a dot matches like any other name.
// The other characters of a glob, such as "?", "[", and "{", match themselves.
// path.matchesGlob skips names that start with a dot, so the script does its own conversion.
function globToRegex(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        source += "(?:[^]*/)?";
        i += 2;
      } else {
        source += "[^]*";
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

// Another person or run can change the labels between the read and the write.
// Ignore a failure when the wanted state already exists.
async function attempt(action, alreadyDone) {
  try {
    await action();
  } catch (error) {
    if (!(await alreadyDone())) throw error;
  }
}

export async function labelPullRequest({ repo, number, policy, run, headSha }) {
  const lines = async (args) =>
    (await run(args)).split("\n").filter((line) => line !== "");
  const names = (route) =>
    lines(["api", "--paginate", `${route}?per_page=100`, "--jq", ".[].name"]);
  const issueRoute = `repos/${repo}/issues/${number}/labels`;

  const apply = async (plan) => {
    if (plan.add.length > 0) {
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
  };
  // The count, the head, and the base come from one request.
  const readPull = async () => {
    const text = (
      await run(["api", `repos/${repo}/pulls/${number}`, "--jq", PULL_JQ])
    ).trim();
    const [count, head, base] = text.split("\t");
    const changed = count === "" ? NaN : Number(count);
    if (!Number.isInteger(changed) || changed < 0) {
      throw new Error(`The API gave no count of changed files: "${text}".`);
    }
    return { changed, head, base };
  };
  const sameRevision = (x, y) => x.head === y.head && x.base === y.base;
  const listEntries = async () =>
    (
      await lines([
        "api",
        "--paginate",
        `repos/${repo}/pulls/${number}/files?per_page=100`,
        "--jq",
        FILES_JQ,
      ])
    ).map((line) => JSON.parse(line));

  const first = await readPull();
  // A newer push starts a newer run. Leave the labels to that run.
  const skipped = (pull) =>
    headSha && pull.head !== headSha
      ? `The head of the pull request is ${pull.head}. This run is for ${headSha}.`
      : null;
  if (skipped(first))
    return { add: [], remove: [], unmatched: [], skipped: skipped(first) };
  if (first.changed > MAX_FILES) {
    // The list of files is cut, so the tier is unknown. Fail closed: set the highest risk label.
    const top = `${RISK_PREFIX}${TIERS.at(-1)}`;
    const current = await names(issueRoute);
    const last = await readPull();
    if (skipped(last))
      return { add: [], remove: [], unmatched: [], skipped: skipped(last) };
    if (!sameRevision(first, last) || last.changed !== first.changed) {
      throw new Error(
        "The pull request changed during the read. No label changed.",
      );
    }
    await apply({
      add: current.some((l) => l.toLowerCase() === top) ? [] : [top],
      remove: current.filter(
        (label) =>
          label.toLowerCase().startsWith(RISK_PREFIX) &&
          label.toLowerCase() !== top,
      ),
    });
    throw new Error(
      `The pull request changes ${first.changed} files. The API lists at most ${MAX_FILES}. The script set ${top} and stopped.`,
    );
  }
  // The pull request, the list, and the labels come from separate requests. Use them only when
  // the pull request has the same head, base, and count before the list and after the labels.
  let entries;
  let current;
  for (let attempt = 1; ; attempt++) {
    const before = attempt === 1 ? first : await readPull();
    entries = await listEntries();
    current = await names(issueRoute);
    const after = await readPull();
    if (skipped(after))
      return { add: [], remove: [], unmatched: [], skipped: skipped(after) };
    if (
      entries.length === before.changed &&
      after.changed === before.changed &&
      sameRevision(before, after)
    ) {
      break;
    }
    if (attempt === READ_ATTEMPTS) {
      throw new Error(
        `The list of files and the pull request did not agree after ${READ_ATTEMPTS} reads. No label changed.`,
      );
    }
  }
  const files = entries.flat();
  const { unmatched } = classify(policy, files);
  const plan = planLabels(policy, files, current);

  await apply(plan);
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
    const result = await labelPullRequest({
      repo,
      number,
      policy,
      run,
      headSha: env.HEAD_SHA,
    });
    if (result.skipped) {
      log(`Skipped: ${result.skipped}`);
      return 0;
    }
    log(`Added: ${result.add.join(", ") || "none"}`);
    log(`Removed: ${result.remove.join(", ") || "none"}`);
    if (result.unmatched.length > 0) {
      // A warning does not fail the job. "just path-policy-lint" fails the pull request in this case.
      log(
        `::warning::The policy has no rule for: ${escapeCommand(result.unmatched.join(", "))}`,
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
