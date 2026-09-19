import { appendFileSync } from "node:fs";
import { GitHub, Manifest } from "release-please";
import { githubApi } from "./api.mjs";

export async function planReleases({ github, api, manifest, requested = "" }) {
  if (requested && !/^[1-9][0-9]*$/.test(requested))
    throw new Error("Invalid release PR number");
  // Use the specified PR even when it is outside the automatic search window.
  if (requested) {
    const pr = await github.getPullRequest(Number(requested));
    const details = await api(`pulls/${requested}`);
    if (!details.merged || details.base.ref !== "main")
      throw new Error("The release PR must be merged into main");
    if (
      !pr.labels.includes("autorelease: pending") &&
      !pr.labels.includes("autorelease: tagged")
    ) {
      throw new Error("The PR does not have a release label");
    }
    github.pullRequestIterator = async function* () {
      yield {
        ...pr,
        sha: details.merge_commit_sha,
        labels: [...pr.labels, "autorelease: pending"],
      };
    };
  }
  const releases = await manifest.buildReleases();
  const candidates = [];
  for (const release of releases) {
    const pr = await api(`pulls/${release.pullRequest.number}`);
    const version = release.tag.version.toString();
    if (
      !pr.merged ||
      pr.base.ref !== "main" ||
      release.sha !== pr.merge_commit_sha
    ) {
      throw new Error("Release source does not match the merged PR");
    }
    const content = await api(
      `contents/.release-please-manifest.json?ref=${release.sha}`,
    );
    const versions = JSON.parse(
      Buffer.from(content.content, "base64").toString(),
    );
    if (versions[release.path] !== version)
      throw new Error("Release version does not match the selected commit");
    const project = release.path.startsWith("kustomization/components/")
      ? `kustomize-${release.path.split("/").at(-1)}`
      : release.path.startsWith("images/")
        ? release.path.split("/").at(-1)
        : release.path;
    const kind = project.startsWith("kustomize-")
      ? "component"
      : [
            "kairos-fedora",
            "buildah-action-runner",
            "github-runner-ci",
            "vscode-ssh-server",
          ].includes(project)
        ? "image"
        : ["ansible", "renovate"].includes(project)
          ? "source"
          : null;
    if (!kind || !/^[a-z0-9-]+$/.test(project))
      throw new Error(`Unsupported release path: ${release.path}`);
    // Old tag workflows can rebuild and replace the version image.
    if (kind === "image") {
      const protocol = await api(
        `contents/.github/workflows/release-package.yml?ref=${release.sha}`,
        { missing: true },
      );
      if (!protocol)
        throw new Error(
          "Image commit predates validated publication; use a new release PR",
        );
    }
    candidates.push({
      project,
      kind,
      path: release.path,
      tag: release.tag.toString(),
      version,
      sha: release.sha,
      pr: pr.number,
      notes: release.notes,
      name: release.name,
      prerelease: !!release.prerelease,
    });
  }
  if (requested && candidates.length !== 1)
    throw new Error("Expected one release for the specified PR");
  if (candidates.length > 256)
    throw new Error("Too many releases for one matrix");
  return candidates;
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const repository = process.env.GITHUB_REPOSITORY;
  const [owner, repo] = repository.split("/");
  const token = process.env.GH_TOKEN;
  const api = githubApi(repository, token);
  const github = await GitHub.create({ owner, repo, token });
  const manifest = await Manifest.fromManifest(github, "main");
  const candidates = await planReleases({
    github,
    api,
    manifest,
    requested: process.env.RELEASE_PR,
  });
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `candidates=${JSON.stringify(candidates)}\n`,
  );
  console.log(candidates.map(({ tag, sha, pr }) => ({ tag, sha, pr })));
}
