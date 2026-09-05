#!/usr/bin/env sh

set -e

sudo /usr/local/share/docker-init.sh

# Install dependencies. Configure Prettier.
yarn --immutable

ansible-galaxy collection install --no-cache ansible
