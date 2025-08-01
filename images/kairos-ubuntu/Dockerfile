# See https://kairos.io/docs/reference/kairos-factory/ for more details.

FROM quay.io/kairos/kairos-init:v0.5.8@sha256:dc35cf5bce7e0bc262534d38f4b6505994ae03ad09cce5aec8b4b14f7e1cb7ce AS kairos-init

FROM ubuntu:24.04@sha256:c4570d2f4665d5d118ae29fb494dee4f8db8fcfaee0e37a2e19b827f399070d3 AS base-kairos
LABEL org.opencontainers.image.title="A custom Ubuntu-based Kairos image."
LABEL org.opencontainers.image.title="kairos-ubuntu"
ARG MODEL=generic
ARG TRUSTED_BOOT=false
ARG KUBERNETES_DISTRO=k3s
# renovate: datasource=github-releases depName=k3s-io/k3s
ARG KUBERNETES_VERSION=v1.33.2+k3s1
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
