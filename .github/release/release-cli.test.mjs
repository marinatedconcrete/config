import test from "node:test";
import assert from "node:assert/strict";
import * as publishCli from "./publish-cli.mjs";
import * as recoverCli from "./recover-cli.mjs";

const repository = "marinatedconcrete/config";
const component = {
  tag: "kustomize-example@v1.0.0",
  sha: "a".repeat(40),
  pr: 12,
  project: "kustomize-example",
  version: "1.0.0",
  kind: "component",
  notes: "Release notes.",
  prerelease: false,
};
const image = {
  tag: "kairos-fedora-2026.11.1",
  sha: "b".repeat(40),
  pr: 12,
  project: "kairos-fedora",
  version: "2026.11.1",
  kind: "image",
  notes: "Release notes.",
  prerelease: false,
};
const sha256 = (byte) => `sha256:${byte.repeat(64)}`;

// The same simulated GitHub API that publish.test.mjs uses. It stores the tag,
// the release, the assets, and the pull request labels. It records every
// request so a test can prove that a check made no write.
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

// Read files from an in-memory map. A missing file raises ENOENT, like the
// real readFileSync.
const readSyncOf = (files) => (file) =>
  file in files
    ? files[file]
    : (() => {
        const error = new Error(`ENOENT: no such file, open '${file}'`);
        error.code = "ENOENT";
        throw error;
      })();

const publish = ({ files = {}, api, ...options }) =>
  publishCli.run({
    repository,
    api,
    readSync: readSyncOf(files),
    hasSync: (file) => file in files,
    appendSync: () => {},
    ...options,
  });

const recover = ({ api, ...options }) =>
  recoverCli.run({
    repository,
    api,
    appendSync: () => {},
    ...options,
  });

const manifest = (value) =>
  JSON.stringify({
    sha: component.sha,
    tag: component.tag,
    manifest: value,
  });

test("importing the CLIs does not publish or recover", () => {
  assert.equal(typeof publishCli.run, "function");
  assert.equal(typeof recoverCli.run, "function");
});

test("a component with a matching manifest publishes and records the digest", async () => {
  const { state, api } = server();
  const file = "publish-cli-step-summary.md";
  const receipt = await publishCli.run({
    candidate: component,
    repository,
    api,
    readSync: readSyncOf({
      "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n"),
      "artifacts/validation.json": manifest(true),
    }),
    hasSync: (file) =>
      file === "artifacts/kustomize-example.yml" ||
      file === "artifacts/validation.json",
    appendSync: (target, text) => {
      assert.equal(target, file);
      assert.match(text, /Published kustomize-example@v1.0.0 from a{40}\./);
      assert.match(text, /Image digest: not applicable\./);
    },
    stepSummary: file,
  });
  assert.equal(receipt.imageDigest, "");
  assert.equal(receipt.assets.length, 1);
  assert.equal(receipt.assets[0].name, "kustomize-example.yml");
  assert.equal(receipt.assets[0].size, 16);
  assert.match(receipt.assets[0].digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(state.release.draft, false);
  assert.deepEqual(state.labels, ["autorelease: tagged"]);
  assert(state.operations.includes("POST git/refs"));
  assert(state.operations.includes("POST releases"));
});

test("a component without a build artifact publishes with no asset", async () => {
  const { state, api } = server();
  await publishCli.run({
    candidate: component,
    repository,
    api,
    readSync: readSyncOf({ "artifacts/validation.json": manifest(false) }),
    hasSync: () => false,
    appendSync: () => {},
  });
  assert.equal(state.release.draft, false);
  assert.deepEqual(state.assets, []);
});

test("an empty component artifact publishes with no asset", async () => {
  const { state, api } = server();
  await publishCli.run({
    candidate: component,
    repository,
    api,
    readSync: readSyncOf({
      "artifacts/kustomize-example.yml": Buffer.alloc(0),
      "artifacts/validation.json": manifest(false),
    }),
    hasSync: () => true,
    appendSync: () => {},
  });
  assert.deepEqual(state.assets, []);
});

