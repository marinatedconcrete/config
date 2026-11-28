#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=kubernetes/minikube
MINIKUBE_VERSION=v1.39.0

minikube="$(mktemp --tmpdir minikube.XXXXXX)"
trap 'rm -f "${minikube}" "${minikube}.sha256"' EXIT

curl \
    -fsSL \
    -o "${minikube}" \
    "https://storage.googleapis.com/minikube/releases/${MINIKUBE_VERSION}/minikube-linux-amd64"
curl \
    -fsSL \
    -o "${minikube}.sha256" \
    "https://storage.googleapis.com/minikube/releases/${MINIKUBE_VERSION}/minikube-linux-amd64.sha256"
echo "$(cat "${minikube}.sha256")  ${minikube}" | sha256sum --check
install -m 0755 "${minikube}" /usr/local/bin/minikube
