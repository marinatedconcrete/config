#!/usr/bin/env sh

set -e

sudo /usr/local/share/docker-init.sh

# Install prettier
yarn --immutable

ansible-galaxy collection install --no-cache ansible
