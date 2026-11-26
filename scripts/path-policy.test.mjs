import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  FILES_JQ,
  checkPolicy,
  classify,
  escapeCommand,
  isOwned,
  labelPullRequest,
  main,
  matches,
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

test("a double star between slashes matches zero or more directories", () => {
  assert.equal(matches("a/b", "a/**/b"), true);
  assert.equal(matches("a/x/y/b", "a/**/b"), true);
  assert.equal(matches("README.md", "**/*.md"), true);
  assert.equal(matches("docs/x.md", "**/*.md"), true);
  assert.equal(matches("ab", "a/**/b"), false);
  assert.equal(matches("a/xb", "a/**/b"), false);
  assert.equal(matches("xb", "**/b"), false);
  assert.equal(matches("b", "**/b"), true);
});

test("a glob keeps its end anchor and treats other characters as text", () => {
  assert.equal(matches("docs/a", "docs/**x"), false);
  assert.equal(matches("docs/ax", "docs/**x"), true);
  assert.equal(matches("a(b)+c|d[e]{f}?.md", "a(b)+c|d[e]{f}?.md"), true);
  assert.equal(matches("ab", "a(b)"), false);
  assert.equal(matches("ab.md", "a?.md"), false);
  assert.equal(matches("a.mdx", "*.md"), false);
  assert.equal(matches("a.md.bak", "*.md"), false);
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

test("a file that no rule covers is reported and counts as the highest tier", () => {
  assert.deepEqual(classify(policy, ["mystery.bin"]), {
    areas: [],
    tier: "high",
    unmatched: ["mystery.bin"],
  });
  assert.equal(classify(policy, ["docs/a.md", "mystery.bin"]).tier, "high");
});

test("an empty list of files has no tier", () => {
  assert.deepEqual(classify(policy, []), {
    areas: [],
    tier: null,
    unmatched: [],
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

test("the plan adds missing labels and removes only the area and risk labels", () => {
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

test("the plan removes an area label that the policy no longer names", () => {
  assert.deepEqual(
    planLabels(
      policy,
      ["docs/a.md"],
      ["area/old-name", "area/docs", "risk/low"],
    ),
    { add: [], remove: ["area/old-name"] },
  );
});

test("the plan compares label names without case", () => {
  assert.deepEqual(
    planLabels(policy, ["docs/a.md"], ["Area/Docs", "risk/LOW", "Risk/High"]),
    { add: [], remove: ["Risk/High"] },
  );
});

test("the plan keeps a label that is still right", () => {
  assert.deepEqual(
    planLabels(policy, ["docs/a.md"], ["area/docs", "risk/low"]),
    {
      add: [],
      remove: [],
    },
  );
});

test("an empty pull request loses its owned labels and gains none", () => {
  assert.deepEqual(planLabels(policy, [], ["area/ci", "risk/high", "bug"]), {
    add: [],
    remove: ["area/ci", "risk/high"],
  });
});

test("a label is owned when it starts with area/ or risk/", () => {
  assert.equal(isOwned("area/anything"), true);
  assert.equal(isOwned("Risk/High"), true);
  for (const label of [
    "stage/060-reviewed",
    "role/trusted",
    "bug",
    "areas/x",
  ]) {
    assert.equal(isOwned(label), false);
  }
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
    /area must be lower case and start with/,
  ],
  [
    "an area that is only the prefix",
    { rules: [{ ...rule, area: "area/" }] },
    /area must be lower case and start with/,
  ],
  [
    "a role label as an area",
    { rules: [{ ...rule, area: "role/trusted" }] },
    /area must be lower case and start with/,
  ],
  [
    "an area with capital letters",
    { rules: [{ ...rule, area: "area/Docs" }] },
    /lower case/,
  ],
  ["no paths", { rules: [{ ...rule, paths: [] }] }, /paths must be/],
  ["an empty glob", { rules: [{ ...rule, paths: [""] }] }, /paths must be/],
  [
    "a glob that is not text",
    { rules: [{ ...rule, paths: [1] }] },
    /paths must be/,
  ],
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

test("a workflow command escape covers the percent sign and the line breaks", () => {
  assert.equal(escapeCommand("a%b\r\nc"), "a%25b%0D%0Ac");
});

function fakeGh({ files, labels, repoLabels, changed = files.length }) {
  const calls = [];
  const state = { labels: [...labels], repoLabels: [...repoLabels] };
  const run = async (args) => {
    calls.push(args);
    const route = args.find((arg) => arg.startsWith("repos/")) ?? "";
    if (args.includes("-X")) return "";
    if (route.endsWith("/pulls/7")) return `${changed}\n`;
    assert.ok(args.includes("--paginate"), `no --paginate in ${route}`);
    assert.ok(route.includes("per_page=100"), `no per_page in ${route}`);
    if (route.includes("/pulls/7/files")) {
      assert.equal(args.at(-1), FILES_JQ);
      return files.join("\n") + "\n";
    }
    if (route.includes("/issues/7/labels"))
      return state.labels.join("\n") + "\n";
    return state.repoLabels.join("\n") + "\n";
  };
  return { run, calls, state };
}

const writesOf = (calls) => calls.filter((args) => args.includes("-X"));

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
  assert.deepEqual(writesOf(calls), [
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
  assert.deepEqual(writesOf(calls), []);
});

// A real gh error holds the JSON body in stdout and a short text in stderr.
const ghError = () =>
  Object.assign(new Error("Command failed: gh api"), {
    stdout:
      '{"message":"Validation Failed","errors":[{"code":"already_exists"}]}',
    stderr: "gh: Validation Failed (HTTP 422)",
  });

test("labeling goes on when another run created the label first", async () => {
  const fake = fakeGh({ files: ["docs/a.md"], labels: [], repoLabels: [] });
  let created = 0;
  const run = async (args) => {
    if (args.includes("-X") && args.at(3) === "repos/o/r/labels") {
      created++;
      fake.state.repoLabels.push(
        args.at(5).slice("name=".length).toUpperCase(),
      );
      throw ghError();
    }
    return fake.run(args);
  };
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.equal(created, 2);
  assert.deepEqual(result.add, ["area/docs", "risk/low"]);
});

test("labeling stops when a create fails and the label is still missing", async () => {
  const fake = fakeGh({ files: ["docs/a.md"], labels: [], repoLabels: [] });
  const run = async (args) => {
    if (args.includes("-X") && args.at(3) === "repos/o/r/labels")
      throw ghError();
    return fake.run(args);
  };
  await assert.rejects(
    labelPullRequest({ repo: "o/r", number: "7", policy, run }),
    /Command failed/,
  );
});

test("labeling goes on when a person removed the label before the delete", async () => {
  const fake = fakeGh({
    files: ["docs/a.md"],
    labels: ["area/ci", "area/docs", "risk/low"],
    repoLabels: [],
  });
  const run = async (args) => {
    if (args.at(2) === "DELETE") {
      fake.state.labels = fake.state.labels.filter((l) => l !== "area/ci");
      throw ghError();
    }
    return fake.run(args);
  };
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual(result.remove, ["area/ci"]);
});

test("labeling stops when a delete fails and the label is still on the pull request", async () => {
  const fake = fakeGh({
    files: ["docs/a.md"],
    labels: ["area/ci", "area/docs", "risk/low"],
    repoLabels: [],
  });
  const run = async (args) => {
    if (args.at(2) === "DELETE") throw ghError();
    return fake.run(args);
  };
  await assert.rejects(
    labelPullRequest({ repo: "o/r", number: "7", policy, run }),
    /Command failed/,
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
    writesOf(calls).some((args) => args.at(3) === "repos/o/r/labels"),
    false,
  );
});

test("labeling sets the highest risk label and stops when the pull request has more than 3000 files", async () => {
  const { run, calls } = fakeGh({
    files: ["docs/a.md"],
    labels: ["risk/low", "area/docs", "stage/060-reviewed"],
    repoLabels: ["risk/high"],
    changed: 3001,
  });
  await assert.rejects(
    labelPullRequest({ repo: "o/r", number: "7", policy, run }),
    /3001.*risk\/high/,
  );
  assert.deepEqual(writesOf(calls), [
    [
      "api",
      "-X",
      "POST",
      "repos/o/r/issues/7/labels",
      "-f",
      "labels[]=risk/high",
    ],
    ["api", "-X", "DELETE", "repos/o/r/issues/7/labels/risk%2Flow"],
  ]);
});

for (const [name, text] of [
  ["an empty answer", ""],
  ["null", "null\n"],
  ["a fraction", "3000.5\n"],
  ["a negative number", "-1\n"],
]) {
  test(`labeling stops when the count of changed files is ${name}`, async () => {
    const fake = fakeGh({ files: ["docs/a.md"], labels: [], repoLabels: [] });
    const run = async (args) =>
      args.some((a) => a.endsWith("/pulls/7")) ? text : fake.run(args);
    await assert.rejects(
      labelPullRequest({ repo: "o/r", number: "7", policy, run }),
      /no count of changed files/,
    );
    assert.deepEqual(writesOf(fake.calls), []);
  });
}

test("labeling accepts exactly 3000 files, and renames do not count twice", async () => {
  const { run } = fakeGh({
    files: Array.from({ length: 4000 }, (_, i) => `docs/${i}.md`),
    changed: 3000,
    labels: [],
    repoLabels: [],
  });
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual(result.add, ["area/docs", "risk/low"]);
});

test("labeling reports a file that no rule covers", async () => {
  const { run } = fakeGh({
    files: ["docs/a.md", "mystery.bin"],
    labels: [],
    repoLabels: ["area/docs", "risk/high"],
  });
  const result = await labelPullRequest({
    repo: "o/r",
    number: "7",
    policy,
    run,
  });
  assert.deepEqual(result.unmatched, ["mystery.bin"]);
  assert.deepEqual(result.add, ["area/docs", "risk/high"]);
});

const jqAvailable = (() => {
  try {
    execFileSync("jq", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

test(
  "the file query lists a renamed file and its old name, and skips a null old name",
  { skip: !jqAvailable && "jq is not installed" },
  () => {
    const page = JSON.stringify([
      { filename: "a" },
      { filename: "b", previous_filename: "c" },
    ]);
    const out = execFileSync("jq", ["-r", FILES_JQ], {
      input: page,
      encoding: "utf8",
    });
    assert.deepEqual(out.split("\n").filter(Boolean), ["a", "b", "c"]);
  },
);

const policyText = readFileSync(
  new URL("../.github/policies/paths.json", import.meta.url),
  "utf8",
);

function cli(argv, options = {}) {
  const out = { log: [], error: [] };
  const done = main(argv, {
    policyText,
    log: (m) => out.log.push(m),
    error: (m) => out.error.push(m),
    ...options,
  });
  return done.then((code) => ({ code, ...out }));
}

test("the check command exits with 1 when a file has no rule and 0 when all have one", async () => {
  const bad = await cli(["check"], {
    listFiles: async () => ["docs/a.md", "mystery.bin"],
  });
  assert.equal(bad.code, 1);
  assert.match(bad.error.join("\n"), /mystery\.bin/);
  const real = await cli(["check"], {
    listFiles: async () =>
      execFileSync("git", ["ls-files", "-z"], {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
      })
        .split("\0")
        .filter(Boolean),
  });
  assert.deepEqual([real.code, real.error], [0, []]);
});

test("the label command rejects a bad number, a missing repository, and an unknown command", async () => {
  assert.equal(
    (await cli(["label", "7x"], { env: { GH_REPO: "o/r" } })).code,
    2,
  );
  assert.equal((await cli(["label"], { env: { GH_REPO: "o/r" } })).code, 2);
  const noRepo = await cli(["label", "7"], { env: {} });
  assert.equal(noRepo.code, 2);
  assert.match(noRepo.error.join(), /GH_REPO/);
  assert.equal((await cli(["other"])).code, 2);
});

test("the label command warns with an escaped message about a file with no rule", async () => {
  const fake = fakeGh({
    files: ["docs/a.md", "x%0A::error::y"],
    labels: [],
    repoLabels: ["area/docs", "risk/high"],
  });
  const result = await cli(["label", "7"], {
    env: { GH_REPO: "o/r" },
    run: fake.run,
  });
  assert.equal(result.code, 0);
  const warning = result.log.find((line) => line.startsWith("::warning::"));
  assert.match(warning, /x%250A::error::y/);
  assert.equal(warning.includes("\n"), false);
});

test("the repository policy covers every tracked file and has no dead glob", () => {
  const real = parsePolicy(policyText);
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  assert.deepEqual(checkPolicy(real, tracked), []);
});
