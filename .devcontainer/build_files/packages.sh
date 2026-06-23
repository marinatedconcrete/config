#!/bin/bash

set -eoux pipefail

PACKAGES=(
    "libssh-devel"
    "openssl"
    "python3"
    "python3-pip"
    "shellcheck"
    "yq"
)

dnf upgrade -y
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${PACKAGES[@]}"

/ctx/packages/docker.sh
/ctx/packages/github-cli.sh
/ctx/packages/helm.sh
/ctx/packages/just.sh
/ctx/packages/kubectl.sh
/ctx/packages/minikube.sh
