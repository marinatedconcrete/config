#!/usr/bin/env bash

set -eoux pipefail

# Install standard shell and system tools for CI job containers.
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

# Build tools are necessary for Homebrew on Linux to compile packages from source.
dnf group install \
    -y \
    development-tools
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${PACKAGES[@]}"

/ctx/packages/homebrew.sh
