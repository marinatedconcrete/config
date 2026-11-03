import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { githubApi } from "./api.mjs";
import { publishRelease } from "./publish.mjs";
import { promoteImage } from "./image.mjs";

const candidate = JSON.parse(process.env.CANDIDATE);
const repository = process.env.GITHUB_REPOSITORY;
const api = githubApi(repository, process.env.GH_TOKEN);
const assets = [];
let notes = "";
// The image build can supply release notes and an SBOM for the tested image.
if (candidate.kind === "image") {
  const sbom = `${candidate.project}-sbom.cdx.json`;
  if (existsSync(`artifacts/${sbom}`))
    assets.push({ name: sbom, data: readFileSync(`artifacts/${sbom}`) });
  if (existsSync(`artifacts/${candidate.project}-notes.md`))
    notes = readFileSync(`artifacts/${candidate.project}-notes.md`, "utf8").trim();
}
if (candidate.kind === "component") {
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
