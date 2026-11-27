#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=rhysd/actionlint
ACTIONLINT_VERSION=1.7.12

tools_dir="$(mktemp -d)"
trap 'rm -rf "${tools_dir}"' EXIT

curl \
    -fsSL \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" |
    tar -xz -C "${tools_dir}" actionlint
install -m 0755 "${tools_dir}/actionlint" /usr/local/bin/actionlint
