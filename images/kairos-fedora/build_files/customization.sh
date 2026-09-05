#!/usr/bin/env bash

set -ouex pipefail

# Install additional packages.
PACKAGES=(
    # Initialize AMD GPUs.
    "amd-gpu-firmware"
    # Update CPU microcode for AMD nodes.
    "amd-ucode-firmware"
    # Supply Intel Quick Sync/VAAPI support for systems that use i915.
    "intel-gpu-firmware"
    # Supply firmware for Intel Wi-Fi adapters.
    "iwlwifi-mvm-firmware"
    # Update CPU microcode for Intel nodes.
    "microcode_ctl"
    # Supply firmware for MediaTek Wi-Fi/Bluetooth adapters.
    "mt7xxx-firmware"
    # Supply firmware for Realtek NICs and Intel Bluetooth adapters.
    "linux-firmware"
    # Supply the wireless regulatory database for cfg80211.
    "wireless-regdb"
    # Supply iSCSI volume support for Longhorn.
    "iscsi-initiator-utils"
    "openssh-server"
    # Supply the dependency for `ansible.builtin.expect`.
    "python3-pexpect"
    "rsync"
    "systemd-networkd"
    "systemd-networkd-defaults"
    "tcpdump"
    "vim"
)

dnf upgrade -y
dnf install -y --setopt=install_weak_deps=False "${PACKAGES[@]}"
