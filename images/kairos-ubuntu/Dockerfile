# See https://kairos.io/docs/reference/kairos-factory/ for more details.

FROM quay.io/kairos/kairos-init:v0.5.4@sha256:ae1c4d470c802c103d43bb06347f0884cb50a4f44504cb87963c064a265dd438 AS kairos-init

FROM ubuntu:24.04@sha256:440dcf6a5640b2ae5c77724e68787a906afb8ddee98bf86db94eea8528c2c076 AS base-kairos
LABEL org.opencontainers.image.title="A custom Ubuntu-based Kairos image."
LABEL org.opencontainers.image.title="kairos-ubuntu"
ARG VARIANT=standard
ARG MODEL=generic
ARG TRUSTED_BOOT=false
ARG KUBERNETES_DISTRO=k3s
# renovate: datasource=github-releases depName=k3s-io/k3s
ARG KUBERNETES_VERSION=v1.33.1+k3s1
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
