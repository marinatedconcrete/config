# See https://kairos.io/docs/reference/kairos-factory/ for more details.

FROM quay.io/kairos/kairos-init:v0.6.0@sha256:b326c95650bd4c68422330f414a03e0a7f0f89620194eb30d75f19183016d4ba AS kairos-init

FROM ubuntu:24.04@sha256:fdb6c9ceb1293dcb0b7eda5df195b15303b01857d7b10f98489e7691d20aa2a1 AS base-kairos
LABEL org.opencontainers.image.title="A custom Ubuntu-based Kairos image."
LABEL org.opencontainers.image.title="kairos-ubuntu"
ARG MODEL=generic
ARG TRUSTED_BOOT=false
ARG KUBERNETES_DISTRO=k3s
# renovate: datasource=github-releases depName=k3s-io/k3s
ARG KUBERNETES_VERSION=v1.33.4+k3s1
ARG VERSION

COPY --from=kairos-init /kairos-init /kairos-init

# Install Kairos into the image.
# hadolint ignore=DL3059
RUN /kairos-init \
    -k "${KUBERNETES_DISTRO}" \
    -l debug \
    -m "${MODEL}" \
    -s install \
    -t "${TRUSTED_BOOT}" \
    --k8sversion "${KUBERNETES_VERSION}" \
    --version "${VERSION}"

# Our customizations!
# This space intentionally left blank.

# Initialize the image.
# hadolint ignore=DL3059
RUN /kairos-init \
    -k "${KUBERNETES_DISTRO}" \
    -l debug \
    -m "${MODEL}" \
    -s init \
    -t "${TRUSTED_BOOT}" \
    --k8sversion "${KUBERNETES_VERSION}" \
    --version "${VERSION}"

# Validate the image.
# hadolint ignore=DL3059
RUN /kairos-init \
    validate \
    -t "${TRUSTED_BOOT}"

# hadolint ignore=DL3059
RUN rm /kairos-init
