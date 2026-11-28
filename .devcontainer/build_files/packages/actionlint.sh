#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=rhysd/actionlint
ACTIONLINT_VERSION=1.7.12

tools_dir="$(mktemp -d)"
trap 'rm -rf "${tools_dir}"' EXIT

archive="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
release_url="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}"

curl \
    -fsSL \
    -o "${tools_dir}/${archive}" \
    "${release_url}/${archive}"
curl \
    -fsSL \
    -o "${tools_dir}/checksums.txt" \
    "${release_url}/actionlint_${ACTIONLINT_VERSION}_checksums.txt"
(cd "${tools_dir}" && grep -F " ${archive}" checksums.txt | sha256sum --check)
tar -xz -f "${tools_dir}/${archive}" -C "${tools_dir}" actionlint
install -m 0755 "${tools_dir}/actionlint" /usr/local/bin/actionlint
