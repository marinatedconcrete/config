#!/bin/bash

set -eoux pipefail

# Just is so common and useful in our devcontainers, that we actually set it
# up in the base image.

# renovate: datasource=github-releases depName=casey/just
JUST_VERSION=1.51.0
  curl \
    -s \
    -L \
    https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-x86_64-unknown-linux-musl.tar.gz | \
        tar -xvzf - -C /tmp
mv /tmp/just /usr/local/bin/just
