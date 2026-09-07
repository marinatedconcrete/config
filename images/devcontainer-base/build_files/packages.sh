#!/bin/bash

set -eoux pipefail

# Install the required build packages.
CORE_PACKAGES=(
    "curl"
    "gzip"
    "tar"
)

# Install standard tools in the base image.
COMMON_PACKAGES=(
    # Install DNS diagnostic tools.
    "bind-utils"
    "iproute"
    "iputils"
    # Install basic system utilities.
    "coreutils"
    "jq"
    "sudo"
    "watch"
    # Install version control tools.
    "diffutils"
    "git"
    # Install the text editor.
    "vim"
)

dnf upgrade -y
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${CORE_PACKAGES[@]}" \
    "${COMMON_PACKAGES[@]}"

# Run the scripts for additional package installation.
/ctx/packages/just.sh
