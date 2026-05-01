#!/usr/bin/env bash

set -ouex pipefail

# Additional Packages
PACKAGES=(
    # Used by `ansible.builtin.expect`
    "python3-pexpect"
)

dnf upgrade -y
dnf install -y --setopt=install_weak_deps=False "${PACKAGES[@]}"

# Cleanup
dnf clean all
rm -rf /var/cache/dnf
