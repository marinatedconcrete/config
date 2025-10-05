#!/usr/bin/env bash

set -ouex pipefail

# Additional Packages
PACKAGES=(
    # Used by `ansible.builtin.expect`
    "python3-pexpect"
)

apt-get update
apt-get upgrade -y
apt-get install -y --no-install-recommends "${PACKAGES[@]}"

# Cleanup
apt-get clean
rm -rf /var/lib/apt/lists/*
