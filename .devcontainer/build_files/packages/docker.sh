#!/bin/bash

set -eoux pipefail

install -d /etc/pki/rpm-gpg /etc/yum.repos.d
curl -fsSL https://download.docker.com/linux/centos/gpg > /etc/pki/rpm-gpg/docker-ce.gpg

cat > /etc/yum.repos.d/docker-ce.repo <<'EOF'
[docker-ce-stable]
name=Docker CE Stable
baseurl=https://download.docker.com/linux/centos/9/$basearch/stable
enabled=1
gpgcheck=1
gpgkey=file:///etc/pki/rpm-gpg/docker-ce.gpg
skip_if_unavailable=1
module_hotfixes=1
EOF

dnf install \
    --setopt=install_weak_deps=False \
    -y \
    containerd.io \
    docker-ce \
    docker-ce-cli
