#!/bin/bash

set -eoux pipefail

# renovate: datasource=github-releases depName=kubernetes/minikube
MINIKUBE_VERSION=v1.38.1

minikube="$(mktemp --tmpdir minikube.XXXXXX)"
trap 'rm -f "${minikube}"' EXIT

curl \
    -fsSL \
    -o "${minikube}" \
    "https://storage.googleapis.com/minikube/releases/${MINIKUBE_VERSION}/minikube-linux-amd64"
install -m 0755 "${minikube}" /usr/local/bin/minikube
