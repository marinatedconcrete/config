#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=casey/just
JUST_VERSION=1.53.0

tools_dir="$(mktemp -d)"
trap 'rm -rf "${tools_dir}"' EXIT

curl \
    -fsSL \
    "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-x86_64-unknown-linux-musl.tar.gz" |
    tar -xz -C "${tools_dir}" just
install -m 0755 "${tools_dir}/just" /usr/local/bin/just
