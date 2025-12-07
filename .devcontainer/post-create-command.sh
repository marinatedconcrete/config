#!/usr/bin/env sh

set -e

# Install prettier
yarn --immutable

ansible-galaxy collection install --no-cache ansible
