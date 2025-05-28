# See https://kairos.io/docs/reference/kairos-factory/ for more details.

FROM quay.io/kairos/kairos-init:v0.4.8@sha256:0b8c5c0a633edcc76fd3f76ffaf927c7c170f114520d52afb59b22728e1ce5d1 AS kairos-init

FROM ubuntu:24.04@sha256:6015f66923d7afbc53558d7ccffd325d43b4e249f41a6e93eef074c9505d2233 AS base-kairos
LABEL org.opencontainers.image.title="A custom Ubuntu-based Kairos image."
LABEL org.opencontainers.image.title="kairos-ubuntu"
ARG VARIANT=standard
ARG MODEL=generic
ARG TRUSTED_BOOT=false
ARG KUBERNETES_DISTRO=k3s
# renovate: datasource=github-releases depName=k3s-io/k3s
ARG KUBERNETES_VERSION=v1.32.4+k3s1
# renovate: datasource=github-releases depName=kairos-io/kairos-framework
ARG FRAMEWORK_VERSION=v2.22.0
ARG REGISTRY
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
    -r "${REGISTRY}" \
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
    -r "${REGISTRY}" \
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
    -r "${REGISTRY}" \
    -t "${TRUSTED_BOOT}" \
    -v "${VARIANT}" \
    --k8sversion "${KUBERNETES_VERSION}" \
    --version "${VERSION}"

# hadolint ignore=DL3059
RUN rm /kairos-init
