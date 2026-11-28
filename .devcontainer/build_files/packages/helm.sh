#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=helm/helm
HELM_VERSION=v4.3.2

tools_dir="$(mktemp -d)"
trap 'rm -rf "${tools_dir}"' EXIT

archive="helm-${HELM_VERSION}-linux-amd64.tar.gz"

curl \
    -fsSL \
    -o "${tools_dir}/${archive}" \
    "https://get.helm.sh/${archive}"
curl \
    -fsSL \
    -o "${tools_dir}/${archive}.sha256sum" \
    "https://get.helm.sh/${archive}.sha256sum"
(cd "${tools_dir}" && sha256sum --check "${archive}.sha256sum")
tar -xz -f "${tools_dir}/${archive}" -C "${tools_dir}"
install -m 0755 "${tools_dir}/linux-amd64/helm" /usr/local/bin/helm
