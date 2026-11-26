import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// These tests run publish.sh with a stub `gh` command. The stub keeps one
// fake release in a directory. The tests show how the script changes that
// release. They do not show that the real GitHub CLI or API accepts the same
// calls.

const here = dirname(fileURLToPath(import.meta.url));
// PUBLISH_SCRIPT lets a reviewer run the tests on a changed copy.
const scriptPath =
  process.env.PUBLISH_SCRIPT ?? join(here, "publish", "publish.sh");

const MARKER = "<!-- app-image-details -->";

const STUB = `#!/usr/bin/env bash
case "$1 $2" in
"release view")
    [[ "$3" == "$STUB_TAG" && -d "$STUB_DIR/release" ]] || exit 1
    case "$*" in
    *"--json body"*) cat "$STUB_DIR/release/body.md" ;;
    *"--json isImmutable"*)
        [[ -e "$STUB_DIR/release/broken" ]] && exit 1
        [[ -e "$STUB_DIR/release/immutable" ]] && echo true || echo false
        ;;
    *"--json assets"*) ls -- "$STUB_DIR/release/assets" ;;
    esac
    exit 0
    ;;
"release upload")
    [[ "$3" == "$STUB_TAG" ]] || exit 1
    if [[ -e "$STUB_DIR/release/immutable" ]]; then
        echo "HTTP 422: Cannot upload assets to an immutable release." >&2
        exit 1
    fi
    # The real command fails on an existing asset without --clobber.
    asset="$STUB_DIR/release/assets/$(basename "$4")"
    [[ ! -e "$asset" || "$*" == *--clobber* ]] || exit 1
    cp -- "$4" "$asset"
    ;;
"release edit")
    [[ "$3" == "$STUB_TAG" && "$4" == "--notes-file" ]] || exit 1
    cp -- "$5" "$STUB_DIR/release/body.md"
    ;;
*)
    exit 1
    ;;
esac
`;

function setup({
  body,
  release = true,
  immutable = false,
  broken = false,
  assets = [],
}) {
  const dir = mkdtempSync(join(tmpdir(), "publish-test-"));
  const bin = join(dir, "bin");
  const files = join(dir, "files");
  mkdirSync(bin);
  mkdirSync(files);
  writeFileSync(join(bin, "gh"), STUB);
  chmodSync(join(bin, "gh"), 0o755);
  writeFileSync(join(files, "app-sbom.cdx.json"), '{"bomFormat":"CycloneDX"}');
  if (release) {
    mkdirSync(join(dir, "release", "assets"), { recursive: true });
    writeFileSync(join(dir, "release", "body.md"), body);
    if (immutable) writeFileSync(join(dir, "release", "immutable"), "");
    if (broken) writeFileSync(join(dir, "release", "broken"), "");
    for (const [name, data] of assets)
      writeFileSync(join(dir, "release", "assets", name), data);
  }
  return { dir, bin, files };
}

function publish({ dir, bin, files }, notes, args = ["--tag", "app-1.0.0"]) {
  writeFileSync(join(files, "app-notes.md"), notes);
  return spawnSync(
    "bash",
    [scriptPath, "--component", "app", "--directory", files, ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        STUB_DIR: dir,
        STUB_TAG: "app-1.0.0",
      },
    },
  );
}

const state = (dir) => ({
  body: readFileSync(join(dir, "release", "body.md"), "utf8"),
  assets: readdirSync(join(dir, "release", "assets")),
});

const PUBLISHED_SBOM = '{"bomFormat":"CycloneDX","published":true}';

test("a published immutable release that has the SBOM keeps it and gets the notes", () => {
  const env = setup({
    body: "Human text.\n",
    immutable: true,
    assets: [["app-sbom.cdx.json", PUBLISHED_SBOM]],
  });
  try {
    const result = publish(env, "Notes.\n");
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(state(env.dir), {
      body: `Human text.\n\n${MARKER}\n\nNotes.\n`,
      assets: ["app-sbom.cdx.json"],
    });
    assert.equal(
      readFileSync(
        join(env.dir, "release", "assets", "app-sbom.cdx.json"),
        "utf8",
      ),
      PUBLISHED_SBOM,
    );
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a published immutable release with no SBOM stops the script and keeps the body", () => {
  const env = setup({ body: "Human text.\n", immutable: true });
  try {
    const result = publish(env, "Notes.\n");
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /release app-1\.0\.0 is immutable and has no app-sbom\.cdx\.json asset/,
    );
    assert.deepEqual(state(env.dir), { body: "Human text.\n", assets: [] });
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a second run with the same tag gives the same release", () => {
  const env = setup({ body: "Human text.\n\nMore text.\n" });
  try {
    const first = publish(env, "## Image Components\n\nOne.\n");
    assert.equal(first.status, 0, first.stderr);
    const afterFirst = state(env.dir);
    assert.equal(
      afterFirst.body,
      `Human text.\n\nMore text.\n\n${MARKER}\n\n## Image Components\n\nOne.\n`,
    );

    const second = publish(env, "## Image Components\n\nOne.\n");
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(state(env.dir), afterFirst);
    assert.deepEqual(afterFirst.assets, ["app-sbom.cdx.json"]);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a run with new notes replaces the old section and keeps one marker", () => {
  const env = setup({ body: "Human text.\n" });
  try {
    publish(env, "Old notes.\n");
    const second = publish(env, "New notes.\n");
    assert.equal(second.status, 0, second.stderr);
    const { body } = state(env.dir);
    assert.equal(body, `Human text.\n\n${MARKER}\n\nNew notes.\n`);
    assert.equal(body.split(MARKER).length, 2);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a release with no text gets the marker and the notes", () => {
  const env = setup({ body: "" });
  try {
    const result = publish(env, "Notes.\n");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(state(env.dir).body, `${MARKER}\n\nNotes.\n`);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("the run removes the spaces at the end of the text above the marker", () => {
  const env = setup({ body: "Human text.  \n\n" });
  try {
    const result = publish(env, "Notes.\n");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(state(env.dir).body, `Human text.\n\n${MARKER}\n\nNotes.\n`);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a release that does not exist stops the script", () => {
  const env = setup({ body: "", release: false });
  try {
    const result = publish(env, "Notes.\n");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not exist/);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("an empty tag stops the script before it calls GitHub", () => {
  const env = setup({ body: "Keep.\n" });
  try {
    const result = publish(env, "Notes.\n", ["--tag", ""]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--tag is required/);
    assert.deepEqual(state(env.dir), { body: "Keep.\n", assets: [] });
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a failed immutability query stops the script before it changes the release", () => {
  const env = setup({ body: "Keep.\n", broken: true });
  try {
    const result = publish(env, "Notes.\n");
    assert.notEqual(result.status, 0);
    assert.deepEqual(state(env.dir), { body: "Keep.\n", assets: [] });
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});
