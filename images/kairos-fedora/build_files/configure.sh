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

# https://docs.k3s.io/installation/requirements?os=rhel#inbound-rules-for-k3s-nodes
# k8s API server and supervisor
firewall-offline-cmd --add-port=6443/tcp
# etcd for HA setups
firewall-offline-cmd --add-port=2379-2380/tcp
# flannel VXLAN for pod/pod communication across nodes
firewall-offline-cmd --add-port=8472/udp
# kubelet metrics and API
firewall-offline-cmd --add-port=10250/tcp
# pods
firewall-offline-cmd --zone=trusted --add-source=10.42.0.0/16
# services
firewall-offline-cmd --zone=trusted --add-source=10.43.0.0/16
