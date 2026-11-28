#!/bin/bash

set -eoux pipefail

# Install just in the base image for use in devcontainers.

# renovate: datasource=github-releases depName=casey/just
JUST_VERSION=1.59.0

tools_dir="$(mktemp -d)"
trap 'rm -rf "${tools_dir}"' EXIT

archive="just-${JUST_VERSION}-x86_64-unknown-linux-musl.tar.gz"
release_url="https://github.com/casey/just/releases/download/${JUST_VERSION}"

curl \
    -fsSL \
    -o "${tools_dir}/${archive}" \
    "${release_url}/${archive}"
curl \
    -fsSL \
    -o "${tools_dir}/SHA256SUMS" \
    "${release_url}/SHA256SUMS"
(cd "${tools_dir}" && grep -F " ${archive}" SHA256SUMS | sha256sum --check)
tar -xz -f "${tools_dir}/${archive}" -C "${tools_dir}" just
mv "${tools_dir}/just" /usr/local/bin/just
