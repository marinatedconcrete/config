#!/usr/bin/env bash

set -ouex pipefail

# Additional Packages
PACKAGES=(
    # Required by Longhorn for iSCSI volume support.
    "iscsi-initiator-utils"
    "openssh-server"
    # Used by `ansible.builtin.expect`
    "python3-pexpect"
    "systemd-networkd"
    "systemd-networkd-defaults"
    "rsync"
    "vim"
)

dnf upgrade -y
dnf install -y --setopt=install_weak_deps=False "${PACKAGES[@]}"
