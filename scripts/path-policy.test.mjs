import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  checkPolicy,
  classify,
  labelPullRequest,
  matches,
  ownedLabels,
  parsePolicy,
  planLabels,
} from "./path-policy.mjs";

const policy = parsePolicy(
  JSON.stringify({
    rules: [
      { tier: "high", area: "area/ci", paths: [".github/workflows/**"] },
      {
        tier: "medium",
        area: "area/kustomization",
        paths: ["kustomization/**"],
      },
      { tier: "low", area: "area/docs", paths: ["docs/**", "*.md"] },
    ],
  }),
);

test("a double star matches nested paths and names that start with a dot", () => {
  assert.equal(matches("kustomization/a/b/c.yml", "kustomization/**"), true);
  assert.equal(matches("ansible/.config/lint.yml", "ansible/**"), true);
  assert.equal(
    matches(".github/release/.gitignore", ".github/release/**"),
    true,
  );
});

test("a single star stops at a slash and a dot is not a wildcard", () => {
  assert.equal(matches("README.md", "*.md"), true);
  assert.equal(matches("docs/README.md", "*.md"), false);
  assert.equal(matches("README-md", "*.md"), false);
  assert.equal(
    matches(
      ".github/workflows/release-a.yml",
      ".github/workflows/release-*.yml",
    ),
    true,
  );
});

test("a glob matches the whole path, not a part of it", () => {
  assert.equal(matches("x/docs/a.md", "docs/**"), false);
  assert.equal(matches("docs", "docs/**"), false);
});

test("a change gets the area of each rule and the highest tier", () => {
  assert.deepEqual(
    classify(policy, ["docs/a.md", ".github/workflows/ci.yml"]),
    { areas: ["area/ci", "area/docs"], tier: "high", unmatched: [] },
  );
  assert.deepEqual(classify(policy, ["README.md"]), {
    areas: ["area/docs"],
    tier: "low",
    unmatched: [],
  });
});

test("the highest tier wins when the high file comes first", () => {
  assert.equal(
    classify(policy, [".github/workflows/ci.yml", "docs/a.md"]).tier,
    "high",
  );
});

test("a file that no rule covers is reported and does not set the tier", () => {
  assert.deepEqual(classify(policy, ["mystery.bin"]), {
    areas: [],
    tier: null,
    unmatched: ["mystery.bin"],
  });
});

test("two rules that match one file give the higher tier", () => {
  const both = parsePolicy(
    JSON.stringify({
      rules: [
        { tier: "low", area: "area/docs", paths: ["a/**"] },
        { tier: "high", area: "area/ci", paths: ["a/b.yml"] },
      ],
    }),
  );
  assert.equal(classify(both, ["a/b.yml"]).tier, "high");
});

test("the plan adds missing labels and removes only labels that the policy owns", () => {
  const plan = planLabels(
    policy,
    ["docs/a.md"],
    ["area/ci", "risk/high", "stage/050-review-pending", "bug"],
  );
  assert.deepEqual(plan, {
    add: ["area/docs", "risk/low"],
    remove: ["area/ci", "risk/high"],
  });
});

test("the plan keeps a label that is still right", () => {
  assert.deepEqual(
    planLabels(policy, ["docs/a.md"], ["area/docs", "risk/low"]),
    { add: [], remove: [] },
  );
});

test("a pull request with no covered file loses its owned labels and gains none", () => {
  assert.deepEqual(
    planLabels(policy, ["mystery.bin"], ["area/ci", "risk/high"]),
    {
      add: [],
      remove: ["area/ci", "risk/high"],
    },
  );
});

test("the owned labels are the areas and the three risk labels", () => {
  assert.deepEqual([...ownedLabels(policy)].sort(), [
    "area/ci",
    "area/docs",
    "area/kustomization",
    "risk/high",
    "risk/low",
    "risk/medium",
  ]);
});

const rule = { tier: "low", area: "area/docs", paths: ["docs/**"] };
for (const [name, change, message] of [
  ["no rules", { rules: [] }, /non-empty list/],
  [
    "a bad tier",
    { rules: [{ ...rule, tier: "urgent" }] },
    /tier must be one of/,
  ],
  [
    "an area with no prefix",
    { rules: [{ ...rule, area: "docs" }] },
    /area must start with/,
  ],
  [
    "an area that is only the prefix",
    { rules: [{ ...rule, area: "area/" }] },
    /area must start with/,
  ],
  [
    "a role label as an area",
    { rules: [{ ...rule, area: "role/trusted" }] },
    /area must start with/,
  ],
  ["no paths", { rules: [{ ...rule, paths: [] }] }, /paths must be/],
  ["an empty glob", { rules: [{ ...rule, paths: [""] }] }, /paths must be/],
]) {
  test(`the policy parser rejects ${name}`, () => {
    assert.throws(() => parsePolicy(JSON.stringify(change)), message);
  });
}

