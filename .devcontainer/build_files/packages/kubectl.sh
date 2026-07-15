#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=kubernetes/kubernetes
KUBECTL_VERSION=v1.36.2

kubectl="$(mktemp --tmpdir kubectl.XXXXXX)"
trap 'rm -f "${kubectl}"' EXIT

curl \
    -fsSL \
    -o "${kubectl}" \
    "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
install -m 0755 "${kubectl}" /usr/local/bin/kubectl
