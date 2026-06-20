#!/bin/bash

set -eoux pipefail

TOOLS_DIR="$(mktemp -d)"
trap 'rm -rf "${TOOLS_DIR}"' EXIT

install_kubectl() {
    curl \
        -fsSL \
        -o "${TOOLS_DIR}/kubectl" \
        "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
    install -m 0755 "${TOOLS_DIR}/kubectl" /usr/local/bin/kubectl
}

install_helm() {
    curl \
        -fsSL \
        -o "${TOOLS_DIR}/get-helm-3" \
        https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod +x "${TOOLS_DIR}/get-helm-3"
    DESIRED_VERSION="${HELM_VERSION}" "${TOOLS_DIR}/get-helm-3"
}

install_minikube() {
    curl \
        -fsSL \
        -o "${TOOLS_DIR}/minikube" \
        "https://storage.googleapis.com/minikube/releases/${MINIKUBE_VERSION}/minikube-linux-amd64"
    install -m 0755 "${TOOLS_DIR}/minikube" /usr/local/bin/minikube
}

install_github_cli() {
    curl \
        -fsSL \
        -o "${TOOLS_DIR}/gh.rpm" \
        "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.rpm"
    dnf install -y "${TOOLS_DIR}/gh.rpm"
}

install_hadolint() {
    curl \
        -fsSL \
        -o "${TOOLS_DIR}/hadolint" \
        "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-Linux-x86_64"
    install -m 0755 "${TOOLS_DIR}/hadolint" /usr/local/bin/hadolint
}

install_just() {
    curl \
        -fsSL \
        "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-x86_64-unknown-linux-musl.tar.gz" |
        tar -xz -C "${TOOLS_DIR}" just
    install -m 0755 "${TOOLS_DIR}/just" /usr/local/bin/just
}

install_kustomize() {
    curl \
        -fsSL \
        "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${KUSTOMIZE_VERSION}/kustomize_v${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" |
        tar -xz -C "${TOOLS_DIR}" kustomize
    install -m 0755 "${TOOLS_DIR}/kustomize" /usr/local/bin/kustomize
}

install_kubectl
install_helm
install_minikube
install_github_cli
install_hadolint
install_just
install_kustomize
