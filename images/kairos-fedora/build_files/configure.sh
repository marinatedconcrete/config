#!/usr/bin/env bash

set -euo pipefail

systemctl enable sshd.socket

# Longhorn is not compatible with multipath.
# See https://longhorn.io/kb/troubleshooting-volume-with-multipath/
systemctl mask multipathd.service multipathd.socket multipathd-queueing.service
# Longhorn requires these to be enabled
# https://longhorn.io/docs/1.11.1/deploy/install/#installing-open-iscsi
# We don't want to generate the initiatior name at build-time.
# Instead, the iscsi-init service will do this for us
systemctl enable iscsi-init.service iscsid.service iscsid.socket

systemctl mask NetworkManager.service NetworkManager-wait-online.service
systemctl enable systemd-networkd.service systemd-resolved.service
