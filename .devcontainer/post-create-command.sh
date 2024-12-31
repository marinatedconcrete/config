#!/usr/bin/env sh

set -e

# Install prettier
yarn

ansible-galaxy collection install --no-cache ansible
