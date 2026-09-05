#!/usr/bin/env bash

set -euo pipefail

# Kairos enables sshd.service during image initialization. Mask socket
# activation because Fedora's sshd.socket conflicts with the daemon.
systemctl mask sshd.socket
systemctl enable sshd.service

# Longhorn is not compatible with multipath.
# See https://longhorn.io/kb/troubleshooting-volume-with-multipath/
systemctl mask multipathd.service multipathd.socket multipathd-queueing.service
# Enable the iSCSI services and socket necessary for Longhorn.
# https://longhorn.io/docs/1.11.1/deploy/install/#installing-open-iscsi
# Let iscsi-init generate the initiator name when the system starts.
systemctl enable iscsi-init.service iscsid.service iscsid.socket

systemctl mask NetworkManager.service NetworkManager-wait-online.service
systemctl enable systemd-networkd.service systemd-resolved.service

# https://docs.k3s.io/installation/requirements?os=rhel#inbound-rules-for-k3s-nodes
# Permit connections to the Kubernetes API server and supervisor.
firewall-offline-cmd --add-port=6443/tcp
# Permit etcd connections for high availability.
firewall-offline-cmd --add-port=2379-2380/tcp
# Permit Flannel VXLAN connections between pods on different nodes.
firewall-offline-cmd --add-port=8472/udp
# Permit connections to kubelet metrics and the API.
firewall-offline-cmd --add-port=10250/tcp

# The firewall rules above let core Kubernetes connections through.
# Disable the firewall to let users access services that use a load balancer.
# Before you enable the firewall, add rules for each service that needs external access.
systemctl mask firewalld
