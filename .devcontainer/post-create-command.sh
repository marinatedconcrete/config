#!/usr/bin/env sh

set -e

# Install prettier
yarn --immutable

ansible-galaxy collection install --no-cache ansible

# https://github.com/devcontainers/features/issues/1235
if uname -r | grep -q '\.fc'; then
  sudo update-alternatives --set iptables /usr/sbin/iptables-nft
fi
