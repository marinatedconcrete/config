import test from "node:test";
import assert from "node:assert/strict";
import { Manifest } from "release-please";
import { planReleases } from "./plan.mjs";

const sha = "a".repeat(40);
const path = "kustomization/components/pod-security-enforce-privileged";
function fixture({ version = "1.0.0", merged = true, tagged = false } = {}) {
  const pr = {
    number: 894,
    sha,
    headBranchName:
      "release-please--branches--main--components--kustomize-pod-security-enforce-privileged",
    baseBranchName: "main",
    title:
      "chore(main): release kustomize-pod-security-enforce-privileged 1.0.0",
    body: ":robot: I have created a release *beep* *boop*\n---\n\n## 1.0.0 (2026-09-19)\n\n### Features\n\n* Add Namespace labels.\n\n---\nThis PR was generated with [Release Please](https://github.com/googleapis/release-please).",
    labels: [tagged ? "autorelease: tagged" : "autorelease: pending"],
    files: [],
  };
  const github = {
    repository: { owner: "example", repo: "config" },
    async getPullRequest() {
      const { sha: unused, ...rest } = pr;
      return rest;
    },
    async *pullRequestIterator() {
      yield pr;
    },
  };
  const manifest = new Manifest(
    github,
    "main",
    {
      [path]: {
        releaseType: "simple",
        packageName: "kustomize-pod-security-enforce-privileged",
        includeComponentInTag: true,
        includeVInTag: true,
        tagSeparator: "@",
      },
    },
    {},
  );
  const api = async (endpoint) => {
    if (endpoint === "pulls/894")
      return {
        number: 894,
        merged,
        base: { ref: "main" },
        merge_commit_sha: sha,
      };
    assert.equal(endpoint, `contents/.release-please-manifest.json?ref=${sha}`);
    return {
      content: Buffer.from(JSON.stringify({ [path]: version })).toString(
        "base64",
      ),
    };
  };
  return { github, manifest, api };
}

test("Release Please selects the version and merge SHA without creating a tag", async () => {
  const [release] = await planReleases(fixture());
  assert.equal(release.version, "1.0.0");
  assert.equal(release.tag, "kustomize-pod-security-enforce-privileged@v1.0.0");
  assert.equal(release.sha, sha);
  assert.equal(release.kind, "component");
});

test("manual recovery obtains the merge SHA omitted by getPullRequest", async () => {
  const [release] = await planReleases({
    ...fixture({ tagged: true }),
    requested: "894",
  });
  assert.equal(release.sha, sha);
});

test("version mismatch stops planning", async () => {
  await assert.rejects(
    planReleases(fixture({ version: "2.0.0" })),
    /version does not match/,
  );
});

test("unmerged PR cannot be recovered", async () => {
  await assert.rejects(
    planReleases({ ...fixture({ merged: false }), requested: "894" }),
    /must be merged/,
  );
});

test("invalid recovery input is rejected before API calls", async () => {
  await assert.rejects(
    planReleases({ requested: "main; echo bad" }),
    /Invalid/,
  );
});

test("an older PR keeps its version when newer releases exist", async () => {
  const context = fixture({ tagged: true });
  context.github.releaseIterator = async function* () {
    yield {
      tagName: "kustomize-pod-security-enforce-privileged@v2.0.0",
      sha: "b".repeat(40),
    };
  };
  const [release] = await planReleases({ ...context, requested: "894" });
  assert.equal(release.version, "1.0.0");
  assert.equal(release.sha, sha);
});

for (const [project, version, prerelease] of [
  ["kairos-fedora", "0.10.0", false],
  ["vscode-ssh-server", "0.1.6", true],
]) {
  test(`Release Please preserves ${project} image version and prerelease setting`, async () => {
    const imagePath = `images/${project}`;
    const pr = {
      number: 894,
      sha,
      headBranchName: `release-please--branches--main--components--${project}`,
      baseBranchName: "main",
      title: `chore(main): release ${project} ${version}`,
      body: `:robot: I have created a release *beep* *boop*\n---\n\n## ${version} (2026-09-19)\n\n### Features\n\n* Update the image.\n\n---\nThis PR was generated with [Release Please](https://github.com/googleapis/release-please).`,
      labels: ["autorelease: pending"],
      files: [],
    };
    const github = {
      repository: { owner: "example", repo: "config" },
      async *pullRequestIterator() {
        yield pr;
      },
    };
    const manifest = new Manifest(
      github,
      "main",
      {
        [imagePath]: {
          releaseType: "simple",
          packageName: project,
          includeComponentInTag: true,
          includeVInTag: false,
          tagSeparator: "-",
          prerelease,
        },
      },
      {},
    );
    const api = async (endpoint) =>
      endpoint.startsWith("pulls/")
        ? {
            number: 894,
            merged: true,
            base: { ref: "main" },
            merge_commit_sha: sha,
          }
        : {
            content: Buffer.from(
              JSON.stringify({ [imagePath]: version }),
            ).toString("base64"),
          };
    const [release] = await planReleases({ github, api, manifest });
    assert.equal(release.tag, `${project}-${version}`);
    assert.equal(release.version, version);
    assert.equal(release.prerelease, prerelease);
    assert.equal(release.kind, "image");
    await assert.rejects(
      planReleases({
        github,
        manifest,
        api: (endpoint, options) =>
          endpoint.includes("release-package.yml")
            ? null
            : api(endpoint, options),
      }),
      /predates validated publication/,
    );
  });
}
