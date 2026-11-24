import test from "node:test";
import assert from "node:assert/strict";
import { HIVE_PR_LABEL, renderSummary, summarize } from "./pr-metrics.mjs";

const now = new Date("2026-06-30T00:00:00Z");
const pr = (state, closedAt, ...labels) => ({
  state,
  closedAt,
  labels: labels.map((name) => ({ name })),
});
const hive = (state, closedAt) => pr(state, closedAt, HIVE_PR_LABEL, "bug");

test("no matching pull requests gives zero counts and no rate", () => {
  const result = summarize(
    [pr("MERGED", "2026-06-29T00:00:00Z", "author/human"), pr("OPEN", null)],
    { now, windowDays: 30 },
  );
  for (const counts of [result.allTime, result.window]) {
    assert.deepEqual(counts, {
      merged: 0,
      closedUnmerged: 0,
      open: 0,
      acceptanceRate: null,
    });
  }
  assert.match(renderSummary(result), /n\/a/);
});

test("counts merged, closed unmerged, and open for Hive pull requests only", () => {
  const { allTime } = summarize(
    [
      hive("MERGED", "2026-06-01T00:00:00Z"),
      hive("MERGED", "2026-01-01T00:00:00Z"),
      hive("MERGED", "2026-01-02T00:00:00Z"),
      hive("CLOSED", "2026-06-02T00:00:00Z"),
      hive("OPEN", null),
      pr("MERGED", "2026-06-01T00:00:00Z", "author/clanker"),
    ],
    { now, windowDays: 30 },
  );
  assert.deepEqual(allTime, {
    merged: 3,
    closedUnmerged: 1,
    open: 1,
    acceptanceRate: 0.75,
  });
});

test("the window counts pull requests closed inside it and every open one", () => {
  const { window } = summarize(
    [
      hive("MERGED", "2026-06-20T00:00:00Z"),
      hive("CLOSED", "2026-06-25T00:00:00Z"),
      hive("MERGED", "2026-01-01T00:00:00Z"),
      hive("OPEN", null),
    ],
    { now, windowDays: 30 },
  );
  assert.deepEqual(window, {
    merged: 1,
    closedUnmerged: 1,
    open: 1,
    acceptanceRate: 0.5,
  });
});

test("only open pull requests gives no rate and no divide by zero", () => {
  const { allTime } = summarize([hive("OPEN", null)], { now, windowDays: 30 });
  assert.deepEqual(allTime, {
    merged: 0,
    closedUnmerged: 0,
    open: 1,
    acceptanceRate: null,
  });
});

test("the summary table shows the rate as a percentage", () => {
  const markdown = renderSummary(
    summarize(
      [
        hive("MERGED", "2026-06-24T00:00:00Z"),
        hive("CLOSED", "2026-06-25T00:00:00Z"),
        hive("MERGED", "2026-06-26T00:00:00Z"),
      ],
      { now, windowDays: 7 },
    ),
  );
  assert.match(markdown, /\| All time \| 2 \| 1 \| 0 \| 66\.7% \|/);
  assert.match(markdown, /\| Last 7 days \| 2 \| 1 \| 0 \| 66\.7% \|/);
});
