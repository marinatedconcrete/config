#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=helm/helm
HELM_VERSION=v3.21.3

tools_dir="$(mktemp -d)"
trap 'rm -rf "${tools_dir}"' EXIT

curl \
    -fsSL \
    "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" |
    tar -xz -C "${tools_dir}"
install -m 0755 "${tools_dir}/linux-amd64/helm" /usr/local/bin/helm
