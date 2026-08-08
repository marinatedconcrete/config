#!/usr/bin/env bash

set -eoux pipefail

PACKAGES=(
    "curl"
    "jq"
    "nodejs"
)

dnf upgrade -y
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${PACKAGES[@]}"
