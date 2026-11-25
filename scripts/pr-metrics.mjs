// Report how many pull requests opened by Hive agents were accepted.
//
// Only pull requests that carry HIVE_PR_LABEL count. Other agents and people are ignored.
// Pull requests that EXCLUDED_AUTHOR opened never count, even with the label.
//
// UNVERIFIED: The label is a best guess. The repository label list describes author/hive as
// "This repository's own hive (the App or one of its agent lanes) authored this PR".
// The Hive documentation says only that a hive/<hive-id> label records provenance.
// No Hive pull request exists in this repository yet, because Hive runs at ACMM L2.
// Check the label against the first real Hive pull request. Change the constant if it differs.
//
// Usage: node scripts/pr-metrics.mjs [--window-days N] [--summary-file PATH]
// The script needs the gh CLI with read access to pull requests.
import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const HIVE_PR_LABEL = "author/hive";
// Release pull requests come from this app. They follow from other work and need no review.
export const EXCLUDED_AUTHOR = "app/formwork-remover";
export const DEFAULT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// A pull request has this shape in the output of: gh pr list --json state,closedAt,labels,author
// { state: "OPEN" | "CLOSED" | "MERGED", closedAt: string | null, labels: [{ name: string }], author: { login: string } }
// A tally has this shape: { merged, closedUnmerged, open, acceptanceRate }
// The acceptance rate is null when no pull request has finished.

function count(pullRequests) {
  const tally = { merged: 0, closedUnmerged: 0, open: 0 };
  for (const { state } of pullRequests) {
    if (state === "MERGED") tally.merged++;
    else if (state === "CLOSED") tally.closedUnmerged++;
    else tally.open++;
  }
  const finished = tally.merged + tally.closedUnmerged;
  return {
    ...tally,
    acceptanceRate: finished === 0 ? null : tally.merged / finished,
  };
}

// Count Hive pull requests over all time and over a trailing window.
// A finished pull request belongs to the window when it closed inside the window.
// An open pull request has no outcome, so the window reports every open pull request.
export function summarize(
  pullRequests,
  { now, windowDays, label = HIVE_PR_LABEL },
) {
  const hive = pullRequests.filter(
    ({ labels, author }) =>
      author?.login !== EXCLUDED_AUTHOR &&
      labels.some(({ name }) => name === label),
  );
  const since = now.getTime() - windowDays * DAY_MS;
  const inWindow = hive.filter(({ state, closedAt }) => {
    if (state === "OPEN") return true;
    const closed = new Date(closedAt).getTime();
    return closed >= since && closed <= now.getTime();
  });
  return { allTime: count(hive), window: count(inWindow), windowDays };
}

const percent = (rate) =>
  rate === null
    ? "n/a (no finished pull requests)"
    : `${(rate * 100).toFixed(1)}%`;

export function renderSummary(
  { allTime, window, windowDays },
  label = HIVE_PR_LABEL,
) {
  const row = (name, c) =>
    `| ${name} | ${c.merged} | ${c.closedUnmerged} | ${c.open} | ${percent(c.acceptanceRate)} |`;
  return [
    "## Hive pull request acceptance",
    "",
    `Pull requests with the \`${label}\` label. This label is unverified against a real Hive pull request.`,
    "",
    "| Period | Merged | Closed unmerged | Open | Acceptance rate |",
    "| --- | --- | --- | --- | --- |",
    row("All time", allTime),
    row(`Last ${windowDays} days`, window),
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { windowDays: DEFAULT_WINDOW_DAYS, summaryFile: undefined };
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === "--window-days") options.windowDays = Number(argv[i + 1]);
    else if (argv[i] === "--summary-file") options.summaryFile = argv[i + 1];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!Number.isFinite(options.windowDays) || options.windowDays <= 0) {
    throw new Error("--window-days must be a positive number");
  }
  return options;
}

async function listPullRequests() {
  const { stdout } = await promisify(execFile)(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      "10000",
      "--json",
      "state,closedAt,labels,author",
    ],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

async function main() {
  const { windowDays, summaryFile } = parseArgs(process.argv.slice(2));
  const markdown = renderSummary(
    summarize(await listPullRequests(), { now: new Date(), windowDays }),
  );
  console.log(markdown);
  if (summaryFile) await appendFile(summaryFile, markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
