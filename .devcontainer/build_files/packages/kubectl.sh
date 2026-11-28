#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=kubernetes/kubernetes
KUBECTL_VERSION=v1.37.2

kubectl="$(mktemp --tmpdir kubectl.XXXXXX)"
trap 'rm -f "${kubectl}" "${kubectl}.sha256"' EXIT

curl \
    -fsSL \
    -o "${kubectl}" \
    "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
curl \
    -fsSL \
    -o "${kubectl}.sha256" \
    "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl.sha256"
echo "$(cat "${kubectl}.sha256")  ${kubectl}" | sha256sum --check
install -m 0755 "${kubectl}" /usr/local/bin/kubectl
