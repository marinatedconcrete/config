import test from "node:test";
import assert from "node:assert/strict";
import { run } from "./plan.mjs";

const sha = "b".repeat(40);

function context() {
  return async () => ({
    manifest: {
      async buildReleases() {
        return [
          {
            pullRequest: { number: 894 },
            tag: {
              version: { toString: () => "1.0.0" },
              toString: () => "v1.0.0",
            },
            sha,
            path: "kustomization/components/pod-security-enforce-privileged",
            notes: "notes",
            name: "kustomize-pod-security-enforce-privileged",
            prerelease: false,
          },
        ];
      },
    },
    api: async (endpoint) => {
      if (endpoint.startsWith("pulls/")) {
        return {
          number: 894,
          merged: true,
          base: { ref: "main" },
          merge_commit_sha: sha,
        };
      }
      return {
        content: Buffer.from(
          JSON.stringify({
            "kustomization/components/pod-security-enforce-privileged": "1.0.0",
          }),
        ).toString("base64"),
      };
    },
    github: {},
    requested: "",
  });
}

test("the entry point writes a single candidate to the output file", async () => {
  const written = [];
  const logged = [];
  const result = await run({
    createContext: context(),
    appendSync: (file, text) => written.push([file, text]),
    output: "github_output",
    log: (value) => logged.push(value),
  });
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(written.length, 1);
  assert.equal(written[0][0], "github_output");
  assert.match(written[0][1], /^candidates=\[.*\]$/m);
  assert.match(written[0][1], /^errors=\[\]$/m);
  const candidates = JSON.parse(
    written[0][1]
      .split("\n")
      .find((line) => line.startsWith("candidates="))
      .slice("candidates=".length),
  );
  assert.equal(candidates[0].tag, "v1.0.0");
  assert.equal(candidates[0].sha, sha);
  assert.equal(candidates[0].pr, 894);
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0], [{ tag: "v1.0.0", sha, pr: 894 }]);
});

test("the entry point writes an empty plan when no release is pending", async () => {
  const written = [];
  const result = await run({
    createContext: async () => ({
      manifest: {
        async buildReleases() {
          return [];
        },
      },
    }),
    appendSync: (file, text) => written.push([file, text]),
    output: "github_output",
    log: () => {},
  });
  assert.deepEqual(result, { candidates: [], errors: [] });
  assert.match(written[0][1], /^candidates=\[\]$/m);
  assert.match(written[0][1], /^errors=\[\]$/m);
});

test("the entry point writes a planning error to the output file", async () => {
  const written = [];
  const result = await run({
    createContext: async () => {
      throw new Error("API unavailable");
    },
    appendSync: (file, text) => written.push([file, text]),
    output: "github_output",
    log: () => {},
  });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Release planning:/);
  assert.match(written[0][1], /^candidates=\[\]$/m);
  assert.match(written[0][1], /errors=\[.*Release planning:/m);
});
