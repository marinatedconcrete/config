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

const shortDigest = (digest) => digest.split(":")[1].slice(0, 12);

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
  const digest = from.getImageDigest();
  return {
    label: [from.getRegistry(), from.getImageName()].filter(Boolean).join("/"),
    version: from.getImageTag() ?? (digest && shortDigest(digest)) ?? "latest",
  };
}

const lineOf = (instruction) => instruction.getRange().start.line + 1;

// getFromFlag() returns null when COPY has more than one flag.
const fromFlag = (copy) =>
  copy
    .getFlags()
    .find((flag) => flag.getName().toLowerCase() === "from")
    ?.getValue();

export function copiedImages(text) {
  const dockerfile = DockerfileParser.parse(text);

  // A stage that starts from an earlier stage is not a pinned tool.
  const stages = new Map();
  const derived = new Set();
  dockerfile.getFROMs().forEach((from, index) => {
    const keys = [String(index), from.getBuildStage()?.toLowerCase()];
    const isDerived = stages.has(from.getImage()?.toLowerCase());
    for (const key of keys.filter(Boolean)) {
      stages.set(key, from);
      if (isDerived) derived.add(key);
    }
  });

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
    rows.set(`${image.label}\t${image.version}`, image);
  }
  return [...rows.values()];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const path = process.argv[2];
  try {
    for (const { label, version } of copiedImages(readFileSync(path, "utf8"))) {
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
