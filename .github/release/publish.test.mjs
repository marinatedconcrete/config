import test from "node:test";
import assert from "node:assert/strict";
import { publishRelease } from "./publish.mjs";

const candidate = {
  tag: "kustomize-example@v1.0.0",
  sha: "a".repeat(40),
  pr: 12,
  project: "kustomize-example",
  version: "1.0.0",
  kind: "component",
  notes: "Release notes.",
  prerelease: false,
};
const assets = [
  { name: "kustomize-example.yml", data: Buffer.from("kind: Namespace\n") },
];
function server() {
  const state = {
    tag: null,
    release: null,
    assets: [],
    operations: [],
    failAfter: null,
    labels: ["autorelease: pending"],
  };
  async function api(path, { method = "GET", body } = {}) {
    let result;
    const operation = `${method} ${path}`;
    state.operations.push(operation);
    if (path.startsWith("git/ref/tags/"))
      result = state.tag && { object: { type: "commit", sha: state.tag } };
    else if (path.startsWith("releases?"))
      result = state.release ? [structuredClone(state.release)] : [];
    else if (path === "git/refs") {
      state.tag = body.sha;
      result = {};
    } else if (path === "releases" && method === "POST") {
      state.release = {
        ...body,
        id: 1,
        upload_url: "https://uploads.github.com/test{?name}",
      };
      result = structuredClone(state.release);
    } else if (path === "releases/1" && method === "PATCH") {
      Object.assign(state.release, body);
      result = structuredClone(state.release);
    } else if (path.startsWith("releases/1/assets?"))
      result = state.assets.map(({ data, ...rest }) => rest);
    else if (path.startsWith("https://uploads.github.com/")) {
      const name = new URL(path).searchParams.get("name");
      const asset = {
        id: state.assets.length + 1,
        name,
        state: "uploaded",
        size: body.length,
        data: body,
      };
      state.assets.push(asset);
      result = asset;
    } else if (path.startsWith("releases/assets/")) {
      const id = Number(path.split("/").at(-1));
      if (method === "DELETE")
        state.assets = state.assets.filter((asset) => asset.id !== id);
      else result = state.assets.find((asset) => asset.id === id).data;
    } else if (path === "issues/12/labels") {
      state.labels.push(...body.labels);
      result = {};
    } else if (path.startsWith("issues/12/labels/")) {
      state.labels = state.labels.filter(
        (label) => label !== "autorelease: pending",
      );
      result = {};
    } else throw new Error(`Unexpected request: ${operation}`);
    if (state.failAfter === operation) {
      state.failAfter = null;
      throw new Error("Interrupted after server accepted the request");
    }
    return result;
  }
  return { state, api };
}

test("tag, draft, verified asset, publication, and labels occur in order", async () => {
  const { state, api } = server();
  await publishRelease({ api, candidate, assets });
  const operations = state.operations;
  assert(
    operations.indexOf("POST git/refs") < operations.indexOf("POST releases"),
  );
  assert(
    operations.indexOf("GET releases/assets/1") <
      operations.indexOf("PATCH releases/1"),
  );
  assert(
    operations.indexOf("PATCH releases/1") <
      operations.indexOf("POST issues/12/labels"),
  );
  assert.equal(state.release.draft, false);
  assert.deepEqual(state.labels, ["autorelease: tagged"]);
});

for (const operation of [
  "POST git/refs",
  "POST releases",
  "POST https://uploads.github.com/test?name=kustomize-example.yml",
  "PATCH releases/1",
  "POST issues/12/labels",
]) {
  test(`recovery after ${operation}`, async () => {
    const { state, api } = server();
    state.failAfter = operation;
    await assert.rejects(
      publishRelease({ api, candidate, assets }),
      /Interrupted/,
    );
    await publishRelease({ api, candidate, assets });
    assert.equal(state.release.draft, false);
    assert.equal(state.assets.length, 1);
    assert(!state.labels.includes("autorelease: pending"));
  });
}

test("duplicate publication does not upload or publish again", async () => {
  const { state, api } = server();
  await publishRelease({ api, candidate, assets });
  state.operations = [];
  await publishRelease({ api, candidate, assets });
  assert(
    !state.operations.some(
      (operation) =>
        operation.startsWith("POST https:") || operation === "PATCH releases/1",
    ),
  );
});

test("a different existing tag stops all writes", async () => {
  const { state, api } = server();
  state.tag = "b".repeat(40);
  await assert.rejects(
    publishRelease({ api, candidate, assets }),
    /different commit/,
  );
  assert(state.operations.every((operation) => operation.startsWith("GET ")));
});

test("changed asset content stops recovery without replacing the asset", async () => {
  const { state, api } = server();
  await publishRelease({ api, candidate, assets });
  await assert.rejects(
    publishRelease({
      api,
      candidate,
      assets: [{ ...assets[0], data: Buffer.from("different") }],
    }),
    /Rebuilt assets differ/,
  );
  assert.deepEqual(state.assets[0].data, assets[0].data);
});

test("patch-only component can publish with no assets", async () => {
  const { state, api } = server();
  await publishRelease({ api, candidate });
  assert.equal(state.release.draft, false);
  assert.deepEqual(state.assets, []);
});

test("an incomplete starter asset is replaced while the release is a draft", async () => {
  const { state, api } = server();
  state.failAfter = "POST releases";
  await assert.rejects(publishRelease({ api, candidate, assets }));
  state.assets.push({ id: 1, name: assets[0].name, state: "starter", size: 0 });
  await publishRelease({ api, candidate, assets });
  assert.equal(state.assets.length, 1);
  assert.equal(state.assets[0].state, "uploaded");
});

test("image recovery uses the first validated digest even after a different rebuild", async () => {
  const { state, api } = server();
  const image = { ...candidate, kind: "image", project: "kairos-fedora" };
  const first = `sha256:${"1".repeat(64)}`;
  const second = `sha256:${"2".repeat(64)}`;
  state.failAfter = "POST releases";
  await assert.rejects(
    publishRelease({ api, candidate: image, imageDigest: first }),
  );
  let promoted;
  await publishRelease({
    api,
    candidate: image,
    imageDigest: second,
    promote: async (_, value) => {
      promoted = value;
    },
  });
  assert.equal(promoted, first);
  assert.equal(state.release.draft, false);
});

test("failed image promotion leaves a draft and pending PR", async () => {
  const { state, api } = server();
  await assert.rejects(
    publishRelease({
      api,
      candidate: { ...candidate, kind: "image" },
      imageDigest: `sha256:${"1".repeat(64)}`,
      promote: async () => {
        throw new Error("Registry unavailable");
      },
    }),
    /Registry unavailable/,
  );
  assert.equal(state.release.draft, true);
  assert.deepEqual(state.labels, ["autorelease: pending"]);
});
