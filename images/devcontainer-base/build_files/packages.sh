#!/bin/bash

set -eoux pipefail

# The set of packages that are needed for this build to work.
CORE_PACKAGES=(
    "curl"
    "gzip"
    "tar"
)

# The set of packages that we agree are too useful to not have in the base
# image.
COMMON_PACKAGES=(
    # It's never DNS, but it's good to verify that...
    "bind-utils"
    "iproute"
    "iputils"
    # These are core utilities that seem silly to not include.
    "coreutils"
    "jq"
    "sudo"
    "watch"
    # Source Control
    "diffutils"
    "git"
    # Editor of choice.
    "vim"
)

dnf upgrade -y
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${CORE_PACKAGES[@]}" \
    "${COMMON_PACKAGES[@]}"

# Now we can invoke some additional scripts for potentially more complicated installs.
/ctx/packages/just.sh
