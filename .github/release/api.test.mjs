import test from "node:test";
import assert from "node:assert/strict";
import { githubApi, tagCommit } from "./api.mjs";

test("only a 404 is treated as a missing resource", async () => {
  const api = githubApi(
    "example/config",
    "unused",
    async () => new Response("Forbidden", { status: 403 }),
  );
  await assert.rejects(api("releases", { missing: true }), /403/);
});

test("annotated tags resolve to the commit", async () => {
  const api = async (path) =>
    path.startsWith("git/ref/")
      ? { object: { type: "tag", sha: "annotation" } }
      : { object: { type: "commit", sha: "a".repeat(40) } };
  assert.equal(await tagCommit(api, "example@v1"), "a".repeat(40));
});

for (const cyclic of [true, false]) {
  test(`${cyclic ? "cyclic" : "deep"} annotated tags stop within 16 annotation lookups`, async () => {
    let calls = 0;
    const api = async () => {
      calls++;
      return { object: { type: "tag", sha: cyclic ? "same" : String(calls) } };
    };
    await assert.rejects(
      tagCommit(api, "example@v1"),
      /traversal limit or contains a cycle/,
    );
    assert(calls <= 17);
  });
}
