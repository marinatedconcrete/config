import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// These tests run release-notes.sh with a stub `docker` command. The stub
// prints fixed files in place of Syft, `dnf`, and the CycloneDX CLI. The tests
// show how the script handles the output of those tools. They do not show
// that the real tools write the same output.

const here = dirname(fileURLToPath(import.meta.url));
// RELEASE_NOTES_SCRIPT lets a reviewer run the tests on a changed copy.
const scriptPath =
  process.env.RELEASE_NOTES_SCRIPT ?? join(here, "release-notes.sh");

const component = (name, version, purl, type = "library") => ({
  type,
  name,
  version,
  ...(purl ? { purl } : {}),
});

const SBOM = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {},
  components: [
    component("fedora", "44", undefined, "operating-system"),
    component("kernel", "6.1.0", "pkg:rpm/fedora/kernel@6.1.0"),
    component("systemd", "257.1", "pkg:rpm/fedora/systemd@257.1"),
    component("systemd", "257.2", "pkg:rpm/fedora/systemd@257.2"),
    component("bash", "5.2", "pkg:rpm/fedora/bash@5.2"),
    component("left-pad", "1.3.0", "pkg:npm/left-pad@1.3.0"),
  ],
};

const version = (v) => ({ version: v });

// The shape that `cyclonedx diff --component-versions` writes.
const DIFF = {
  componentVersions: {
    bash: { added: [], removed: [], unchanged: [version("5.2")] },
    curl: { added: [], removed: [version("8.0")], unchanged: [] },
    kernel: {
      added: [version("6.1.0")],
      removed: [version("6.0.0")],
      unchanged: [],
    },
    nano: { added: [version("7.2")], removed: [], unchanged: [] },
  },
};

const STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >>"$STUB_DIR/docker.log"
case "$1" in
save)
    : >"$3"
    ;;
run)
    shift
    for arg in "$@"; do
        case "$arg" in
        scan) cat "$STUB_DIR/sbom.json"; exit 0 ;;
        diff) cat "$STUB_DIR/diff.json"; exit 0 ;;
        /tmp/components.sh) printf 'Variant\\tcore\\nbroken line\\n'; exit 0 ;;
        -c)
            [[ "\${STUB_DNF_STATUS:-0}" == 0 ]] || exit "$STUB_DNF_STATUS"
            cat "$STUB_DIR/installed.txt"
            exit 0
            ;;
        esac
    done
    exit 1
    ;;
esac
`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "release-notes-test-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), STUB);
  chmodSync(join(bin, "docker"), 0o755);
  writeFileSync(join(dir, "sbom.json"), JSON.stringify(SBOM));
  writeFileSync(join(dir, "installed.txt"), "bash\nghost\nsystemd\n");
  writeFileSync(join(dir, "previous.json"), JSON.stringify(SBOM));
  return { dir, bin };
}

function run(args, { env = {}, previous = true, diff = DIFF } = {}) {
  const { dir, bin } = setup();
  writeFileSync(join(dir, "diff.json"), JSON.stringify(diff));
  const out = join(dir, "out");
  const result = spawnSync(
    "bash",
    [
      scriptPath,
      "--notes",
      join(out, "notes.md"),
      "--sbom",
      join(out, "sbom.cdx.json"),
      ...(previous ? ["--previous-sbom", join(dir, "previous.json")] : []),
      ...args,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        STUB_DIR: dir,
        ...env,
      },
    },
  );
  const read = (name) => {
    try {
      return readFileSync(join(dir, name), "utf8");
    } catch {
      return undefined;
    }
  };
  const notes = read("out/notes.md");
  const log = read("docker.log");
  rmSync(dir, { recursive: true, force: true });
  return { ...result, notes, log };
}

test("the component table shows the operating system, the highlights, and the script rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-notes-script-"));
  const componentsScript = join(dir, "components.sh");
  writeFileSync(componentsScript, "");
  const result = run(
    [
      "--image",
      "app:1.0",
      "--highlights",
      "kernel systemd missing",
      "--components-script",
      componentsScript,
    ],
    { previous: false },
  );
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.notes.startsWith(
      [
        "## Image Components",
        "",
        "| Component | Version |",
        "| --- | --- |",
        "| Fedora | 44 |",
        "| kernel | 6.1.0 |",
        "| systemd | 257.1,257.2 |",
        "| missing | not installed |",
        "| Variant | core |",
        "",
        "",
      ].join("\n"),
    ),
    result.notes,
  );
});

test("the requested package table counts every name and marks a missing package", () => {
  const result = run(["--image", "app:1.0"], { previous: false });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.notes.includes(
      [
        "## Requested Packages",
        "",
        "The image build installs these 3 packages by name.",
        "The package manager installs the other packages as dependencies.",
        "",
        "| Package | Version |",
        "| --- | --- |",
        "| bash | 5.2 |",
        "| ghost | not installed |",
        "| systemd | 257.1,257.2 |",
        "",
      ].join("\n"),
    ),
    result.notes,
  );
});

test("the change table lists changed, added, and removed packages", () => {
  const result = run(["--image", "app:1.0", "--previous-tag", "app-0.9.0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.notes.includes(
      [
        "## Package Changes Since app-0.9.0",
        "",
        "| Package | Old | New |",
        "| --- | --- | --- |",
        "| kernel | 6.0.0 | 6.1.0 |",
        "",
        "**Added:** nano 7.2",
        "",
        "**Removed:** curl 8.0",
        "",
      ].join("\n"),
    ),
    result.notes,
  );
});

test("the change table says so when nothing changed", () => {
  const same = {
    componentVersions: {
      bash: { added: [], removed: [], unchanged: [version("5.2")] },
    },
  };
  const result = run(["--image", "app:1.0"], {
    diff: same,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.notes.includes("No packages changed."), result.notes);
});

test("the notes omit the change table when no previous SBOM exists", () => {
  const result = run(["--image", "app:1.0"], { previous: false });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.notes.includes("## Package Changes"), result.notes);
  assert.ok(
    result.notes.endsWith(
      "The SBOM contains 5 packages.\nThe SBOM contains 4 rpm packages.\n",
    ),
    result.notes,
  );
});

for (const status of [3, 127]) {
  test(`an image with no shell or no dnf (status ${status}) gives notes with no requested packages`, () => {
    const result = run(["--image", "app:1.0"], {
      previous: false,
      env: { STUB_DNF_STATUS: String(status) },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.notes.includes("## Image Components"), result.notes);
    assert.ok(!result.notes.includes("## Requested Packages"), result.notes);
    assert.match(result.stderr, /no dnf command/);
  });
}

test("a dnf failure stops the script", () => {
  const result = run(["--image", "app:1.0"], {
    previous: false,
    env: { STUB_DNF_STATUS: "1" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /could not read the requested packages/);
});

test("the Syft options split a registry port, a tag, and a digest", () => {
  const digest = `sha256:${"a".repeat(64)}`;
  const result = run(["--image", `localhost:5000/team/app:1.2.3@${digest}`], {
    previous: false,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.log,
    /--source-name localhost:5000\/team\/app --source-version 1\.2\.3/,
  );
});

test("a registry port is not a tag", () => {
  const result = run(["--image", "localhost:5000/team/app"], {
    previous: false,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /--source-name localhost:5000\/team\/app(\n|$)/);
  assert.doesNotMatch(result.log, /--source-version/);
});

test("the script needs the --image option", () => {
  const result = run([], { previous: false });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--image is required/);
});
