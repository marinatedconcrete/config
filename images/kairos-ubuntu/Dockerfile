# See https://kairos.io/docs/reference/kairos-factory/ for more details.

FROM quay.io/kairos/kairos-init:v0.4.7@sha256:fc9564833491c504e30f5894dfab3c6fd394fe6f02491553722ff9cb10fedd6e AS kairos-init

FROM ubuntu:24.04 AS base-kairos
LABEL org.opencontainers.image.title="A custom Ubuntu-based Kairos image."
LABEL org.opencontainers.image.title="kairos-ubuntu"
ARG VARIANT=standard
ARG MODEL=generic
ARG TRUSTED_BOOT=false
ARG KUBERNETES_DISTRO=k3s
# renovate: datasource=custom.k3s depName=k3s
ARG KUBERNETES_VERSION=v1.31.4+k3s1
# renovate: datasource=github-releases depName=kairos-io/kairos-framework
ARG FRAMEWORK_VERSION=v2.20.0
ARG VERSION

COPY --from=kairos-init /kairos-init /kairos-init

# Install Kairos into the image.
# hadolint ignore=DL3059
RUN /kairos-init \
    -f "${FRAMEWORK_VERSION}" \
    -k "${KUBERNETES_DISTRO}" \
    -l debug \
    -m "${MODEL}" \
    -s install \
    -t "${TRUSTED_BOOT}" \
    -v "${VARIANT}" \
    --k8sversion "${KUBERNETES_VERSION}" \
    --version "${VERSION}"

# Our customizations!
# This space intentionally left blank.

# Initialize the image.
# hadolint ignore=DL3059
RUN /kairos-init \
    -f "${FRAMEWORK_VERSION}" \
    -k "${KUBERNETES_DISTRO}" \
    -l debug \
    -m "${MODEL}" \
    -s init \
    -t "${TRUSTED_BOOT}" \
    -v "${VARIANT}" \
    --k8sversion "${KUBERNETES_VERSION}" \
    --version "${VERSION}"

# Validate the image.
# hadolint ignore=DL3059
RUN /kairos-init \
    --validate \
    -f "${FRAMEWORK_VERSION}" \
    -k "${KUBERNETES_DISTRO}" \
    -l debug \
    -m "${MODEL}" \
    -t "${TRUSTED_BOOT}" \
    -v "${VARIANT}" \
    --k8sversion "${KUBERNETES_VERSION}" \
    --version "${VERSION}"

# hadolint ignore=DL3059
RUN rm /kairos-init
