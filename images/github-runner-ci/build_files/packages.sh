#!/usr/bin/env bash

set -eoux pipefail

# The small set of broadly useful shell/system tools for CI job containers.
PACKAGES=(
    "bash"
    "ca-certificates"
    "findutils"
    "shadow-utils"
    "ShellCheck"
    "unzip"
    "which"
    "xz"
    "yq"
)

dnf upgrade -y
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${PACKAGES[@]}"