for (const [name, files, message] of [
  [
    "a missing validation record",
    { "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n") },
    /ENOENT/,
  ],
  [
    "an extra manifest entry",
    {
      "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n"),
      "artifacts/validation.json": manifest(false),
    },
    /Validated manifest is missing or unexpected/,
  ],
  [
    "a manifest with no entry",
    { "artifacts/validation.json": manifest(true) },
    /Validated manifest is missing or unexpected/,
  ],
]) {
  test(`${name} stops before any write`, async () => {
    const { state, api } = server();
    await assert.rejects(
      publishCli.run({
        candidate: component,
        repository,
        api,
        readSync: readSyncOf(files),
        hasSync: (file) => file in files,
        appendSync: () => {},
      }),
      message,
    );
    assert(state.operations.every((operation) => operation.startsWith("GET ")));
  });
}

test("a validation result with a different sha stops before any write", async () => {
  const { state, api } = server();
  const files = {
    "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n"),
    "artifacts/validation.json": JSON.stringify({
      sha: "f".repeat(40),
      tag: component.tag,
      manifest: true,
    }),
  };
  await assert.rejects(
    publishCli.run({
      candidate: component,
      repository,
      api,
      readSync: readSyncOf(files),
      hasSync: (file) => file in files,
      appendSync: () => {},
    }),
    /Validation result does not match the release/,
  );
  assert(state.operations.every((operation) => operation.startsWith("GET ")));
});

test("an image with notes and an SBOM publishes and promotes the digest", async () => {
  const { state, api } = server();
  const calls = [];
  const file = "publish-cli-step-summary.md";
  const receipt = await publishCli.run({
    candidate: image,
    repository,
    api,
    imageNotes: true,
    imageDigest: sha256("1"),
    readSync: readSyncOf({
      "artifacts/kairos-fedora-sbom.cdx.json": Buffer.from("{}"),
      "artifacts/kairos-fedora-notes.md": "Image notes.\n",
    }),
    hasSync: (file) => file in files,
    appendSync: (target, text) => {
      assert.equal(target, file);
      assert.match(text, /Image digest: sha256:1{64}\./);
    },
    stepSummary: file,
    promote: (image, version, digest) => calls.push([image, version, digest]),
  });
  assert.equal(receipt.imageDigest, sha256("1"));
  assert.deepEqual(calls, [
    ["ghcr.io/marinatedconcrete/kairos-fedora", "2026.11.1", sha256("1")],
  ]);
  assert.equal(state.release.draft, false);
  assert.equal(state.assets[0].name, "kairos-fedora-sbom.cdx.json");
});

test("an image without notes publishes the digest with no SBOM", async () => {
  const { state, api } = server();
  const receipt = await publishCli.run({
    candidate: image,
    repository,
    api,
    imageDigest: sha256("1"),
    readSync: readSyncOf({}),
    hasSync: () => false,
    appendSync: () => {},
    promote: () => {},
  });
  assert.equal(receipt.imageDigest, sha256("1"));
  assert.deepEqual(state.assets, []);
});

for (const [name, files, message] of [
  [
    "an empty SBOM",
    {
      "artifacts/kairos-fedora-sbom.cdx.json": Buffer.alloc(0),
      "artifacts/kairos-fedora-notes.md": "Image notes.\n",
    },
    /Image release notes or SBOM is empty/,
  ],
  [
    "missing notes",
    { "artifacts/kairos-fedora-sbom.cdx.json": Buffer.from("{}") },
    /ENOENT/,
  ],
  [
    "empty notes",
    {
      "artifacts/kairos-fedora-sbom.cdx.json": Buffer.from("{}"),
      "artifacts/kairos-fedora-notes.md": " \n",
    },
    /Image release notes or SBOM is empty/,
  ],
]) {
  test(`${name} stops before any write`, async () => {
    const { state, api } = server();
    await assert.rejects(
      publishCli.run({
        candidate: image,
        repository,
        api,
        imageNotes: true,
        imageDigest: sha256("1"),
        readSync: readSyncOf(files),
        hasSync: (file) => file in files,
        appendSync: () => {},
        promote: () => {},
      }),
      message,
    );
    assert(state.operations.every((operation) => operation.startsWith("GET ")));
  });
}

