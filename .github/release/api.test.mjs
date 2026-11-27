import test from "node:test";
import assert from "node:assert/strict";
import { githubApi, allPages, tagCommit } from "./api.mjs";

// A transport that records each request and returns a fixed response.
const recording = (response) => {
  const requests = [];
  const transport = (url, options) => {
    requests.push({ url, options });
    return Promise.resolve(response);
  };
  return { transport, requests };
};

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

test("a buffer body is sent with an octet-stream content type", async () => {
  const { transport, requests } = recording(
    new Response(null, { status: 204 }),
  );
  const api = githubApi("example/config", "unused", transport);
  const data = Buffer.from("asset bytes");
  await api("releases/1/assets", { method: "POST", body: data });
  const { options } = requests[0];
  assert.equal(options.headers["Content-Type"], "application/octet-stream");
  assert.equal(options.body, data);
});

test("a plain body is sent as json", async () => {
  const { transport, requests } = recording(
    new Response(null, { status: 204 }),
  );
  const api = githubApi("example/config", "unused", transport);
  await api("releases", { method: "POST", body: { name: "a release" } });
  const { options } = requests[0];
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), { name: "a release" });
});

test("an absolute path is sent to the transport unchanged", async () => {
  const { transport, requests } = recording(
    new Response(null, { status: 204 }),
  );
  const api = githubApi("example/config", "unused", transport);
  const url = "https://uploads.github.com/test?name=a.yml";
  await api(url, { method: "POST", body: Buffer.from("data") });
  assert.equal(requests[0].url, url);
});

test("a 204 response is a null result", async () => {
  const { transport } = recording(new Response(null, { status: 204 }));
  const api = githubApi("example/config", "unused", transport);
  assert.equal(await api("releases/1/assets/2", { method: "DELETE" }), null);
});

test("a missing 404 is a null result", async () => {
  const { transport } = recording(new Response("No tag", { status: 404 }));
  const api = githubApi("example/config", "unused", transport);
  assert.equal(await api("git/ref/tags/x", { missing: true }), null);
});

test("a non 2xx response is an error with the status and body", async () => {
  const { transport } = recording(new Response("Nope", { status: 500 }));
  const api = githubApi("example/config", "unused", transport);
  await assert.rejects(api("releases"), /GitHub GET releases: 500 Nope/);
});

test("a binary response is a buffer with the octet-stream accept", async () => {
  const { transport, requests } = recording(
    new Response("binary-data", { status: 200 }),
  );
  const api = githubApi("example/config", "unused", transport);
  const result = await api("releases/assets/2", { binary: true });
  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.toString(), "binary-data");
  assert.equal(
    requests[0].options.headers["Accept"],
    "application/octet-stream",
  );
});

test("a json response is parsed with the default accept", async () => {
  const { transport, requests } = recording(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  const api = githubApi("example/config", "unused", transport);
  assert.deepEqual(await api("releases/1"), { ok: true });
  assert.equal(
    requests[0].options.headers["Accept"],
    "application/vnd.github+json",
  );
});

test("allPages stops on a short final page", async () => {
  let calls = 0;
  const api = async (path) => {
    calls++;
    const page = Number(new URL(`https://x/${path}`).searchParams.get("page"));
    return page === 1 ? new Array(100).fill(1) : [2];
  };
  const result = await allPages(api, "releases");
  assert.equal(result.length, 101);
  assert.equal(calls, 2);
  assert.equal(result.at(-1), 2);
});

test("allPages uses an ampersand when the path has a query", async () => {
  const paths = [];
  const api = async (path) => {
    paths.push(path);
    return [];
  };
  await allPages(api, "releases?state=open");
  assert.equal(paths.length, 1);
  assert.equal(paths[0], "releases?state=open&per_page=100&page=1");
});

test("allPages follows a full first page to the next page", async () => {
  const pages = [new Array(100).fill(1), new Array(100).fill(2), [3]];
  const api = async () => pages.shift();
  const result = await allPages(api, "releases");
  assert.equal(result.length, 201);
  assert.equal(result.at(-1), 3);
});

test("a tag that is not a commit is an error", async () => {
  const api = async () => ({ object: { type: "blob", sha: "b" } });
  await assert.rejects(
    tagCommit(api, "example@v1"),
    /does not identify a commit/,
  );
});

test("a missing tag is a null result", async () => {
  const api = async () => null;
  assert.equal(await tagCommit(api, "example@v1"), null);
});

test("an unannotated tag resolves to its commit", async () => {
  const api = async () => ({
    object: { type: "commit", sha: "c".repeat(40) },
  });
  assert.equal(await tagCommit(api, "example@v1"), "c".repeat(40));
});
