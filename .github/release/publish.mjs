import { createHash } from "node:crypto";
import { allPages, tagCommit } from "./api.mjs";

const marker = /<!-- config-release: ([A-Za-z0-9+/=]+) -->\s*$/;
export const digest = (data) =>
  `sha256:${createHash("sha256").update(data).digest("hex")}`;
const identity = ({ tag, sha, project, version, pr }) => ({
  tag,
  sha,
  project,
  version,
  pr,
});

export async function publishRelease({
  api,
  candidate,
  assets = [],
  imageDigest = "",
  promote,
}) {
  const { tag, sha, pr } = candidate;
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid release commit");
  const existingSha = await tagCommit(api, tag);
  if (existingSha && existingSha !== sha)
    throw new Error("Existing tag points to a different commit");
  let release = (await allPages(api, "releases")).find(
    (item) => item.tag_name === tag,
  );
  const built = {
    ...identity(candidate),
    imageDigest,
    assets: assets.map(({ name, data }) => ({
      name,
      digest: digest(data),
      size: data.length,
    })),
  };
  if (
    candidate.kind === "image" &&
    !/^sha256:[a-f0-9]{64}$/.test(imageDigest)
  ) {
    throw new Error("Missing tested image digest");
  }
  let receipt = built;
  if (release) {
    const match = release.body?.match(marker);
    if (!match) throw new Error("Existing release has no validation receipt");
    receipt = JSON.parse(Buffer.from(match[1], "base64").toString());
    if (
      JSON.stringify(identity(receipt)) !== JSON.stringify(identity(candidate))
    ) {
      throw new Error("Existing release identifies a different candidate");
    }
    if (JSON.stringify(receipt.assets) !== JSON.stringify(built.assets)) {
      throw new Error("Rebuilt assets differ from the validated assets");
    }
    if (
      candidate.kind === "image" &&
      !/^sha256:[a-f0-9]{64}$/.test(receipt.imageDigest)
    ) {
      throw new Error("Existing receipt has no tested image digest");
    }
  }
  // Create the tag only after all validation jobs have passed.
  if (!existingSha)
    await api("git/refs", {
      method: "POST",
      body: { ref: `refs/tags/${tag}`, sha },
    });
  if (!release) {
    const record = Buffer.from(JSON.stringify(receipt)).toString("base64");
    release = await api("releases", {
      method: "POST",
      body: {
        tag_name: tag,
        target_commitish: sha,
        name: candidate.name || tag,
        body: `${candidate.notes}\n\n<!-- config-release: ${record} -->`,
        draft: true,
        prerelease: candidate.prerelease,
      },
    });
  }
  // Reuse the first validated image after an interrupted publication.
  if (candidate.kind === "image") await promote(candidate, receipt.imageDigest);
  const remoteAssets = await allPages(api, `releases/${release.id}/assets`);
  for (const asset of assets) {
    let remote = remoteAssets.find((item) => item.name === asset.name);
    if (remote?.state === "starter" && release.draft) {
      await api(`releases/assets/${remote.id}`, { method: "DELETE" });
      remote = null;
    }
    if (!remote) {
      if (!release.draft)
        throw new Error("Published release is missing an asset");
      const upload = release.upload_url.split("{")[0];
      remote = await api(`${upload}?name=${encodeURIComponent(asset.name)}`, {
        method: "POST",
        body: asset.data,
      });
    }
    if (remote.state !== "uploaded" || remote.size !== asset.data.length)
      throw new Error("Incomplete release asset");
    const downloaded = await api(`releases/assets/${remote.id}`, {
      binary: true,
    });
    if (digest(downloaded) !== digest(asset.data))
      throw new Error("Release asset content differs");
  }
  if ((await tagCommit(api, tag)) !== sha)
    throw new Error("Release tag changed during publication");
  if (release.draft)
    await api(`releases/${release.id}`, {
      method: "PATCH",
      body: { draft: false },
    });
  await api(`issues/${pr}/labels`, {
    method: "POST",
    body: { labels: ["autorelease: tagged"] },
  });
  await api(
    `issues/${pr}/labels/${encodeURIComponent("autorelease: pending")}`,
    { method: "DELETE", missing: true },
  );
  return receipt;
}
