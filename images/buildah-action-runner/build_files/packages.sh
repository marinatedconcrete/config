#!/usr/bin/env bash

set -eoux pipefail

PACKAGES=(
    "curl"
    "jq"
    "nodejs"
)

# Unlike other, wider images we have, we do not run `dnf upgrade -y` here.
# The base image is pinned by digest, and upgrading here could potentially
# pull newer buildah/fuse-overlayfs/etc. out from under that pin, defeating
# the entire purpose of the pin!
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${PACKAGES[@]}"
