import { appendFileSync } from "node:fs";
import { GitHub, Manifest } from "release-please";
import { githubApi } from "./api.mjs";

export function classifyReleasePath(path) {
  const project = path.startsWith("kustomization/components/")
    ? `kustomize-${path.split("/").at(-1)}`
    : path.startsWith("images/") || path.startsWith("actions/")
      ? path.split("/").at(-1)
      : path;
  const kind = project.startsWith("kustomize-")
    ? "component"
    : [
          "kairos-fedora",
          "buildah-action-runner",
          "github-runner-ci",
          "vscode-ssh-server",
        ].includes(project)
      ? "image"
      : path.startsWith("actions/") || ["ansible", "renovate"].includes(project)
        ? "source"
        : null;
  if (!kind || !/^[a-z0-9-]+$/.test(project))
    throw new Error(`Unsupported release path: ${path}`);
  return { project, kind };
}

export async function planReleases({
  github,
  api,
  manifest,
  requested = "",
  onError = (error) => {
    throw error;
  },
}) {
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
    try {
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
      const { project, kind } = classifyReleasePath(release.path);
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
    } catch (error) {
      onError(
        new Error(
          `${release.path} (PR #${release.pullRequest.number}): ${error.message}`,
        ),
      );
    }
  }
  if (requested && releases.length !== 1)
    throw new Error("Expected one release for the specified PR");
  if (candidates.length > 256)
    throw new Error("Too many releases for one matrix");
  return candidates;
}

export async function collectPlan(createContext) {
  const errors = [];
  let candidates = [];
  try {
    candidates = await planReleases({
      ...(await createContext()),
      onError: (error) => errors.push(error.message),
    });
  } catch (error) {
    errors.push(`Release planning: ${error.message}`);
  }
  return { candidates, errors };
}

// The plan entry point. It builds the release plan, writes it to the
// GitHub Actions output file, and logs the candidates. The tests drive
// run() with a fake context so the wrapper logic has a fast check.
export async function run({
  createContext,
  appendSync = appendFileSync,
  output = process.env.GITHUB_OUTPUT,
  log = console.log,
} = {}) {
  const { candidates, errors } = await collectPlan(createContext);
  appendSync(
    output,
    `candidates=${JSON.stringify(candidates)}\nerrors=${JSON.stringify(errors)}\n`,
  );
  log(candidates.map(({ tag, sha, pr }) => ({ tag, sha, pr })));
  return { candidates, errors };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const environment = process.env;
  const createContext = async () => {
    const repository = environment.GITHUB_REPOSITORY;
    const [owner, repo] = repository.split("/");
    const token = environment.GH_TOKEN;
    const api = githubApi(repository, token);
    const github = await GitHub.create({ owner, repo, token });
    const manifest = await Manifest.fromManifest(github, "main");
    return { github, api, manifest, requested: environment.RELEASE_PR };
  };
  await run({ createContext });
}
