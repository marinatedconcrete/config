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
