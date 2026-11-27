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

export class UnknownStageError extends Error {
  constructor(stage) {
    super(`no stage named ${stage}`);
    this.stage = stage;
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
// not a pinned tool, and it has a parent. The image is the target stage, the
// stages that it starts from, and the stages that a COPY in those stages
// copies from. No target means the last stage.
function readStages(dockerfile, target) {
  const froms = dockerfile.getFROMs();
  const stages = new Map();
  const parents = new Map();
  const derived = new Set();
  froms.forEach((from, index) => {
    const keys = [String(index), from.getBuildStage()?.toLowerCase()];
    const parent = stages.get(from.getImage()?.toLowerCase());
    if (parent) parents.set(from, parent);
    for (const key of keys.filter(Boolean)) {
      stages.set(key, from);
      if (parent) derived.add(key);
    }
  });

  const start =
    target == null ? froms.at(-1) : stages.get(target.toLowerCase());
  if (target != null && !start) throw new UnknownStageError(target);

  const copies = new Map(froms.map((from) => [from, []]));
  for (const copy of dockerfile.getCOPYs()) {
    copies
      .get(froms.findLast((from) => lineOf(from) <= lineOf(copy)))
      ?.push(copy);
  }
  const included = new Set();
  const pending = [start];
  for (const stage of pending) {
    if (!stage || included.has(stage)) continue;
    included.add(stage);
    pending.push(parents.get(stage));
    for (const copy of copies.get(stage)) {
      pending.push(stages.get(fromFlag(copy)?.toLowerCase()));
    }
  }
  const imageCopies = froms
    .filter((from) => included.has(from))
    .flatMap((from) => copies.get(from));
  return { stages, parents, derived, start, imageCopies };
}

// Return the row of the image that the target stage starts from, or null when
// that image is scratch. A target that starts from an earlier stage has the
// base image of that stage.
export function baseImage(text, target) {
  const dockerfile = DockerfileParser.parse(text);
  const { parents, start } = readStages(dockerfile, target);

  let stage = start;
  while (parents.has(stage)) stage = parents.get(stage);
  if (!stage?.getImage() || stage.getImage().toLowerCase() === "scratch") {
    return null;
  }
  return row(dockerfile, stage.getImage(), lineOf(stage));
}

export function copiedImages(text, target) {
  const dockerfile = DockerfileParser.parse(text);
  const { stages, derived, imageCopies } = readStages(dockerfile, target);

  const rows = new Map();
  const seen = new Set();
  for (const copy of imageCopies) {
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
export function containerfileImages(text, target) {
  const rows = new Map();
  for (const image of [
    baseImage(text, target),
    ...copiedImages(text, target),
  ]) {
    if (image) rows.set(rowKey(image), image);
  }
  return [...rows.values()];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [path, target] = process.argv.slice(2);
  try {
    for (const { label, version } of containerfileImages(
      readFileSync(path, "utf8"),
      target || undefined,
    )) {
      console.log(`${label}\t${version}`);
    }
  } catch (error) {
    if (error instanceof UnknownStageError) {
      console.error(`ERROR: ${path}: no stage named ${error.stage}`);
    } else if (error instanceof UnresolvedReferenceError) {
      console.error(
        `ERROR: line ${error.line} of ${path}: the reference ${error.reference} has an unresolved ARG`,
      );
    } else {
      throw error;
    }
    process.exit(1);
  }
}
