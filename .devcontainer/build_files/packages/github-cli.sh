#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=cli/cli
GH_VERSION=2.106.0

rpm="$(mktemp --tmpdir gh.XXXXXX.rpm)"
trap 'rm -f "${rpm}" "${rpm}.sha256"' EXIT

curl \
    -fsSL \
    -o "${rpm}" \
    "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.rpm"
curl \
    -fsSL \
    -o "${rpm}.sha256" \
    "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt"
echo "$(grep -F " gh_${GH_VERSION}_linux_amd64.rpm" "${rpm}.sha256" | cut -d ' ' -f 1)  ${rpm}" | sha256sum --check
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${rpm}"
