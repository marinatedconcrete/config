import test from "node:test";
import assert from "node:assert/strict";
import { copiedImages } from "./copied-images.mjs";

const DIGEST =
  "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

const row = (label, version) => ({ label, version });

test("a flag before --from does not hide the image", () => {
  const text = `
FROM ghcr.io/hadolint/hadolint:v2.15.1@${DIGEST} AS hadolint
FROM fedora:44
COPY --chmod=0755 --from=hadolint /bin/hadolint /usr/local/bin/hadolint
`;
  assert.deepEqual(copiedImages(text), [
    row("ghcr.io/hadolint/hadolint", "v2.15.1"),
  ]);
});

test("a stage number names the stage", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3
FROM fedora:44
COPY --from=0 /a /b
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("a stage name is not case sensitive", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3 AS Tool
FROM fedora:44
COPY --from=TOOL /a /b
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("scratch gives no row", () => {
  const text = `
FROM scratch AS ctx
FROM fedora:44
COPY --from=ctx /a /b
COPY --from=scratch /c /d
`;
  assert.deepEqual(copiedImages(text), []);
});

test("a stage that starts from another stage gives no row", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3 AS tool
FROM tool AS derived
FROM fedora:44
COPY --from=derived /a /b
`;
  assert.deepEqual(copiedImages(text), []);
});

test("an image reference in --from gives a row", () => {
  const text = `
FROM fedora:44
COPY --from=docker.io/library/alpine /a /b
`;
  assert.deepEqual(copiedImages(text), [
    row("docker.io/library/alpine", "latest"),
  ]);
});

test("a reference with a digest and no tag uses 12 characters of the digest", () => {
  const text = `
FROM busybox@${DIGEST} AS bb
FROM fedora:44
COPY --from=bb /bin/x /x
`;
  assert.deepEqual(copiedImages(text), [row("busybox", "1234567890ab")]);
});

test("a registry port is part of the label and not the tag", () => {
  const text = `
FROM localhost:5000/team/thing:9.9 AS thing
FROM localhost:5000/team/other AS other
FROM fedora:44
COPY --from=thing /a /b
COPY --from=other /c /d
`;
  assert.deepEqual(copiedImages(text), [
    row("localhost:5000/team/thing", "9.9"),
    row("localhost:5000/team/other", "latest"),
  ]);
});

test("a global ARG default expands in the reference", () => {
  const text = `
ARG TOOL_TAG=1.2.3
ARG REGISTRY=ghcr.io
FROM $REGISTRY/team/tool:\${TOOL_TAG} AS tool
FROM fedora:44
COPY --from=tool /a /b
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("an ARG with no default stops with the line of the FROM", () => {
  const text = `
ARG TOOL_TAG
FROM ghcr.io/team/tool:\${TOOL_TAG} AS tool
FROM fedora:44
COPY --from=tool /a /b
`;
  assert.throws(
    () => copiedImages(text),
    (error) =>
      error.line === 3 && error.reference === "ghcr.io/team/tool:${TOOL_TAG}",
  );
});

test("an ARG with no default in a direct reference gives the line of the COPY", () => {
  const text = `
FROM fedora:44
COPY --from=ghcr.io/team/tool:$MISSING /a /b
`;
  assert.throws(
    () => copiedImages(text),
    (error) =>
      error.line === 3 && error.reference === "ghcr.io/team/tool:$MISSING",
  );
});

test("an ARG of the stage expands in a direct reference", () => {
  const text = `
ARG TOOL_TAG=1.2.3
FROM fedora:44
ARG TOOL_TAG
COPY --from=ghcr.io/team/tool:\${TOOL_TAG} /a /b
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("a global ARG that the stage does not declare stops a direct reference", () => {
  const text = `
ARG TOOL_TAG=1.2.3
FROM fedora:44
COPY --from=ghcr.io/team/tool:\${TOOL_TAG} /a /b
`;
  assert.throws(
    () => copiedImages(text),
    (error) => error.line === 4,
  );
});

test("an ARG that the Containerfile never reads is not an error", () => {
  const text = `
ARG UNUSED
FROM ghcr.io/team/tool:$UNUSED AS unused
FROM fedora:44
`;
  assert.deepEqual(copiedImages(text), []);
});

test("a comment inside a continuation does not end the instruction", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3 AS tool
FROM fedora:44
COPY --from=tool \\
# a comment
  /a /b
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("a RUN mount with from= gives no row", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3 AS tool
FROM fedora:44
RUN --mount=type=bind,from=tool,target=/tool true
`;
  assert.deepEqual(copiedImages(text), []);
});

test("a heredoc COPY with no --from gives no row", () => {
  const text = `
FROM fedora:44
COPY <<EOT /k
hello
EOT
`;
  assert.deepEqual(copiedImages(text), []);
});

test("FROM --reset does not stop the parser", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3 AS tool
FROM --reset fedora:44
COPY --from=tool /a /b
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("rows that are the same collapse", () => {
  const text = `
FROM ghcr.io/team/tool:1.2.3 AS tool
FROM ghcr.io/team/tool:1.2.3 AS again
FROM fedora:44
COPY --from=tool /a /b
COPY --from=again /c /d
COPY --from=tool /e /f
`;
  assert.deepEqual(copiedImages(text), [row("ghcr.io/team/tool", "1.2.3")]);
});

test("the devcontainer Containerfile pattern gives the hadolint and kustomize rows", () => {
  const text = `
ARG DEVCONTAINER_BASE_TAG=latest

FROM ghcr.io/hadolint/hadolint:v2.15.1@${DIGEST} AS hadolint
FROM registry.k8s.io/kustomize/kustomize:v5.8.3@${DIGEST} AS kustomize

FROM scratch AS ctx
COPY .devcontainer/build_files /

# hadolint ignore=DL3007
FROM ghcr.io/marinatedconcrete/devcontainer-base:\${DEVCONTAINER_BASE_TAG}

USER root

COPY --chmod=0755 --from=hadolint /bin/hadolint /usr/local/bin/hadolint
COPY --chmod=0755 --from=kustomize /app/kustomize /usr/local/bin/kustomize

RUN --mount=type=bind,from=ctx,source=/,target=/ctx /ctx/build.sh
`;
  assert.deepEqual(copiedImages(text), [
    row("ghcr.io/hadolint/hadolint", "v2.15.1"),
    row("registry.k8s.io/kustomize/kustomize", "v5.8.3"),
  ]);
});
