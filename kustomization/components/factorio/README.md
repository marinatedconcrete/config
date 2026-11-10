# Factorio Server Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Ffactorio&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-factorio%22)
[![Pod Security Standard: Restricted](https://img.shields.io/badge/pod_security_standard-restricted-green?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Ffactorio%2Fstatefulset.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs the [Open Factorio Server Manager](https://github.com/OpenFactorioServerManager/factorio-server-manager).

# Examples

Replace `{version}` with the version that you want to use.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/factorio?ref=kustomize-factorio@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-factorio@v{version}/factorio.yml
```

# Required Setup

## Enable User Namespaces

The `Pod` runs in a user namespace, because the component sets `hostUsers: false`. Each node must support user namespaces. Read the [Kubernetes requirements for user namespaces](https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/#before-you-begin) for the versions of the kernel, the container runtime, and Kubernetes. On a node without this support, the `Pod` does not start.
