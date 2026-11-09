import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DockerfileParser } from "dockerfile-ast";

export class UnresolvedReferenceError extends Error {
  constructor(line, reference) {
    super(`line ${line}: the reference ${reference} has an unresolved ARG`);
    this.line = line;
    this.reference = reference;
  }
}

// Replace $NAME and ${NAME} with the ARG value that applies at the line, or
// return null when an ARG has no value there.
function expand(dockerfile, reference, line) {
  let unresolved = false;
  const expanded = reference.replace(
    /\$(?:\{(\w+)\}|(\w+))/g,
    (match, braced, bare) => {
      const value = dockerfile.resolveVariable(braced ?? bare, line - 1);
      if (value == null) unresolved = true;
      return value ?? match;
    },
  );
  return unresolved || expanded.includes("$") ? null : expanded;
}

function row(dockerfile, reference, line) {
  const expanded = expand(dockerfile, reference, line);
  const from =
    expanded && DockerfileParser.parse(`FROM ${expanded}`).getFROMs()[0];
  if (!from?.getImageName()) {
    throw new UnresolvedReferenceError(line, reference);
  }
  return {
    label: [from.getRegistry(), from.getImageName()].filter(Boolean).join("/"),
    version:
      [from.getImageTag(), from.getImageDigest()].filter(Boolean).join("@") ||
      "latest",
  };
}

const rowKey = ({ label, version }) => `${label}\t${version}`;

const lineOf = (instruction) => instruction.getRange().start.line + 1;

// getFromFlag() returns null when COPY has more than one flag.
const fromFlag = (copy) =>
  copy
    .getFlags()
    .find((flag) => flag.getName().toLowerCase() === "from")
    ?.getValue();

// Find the stages of the file. A stage that starts from an earlier stage is
// not a pinned tool, and it has a parent.
function readStages(dockerfile) {
  const stages = new Map();
  const parents = new Map();
  const derived = new Set();
  dockerfile.getFROMs().forEach((from, index) => {
    const keys = [String(index), from.getBuildStage()?.toLowerCase()];
    const parent = stages.get(from.getImage()?.toLowerCase());
    if (parent) parents.set(from, parent);
    for (const key of keys.filter(Boolean)) {
      stages.set(key, from);
      if (parent) derived.add(key);
    }
  });
  return { stages, parents, derived };
}

// Return the row of the image that the last stage starts from, or null when
// that image is scratch. A final stage that starts from an earlier stage has
// the base image of that stage.
export function baseImage(text) {
  const dockerfile = DockerfileParser.parse(text);
  const { parents } = readStages(dockerfile);

  let stage = dockerfile.getFROMs().at(-1);
  while (parents.has(stage)) stage = parents.get(stage);
  if (!stage?.getImage() || stage.getImage().toLowerCase() === "scratch") {
    return null;
  }
  return row(dockerfile, stage.getImage(), lineOf(stage));
}

export function copiedImages(text) {
  const dockerfile = DockerfileParser.parse(text);
  const { stages, derived } = readStages(dockerfile);

  const rows = new Map();
  const seen = new Set();
  for (const copy of dockerfile.getCOPYs()) {
    const value = fromFlag(copy);
    if (!value || seen.has(value)) continue;
    seen.add(value);

    const key = value.toLowerCase();
    if (derived.has(key)) continue;
    const stage = stages.get(key);
    const reference = stage ? stage.getImage() : value;
    if (reference.toLowerCase() === "scratch") continue;

    const image = row(dockerfile, reference, lineOf(stage ?? copy));
    rows.set(rowKey(image), image);
  }
  return [...rows.values()];
}

// Return the base image row first, then the copied image rows. A row that
// the base image and a copied image share shows one time.
export function containerfileImages(text) {
  const rows = new Map();
  for (const image of [baseImage(text), ...copiedImages(text)]) {
    if (image) rows.set(rowKey(image), image);
  }
  return [...rows.values()];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const path = process.argv[2];
  try {
    for (const { label, version } of containerfileImages(
      readFileSync(path, "utf8"),
    )) {
      console.log(`${label}\t${version}`);
    }
  } catch (error) {
    if (!(error instanceof UnresolvedReferenceError)) throw error;
    console.error(
      `ERROR: line ${error.line} of ${path}: the reference ${error.reference} has an unresolved ARG`,
    );
    process.exit(1);
  }
}
