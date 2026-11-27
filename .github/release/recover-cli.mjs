import { appendFileSync } from "node:fs";
import { githubApi } from "./api.mjs";
import { recoverPublishedRelease } from "./publish.mjs";
import { verifyPublishedImage } from "./image.mjs";

const repository = process.env.GITHUB_REPOSITORY;
const recovered = await recoverPublishedRelease({
  api: githubApi(repository, process.env.GH_TOKEN),
  candidate: JSON.parse(process.env.CANDIDATE),
  verifyImage: async (candidate, digest) => {
    const image =
      `ghcr.io/${repository.split("/")[0]}/${candidate.project}`.toLowerCase();
    verifyPublishedImage(image, candidate.version, digest);
  },
});
appendFileSync(process.env.GITHUB_OUTPUT, `recovered=${recovered}\n`);
