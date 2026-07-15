#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=cli/cli
GH_VERSION=2.95.0

rpm="$(mktemp --tmpdir gh.XXXXXX.rpm)"
trap 'rm -f "${rpm}"' EXIT

curl \
    -fsSL \
    -o "${rpm}" \
    "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.rpm"
dnf install \
    --setopt=install_weak_deps=False \
    -y \
    "${rpm}"
