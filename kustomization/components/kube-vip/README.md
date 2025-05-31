# kube-vip Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fkube-vip&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-kube-vip%22)
[![Pod Security Standard: Privileged](https://img.shields.io/badge/pod_security_standard-privileged-red?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

This will deploy [kube-vip](https://kube-vip.io/) as two `DaemonSet`s:

1. for the control plane
2. for all services' ingress IP address

# Example Usage

Note: please replace `{version}` with the desired version you wish to use.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/kube-vip?ref=kustomize-kube-vip@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-kube-vip@v{version}/kube-vip.yml
```

# Patches

## Required

### Set the VIP Address

This is the controlplane VIP address for your cluster.

#### `kustomization.yml`

```yaml
patches:
  - path: patches/set_kube-vip_address.yml
    target:
      kind: DaemonSet
      name: kube-vip-ds
```

#### `patches/set_kube-vip_address.yml`

```yaml
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: this-is-ignored-but-is-required
spec:
  template:
    spec:
      containers:
        - env:
            - name: vip_address
              value: 233.252.0.42
          name: kube-vip
```
