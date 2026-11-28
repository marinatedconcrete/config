import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { githubApi } from "./api.mjs";
import { recoverPublishedRelease } from "./publish.mjs";
import { verifyPublishedImage } from "./image.mjs";

// The recovery entry point. It checks a published release and reports whether
// it is complete. The tests drive run() with a fake api and a fake image
// verifier so the wrapper logic has a fast check.
export async function run({
  candidate,
  repository,
  api,
  verify = verifyPublishedImage,
  appendSync = appendFileSync,
  githubOutput = process.env.GITHUB_OUTPUT,
} = {}) {
  const recovered = await recoverPublishedRelease({
    api,
    candidate,
    verifyImage: async (candidate, digest) => {
      const image =
        `ghcr.io/${repository.split("/")[0]}/${candidate.project}`.toLowerCase();
      verify(image, candidate.version, digest);
    },
  });
  appendSync(githubOutput, `recovered=${recovered}\n`);
  return recovered;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run({
    candidate: JSON.parse(process.env.CANDIDATE),
    repository: process.env.GITHUB_REPOSITORY,
    api: githubApi(process.env.GITHUB_REPOSITORY, process.env.GH_TOKEN),
  });
}