test("the check reports an uncovered file and a glob that matches nothing", () => {
  const errors = checkPolicy(policy, ["docs/a.md", "mystery.bin"]);
  assert.equal(
    errors.some((e) => e.includes('"mystery.bin"')),
    true,
  );
  assert.equal(
    errors.some((e) => e.includes('"kustomization/**"')),
    true,
  );
  assert.equal(
    errors.some((e) => e.includes('"docs/**"')),
    false,
  );
});

function fakeGh({ files, labels, repoLabels }) {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    const target = args.find((arg) => arg.startsWith("repos/")) ?? "";
    if (args[0] === "api" && !args.includes("-X")) {
      if (target.endsWith("/files")) return files.join("\n") + "\n";
      if (target.endsWith("/issues/7/labels")) return labels.join("\n") + "\n";
      if (target.endsWith("/labels")) return repoLabels.join("\n") + "\n";
    }
    return "";
  };
  return { run, calls };
}

test("labeling creates a missing label, adds with POST, and deletes with an encoded name", async () => {
  const { run, calls } = fakeGh({
    files: ["docs/a.md"],
    labels: ["area/ci", "role/trusted"],
    repoLabels: ["area/ci", "area/docs", "role/trusted"],
  });
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual(result.add, ["area/docs", "risk/low"]);
  assert.deepEqual(result.remove, ["area/ci"]);
  const writes = calls.filter((args) => args.includes("-X"));
  assert.deepEqual(writes, [
    [
      "api",
      "-X",
      "POST",
      "repos/o/r/labels",
      "-f",
      "name=risk/low",
      "-f",
      "color=ededed",
    ],
    [
      "api",
      "-X",
      "POST",
      "repos/o/r/issues/7/labels",
      "-f",
      "labels[]=area/docs",
      "-f",
      "labels[]=risk/low",
    ],
    ["api", "-X", "DELETE", "repos/o/r/issues/7/labels/area%2Fci"],
  ]);
});

test("labeling a pull request that is already right makes no write", async () => {
  const { run, calls } = fakeGh({
    files: ["docs/a.md"],
    labels: ["area/docs", "risk/low", "stage/060-reviewed"],
    repoLabels: [],
  });
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual([result.add, result.remove], [[], []]);
  assert.equal(
    calls.some((args) => args.includes("-X")),
    false,
  );
});

test("labeling ignores a label that another run created first", async () => {
  const { run: base } = fakeGh({
    files: ["docs/a.md"],
    labels: [],
    repoLabels: [],
  });
  const run = async (args) => {
    if (args.includes("-X") && args.at(3) === "repos/o/r/labels") {
      throw Object.assign(new Error("failed"), { stderr: "already_exists" });
    }
    return base(args);
  };
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual(result.add, ["area/docs", "risk/low"]);
});

test("labeling stops on any other error when it creates a label", async () => {
  const { run: base } = fakeGh({
    files: ["docs/a.md"],
    labels: [],
    repoLabels: [],
  });
  const run = async (args) => {
    if (args.includes("-X") && args.at(3) === "repos/o/r/labels") {
      throw Object.assign(new Error("failed"), { stderr: "403" });
    }
    return base(args);
  };
  await assert.rejects(
    labelPullRequest({ repo: "o/r", number: "7", policy, run }),
    /failed/,
  );
});

test("a label that differs only in case is not created again", async () => {
  const { run, calls } = fakeGh({
    files: ["docs/a.md"],
    labels: [],
    repoLabels: ["Area/Docs", "risk/LOW"],
  });
  await labelPullRequest({ repo: "o/r", number: "7", policy, run });
  assert.equal(
    calls.some((a) => a.includes("repos/o/r/labels") && a.includes("-X")),
    false,
  );
});

test("labeling stops when the file list may be cut at 3000", async () => {
  const files = Array.from({ length: 3000 }, (_, i) => `docs/${i}.md`);
  const { run } = fakeGh({ files, labels: [], repoLabels: [] });
  await assert.rejects(
    labelPullRequest({ repo: "o/r", number: "7", policy, run }),
    /3000/,
  );
});

test("labeling reports a file that no rule covers", async () => {
  const { run } = fakeGh({
    files: ["docs/a.md", "mystery.bin"],
    labels: [],
    repoLabels: ["area/docs", "risk/low"],
  });
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual(result.unmatched, ["mystery.bin"]);
});

test("the file query asks for the old path of a renamed file", async () => {
  const { run, calls } = fakeGh({
    files: ["docs/a.md", ".github/workflows/old.yml"],
    labels: [],
    repoLabels: [],
  });
  await labelPullRequest({ repo: "o/r", number: "7", policy, run });
  const filesCall = calls.find(
    (args) => args.at(-3) === "--jq" || args.includes("--jq"),
  );
  assert.match(filesCall.at(-1), /previous_filename/);
});

test("the repository policy covers every tracked file and has no dead glob", () => {
  const real = parsePolicy(
    readFileSync(
      new URL("../.github/policies/paths.json", import.meta.url),
      "utf8",
    ),
  );
  const tracked = execFileSync("git", ["ls-files"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(checkPolicy(real, tracked), []);
});
