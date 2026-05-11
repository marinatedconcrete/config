#!/usr/bin/env bash

set -ouex pipefail

# Additional Packages
PACKAGES=(
    # Required for AMD GPU initialization.
    "amd-gpu-firmware"
    # CPU microcode updates for AMD nodes.
    "amd-ucode-firmware"
    # Required for Intel Quick Sync/VAAPI on systems using i915.
    "intel-gpu-firmware"
    # Firmware for Intel Wi-Fi adapters used by some nodes.
    "iwlwifi-mvm-firmware"
    # CPU microcode updates for Intel nodes.
    "microcode_ctl"
    # Firmware for MediaTek Wi-Fi/Bluetooth adapters used by some nodes.
    "mt7xxx-firmware"
    # Firmware for Realtek NICs and Intel Bluetooth used by several nodes.
    "linux-firmware"
    # Wireless regulatory database referenced by cfg80211.
    "wireless-regdb"
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
