FROM scratch AS ctx
COPY .devcontainer/build_files /
COPY ansible/requirements.txt /requirements.txt

# hadolint ignore=DL3007
FROM ghcr.io/marinatedconcrete/devcontainer-base:latest

# renovate: datasource=github-releases depName=cli/cli
ARG GH_VERSION=2.95.0
# renovate: datasource=github-releases depName=hadolint/hadolint
ARG HADOLINT_VERSION=2.14.0
# renovate: datasource=github-releases depName=helm/helm
ARG HELM_VERSION=v3.21.1
# renovate: datasource=github-releases depName=casey/just
ARG JUST_VERSION=1.53.0
# renovate: datasource=github-releases depName=kubernetes/kubernetes
ARG KUBECTL_VERSION=v1.36.1
# renovate: datasource=github-releases depName=kubernetes/minikube
ARG MINIKUBE_VERSION=v1.38.1
# renovate: datasource=github-releases depName=kubernetes-sigs/kustomize
ARG KUSTOMIZE_VERSION=5.8.1

USER root

RUN --mount=type=bind,from=ctx,source=/,target=/ctx \
    --mount=type=cache,dst=/var/cache \
    --mount=type=cache,dst=/var/log \
    --mount=type=tmpfs,dst=/tmp \
    GH_VERSION=${GH_VERSION} \
    HADOLINT_VERSION=${HADOLINT_VERSION} \
    HELM_VERSION=${HELM_VERSION} \
    JUST_VERSION=${JUST_VERSION} \
    KUBECTL_VERSION=${KUBECTL_VERSION} \
    MINIKUBE_VERSION=${MINIKUBE_VERSION} \
    KUSTOMIZE_VERSION=${KUSTOMIZE_VERSION} \
    /ctx/build.sh

USER vscode
