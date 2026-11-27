---
title: Each minikube start with the pinned Kubernetes version needs --force
type: gotcha
layer: project
state: approved
tags: [repo:marinatedconcrete/config, minikube, kubernetes, ci, rate-limit]
source: minikube v1.39.0 start.go, marinatedconcrete/config#1178, marinatedconcrete/config#1180
scope:
  paths: [ansible/roles/minikube_test/**, justfile]
  labels: [area/ansible, area/dev-tooling]
  lanes: []
---

`minikube_test__kubernetes_version` in `ansible/roles/minikube_test/defaults/main.yml` pins a Kubernetes version that is newer than the newest version in the Minikube list. `minikube config defaults kubernetes-version` shows that list.

For such a version, `minikube start` sends a request to the GitHub API to find the release. The request has no token. Minikube does not use `GITHUB_TOKEN`. When the rate limit is spent, the request gets a 403 response. Without `--force`, Minikube stops with `K8S_FAIL_CONNECT` and exit code 40.

`--force` does not stop the request. It lets the start continue after the request fails.

Thus each `minikube start` that uses the pinned version must have `--force`. The `minikube_test` role and the `pod-security-lint` recipe have it. A green run does not show that a new start is correct, because the failure occurs only when the shared rate limit is spent.

For the history, see issue #1178.
