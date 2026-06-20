#!/usr/bin/env bash

set -eoux pipefail

# The small set of broadly useful shell/system tools for CI job containers.
PACKAGES=(
    "bash"
    "bubblewrap"
    "ca-certificates"
    "file"
    "findutils"
    "jq"
    "procps-ng"
    "ripgrep"
    "shadow-utils"
    "ShellCheck"
    "unzip"
    "which"
    "xz"
    "yq"
)

dnf upgrade -y

# Homebrew-on-Linux needs a build toolchain for formulae that compile from source.
dnf group install \
    -y \
    development-tools
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${PACKAGES[@]}"

/ctx/packages/homebrew.sh
