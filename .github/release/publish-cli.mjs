import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { githubApi } from "./api.mjs";
import { publishRelease } from "./publish.mjs";
import { promoteImage } from "./image.mjs";

const candidate = JSON.parse(process.env.CANDIDATE);
const repository = process.env.GITHUB_REPOSITORY;
const api = githubApi(repository, process.env.GH_TOKEN);
const assets = [];
let notes = "";
// The release workflow downloads the notes artifact for these images.
const noteImages = ["kairos-fedora"];
if (candidate.kind === "image") {
  if (noteImages.includes(candidate.project)) {
    const name = `${candidate.project}-sbom.cdx.json`;
    const data = readFileSync(`artifacts/${name}`);
    notes = readFileSync(`artifacts/${candidate.project}-notes.md`, "utf8").trim();
    if (!data.length || !notes)
      throw new Error("Image release notes or SBOM is empty");
    assets.push({ name, data });
  }
} else if (candidate.kind === "component") {
  const name = `${candidate.project}.yml`;
  if (existsSync(`artifacts/${name}`)) {
    const data = readFileSync(`artifacts/${name}`);
    if (data.length) assets.push({ name, data });
  }
  const result = JSON.parse(readFileSync("artifacts/validation.json"));
  if (result.manifest !== (assets.length === 1))
    throw new Error("Validated manifest is missing or unexpected");
  if (result.sha !== candidate.sha || result.tag !== candidate.tag)
    throw new Error("Validation result does not match the release");
}
const receipt = await publishRelease({
  api,
  candidate,
  assets,
  notes,
  imageDigest: process.env.IMAGE_DIGEST || "",
  promote: async (release, imageDigest) => {
    const image =
      `ghcr.io/${repository.split("/")[0]}/${release.project}`.toLowerCase();
    promoteImage(image, release.version, imageDigest);
  },
});
appendFileSync(
  process.env.GITHUB_STEP_SUMMARY,
  `Published ${candidate.tag} from ${candidate.sha}.\n\nImage digest: ${receipt.imageDigest || "not applicable"}.\n`,
);