test("an image without a tested digest stops before any write", async () => {
  const { state, api } = server();
  await assert.rejects(
    publishCli.run({
      candidate: image,
      repository,
      api,
      imageDigest: "",
      readSync: readSyncOf({}),
      hasSync: () => false,
      appendSync: () => {},
      promote: () => {},
    }),
    /Missing tested image digest/,
  );
  assert(state.operations.every((operation) => operation.startsWith("GET ")));
});

test("a failed promotion stops before the summary is written", async () => {
  const { state, api } = server();
  let summary = 0;
  await assert.rejects(
    publishCli.run({
      candidate: image,
      repository,
      api,
      imageDigest: sha256("1"),
      readSync: readSyncOf({}),
      hasSync: () => false,
      appendSync: () => {
        summary += 1;
      },
      promote: () => {
        throw new Error("Registry unavailable");
      },
    }),
    /Registry unavailable/,
  );
  assert.equal(summary, 0);
  assert.equal(state.release.draft, true);
  assert.deepEqual(state.labels, ["autorelease: pending"]);
});

test("a published release recovers with no write", async () => {
  const { state, api } = server();
  await publish({
    api,
    candidate: component,
    files: {
      "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n"),
      "artifacts/validation.json": manifest(true),
    },
  });
  state.operations = [];
  const file = "recover-cli-output.txt";
  const recovered = await recoverCli.run({
    candidate: component,
    repository,
    api,
    appendSync: (target, text) => {
      assert.equal(target, file);
      assert.equal(text, "recovered=true\n");
    },
    githubOutput: file,
  });
  assert.equal(recovered, true);
  assert(
    state.operations
      .filter((operation) => !operation.startsWith("GET "))
      .every((operation) => operation.includes("issues/12/labels")),
  );
  assert(!state.labels.includes("autorelease: pending"));
});

test("an image recovery verifies the saved digest before it reports true", async () => {
  const { state, api } = server();
  await publish({
    api,
    candidate: image,
    imageDigest: sha256("1"),
    promote: () => {},
  });
  state.operations = [];
  const calls = [];
  const recovered = await recoverCli.run({
    candidate: image,
    repository,
    api,
    verify: (image, version, digest) => calls.push([image, version, digest]),
    appendSync: () => {},
  });
  assert.equal(recovered, true);
  assert.deepEqual(calls, [
    ["ghcr.io/marinatedconcrete/kairos-fedora", "2026.11.1", sha256("1")],
  ]);
  assert(
    state.operations
      .filter((operation) => !operation.startsWith("GET "))
      .every((operation) => operation.includes("issues/12/labels")),
  );
});

test("a missing or draft release recovers as false with no write", async () => {
  const { state, api } = server();
  assert.equal(await recover({ candidate: component, api }), false);
  state.failAfter = "POST releases";
  await assert.rejects(
    publish({
      api,
      candidate: component,
      files: {
        "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n"),
        "artifacts/validation.json": manifest(true),
      },
    }),
    /Interrupted/,
  );
  state.operations = [];
  assert.equal(await recover({ candidate: component, api }), false);
  assert(state.operations.every((operation) => operation.startsWith("GET ")));
});

test("a recovery with a different tag stops before any write", async () => {
  const { state, api } = server();
  await publish({
    api,
    candidate: component,
    files: {
      "artifacts/kustomize-example.yml": Buffer.from("kind: Namespace\n"),
      "artifacts/validation.json": manifest(true),
    },
  });
  state.tag = "c".repeat(40);
  state.operations = [];
  await assert.rejects(
    recover({ candidate: component, api, appendSync: () => {} }),
    /Published tag does not match the release commit/,
  );
  assert(state.operations.every((operation) => operation.startsWith("GET ")));
});

test("a failed image verification stops before any write", async () => {
  const { state, api } = server();
  await publish({
    api,
    candidate: image,
    imageDigest: sha256("1"),
    promote: () => {},
  });
  state.operations = [];
  await assert.rejects(
    recoverCli.run({
      candidate: image,
      repository,
      api,
      verify: () => {
        throw new Error("Registry unavailable");
      },
      appendSync: () => {},
    }),
    /Registry unavailable/,
  );
  assert(state.operations.every((operation) => operation.startsWith("GET ")));
});
