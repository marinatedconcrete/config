import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { githubApi } from "./api.mjs";
import { publishRelease } from "./publish.mjs";
import { promoteImage } from "./image.mjs";

// The publish entry point. It reads the validated candidate and artifacts,
// checks them, and publishes the release. The tests drive run() with a fake
// api and a fake artifact reader so the wrapper logic has a fast check.
export async function run({
  candidate,
  repository,
  api,
  imageNotes = false,
  imageDigest = "",
  readSync = readFileSync,
  hasSync = existsSync,
  appendSync = appendFileSync,
  promote = promoteImage,
  stepSummary = process.env.GITHUB_STEP_SUMMARY,
} = {}) {
  const assets = [];
  let notes = "";
  if (candidate.kind === "image") {
    if (imageNotes) {
      const name = `${candidate.project}-sbom.cdx.json`;
      const data = readSync(`artifacts/${name}`);
      notes = readSync(
        `artifacts/${candidate.project}-notes.md`,
        "utf8",
      ).trim();
      if (!data.length || !notes)
        throw new Error("Image release notes or SBOM is empty");
      assets.push({ name, data });
    }
  } else if (candidate.kind === "component") {
    const name = `${candidate.project}.yml`;
    if (hasSync(`artifacts/${name}`)) {
      const data = readSync(`artifacts/${name}`);
      if (data.length) assets.push({ name, data });
    }
    const result = JSON.parse(readSync("artifacts/validation.json"));
    if (result.manifest !== (assets.length === 1))
      throw new Error("Validated manifest is missing or unexpected");
    if (result.sha !== candidate.sha || result.tag !== candidate.tag)
      throw new Error("Validation result does not match the release");
  }
  const receipt = await publishRelease({
    api,
    candidate,
    assets,
    imageNotes: notes,
    imageDigest,
    promote: async (release, digest) => {
      const image =
        `ghcr.io/${repository.split("/")[0]}/${release.project}`.toLowerCase();
      promote(image, release.version, digest);
    },
  });
  appendSync(
    stepSummary,
    `Published ${candidate.tag} from ${candidate.sha}.\n\nImage digest: ${receipt.imageDigest || "not applicable"}.\n`,
  );
  return receipt;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run({
    candidate: JSON.parse(process.env.CANDIDATE),
    repository: process.env.GITHUB_REPOSITORY,
    api: githubApi(process.env.GITHUB_REPOSITORY, process.env.GH_TOKEN),
    imageNotes: process.env.IMAGE_NOTES === "true",
    imageDigest: process.env.IMAGE_DIGEST || "",
  });
}
