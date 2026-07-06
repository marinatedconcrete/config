#!/bin/bash

set -eoux pipefail

PACKAGES=(
    "edk2-ovmf"
    "libssh-devel"
    "openssh-clients"
    "openssl"
    "python3"
    "python3-pip"
    "qemu-img"
    "qemu-system-x86-core"
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
/ctx/packages/kubectl.sh
/ctx/packages/minikube.sh
