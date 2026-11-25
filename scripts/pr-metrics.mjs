// Report how many pull requests opened by Hive agents were accepted.
//
// Only pull requests that carry one of HIVE_PR_LABELS count. People are ignored.
// Pull requests that EXCLUDED_AUTHOR opened never count, even with the label.
//
// The author/hive label marks pull requests from the Hive swarm.
// The author/clanker label marks pull requests from other people that use the Hive contribution flow.
// Both are Hive work, so both count.
//
// Usage: node scripts/pr-metrics.mjs [--window-days N] [--summary-file PATH]
// The script needs the gh CLI with read access to pull requests.
import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const HIVE_PR_LABELS = ["author/hive", "author/clanker"];
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
  { now, windowDays, labels: hiveLabels = HIVE_PR_LABELS },
) {
  const hive = pullRequests.filter(
    ({ labels, author }) =>
      author?.login !== EXCLUDED_AUTHOR &&
      labels.some(({ name }) => hiveLabels.includes(name)),
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
  hiveLabels = HIVE_PR_LABELS,
) {
  const row = (name, c) =>
    `| ${name} | ${c.merged} | ${c.closedUnmerged} | ${c.open} | ${percent(c.acceptanceRate)} |`;
  return [
    "## Hive pull request acceptance",
    "",
    `Pull requests with one of these labels: ${hiveLabels.map((l) => `\`${l}\``).join(", ")}.`,
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
