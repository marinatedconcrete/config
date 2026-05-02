#!/usr/bin/env bash

set -euo pipefail

systemctl enable sshd.socket

# Longhorn is not compatible with multipath.
# See https://longhorn.io/kb/troubleshooting-volume-with-multipath/
systemctl mask multipathd.service multipathd.socket multipathd-queueing.service

systemctl mask NetworkManager.service NetworkManager-wait-online.service
systemctl enable systemd-networkd.service systemd-resolved.service
