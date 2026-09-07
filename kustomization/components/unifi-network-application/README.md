# Unifi Controller Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Funifi-network-application&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-unifi-network-application%22)
[![Pod Security Standard: Baseline](https://img.shields.io/badge/pod_security_standard-baseline-yellow?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Funifi-network-application%2Fstatefulset.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs the [Unifi Network Application](https://github.com/linuxserver/docker-unifi-network-application).
The component needs [Traefik Proxy](https://traefik.io/traefik).

# Examples

Replace `{version}` with the version that you want to use.

See the required patches and secrets below.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/unifi-network-application?ref=kustomize-unifi-network-application@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-unifi-network-application@v{version}/unifi-network-application.yml
```

## Required Patches

### Add ServersTransport to Service

#### `kustomization.yml`

```yaml
patches:
  - path: patches/add_una_svc_serverstransport.yml
    target:
      kind: Service
      name: unifi-network-application-svc
```

#### `patches/add_una_svc_serverstransport.yml`

Use this format for the annotation value: `<deployed-namespace>-unifi-network-application-serverstransport@kubernetescrd`.

```yaml
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    traefik.ingress.kubernetes.io/service.serverstransport: unifi-unifi-network-application-serverstransport@kubernetescrd
  name: this-is-ignored-but-is-required
```

## Required Secrets

### `una-secret`

Define this key in the secret:

- `MONGO_PASS`

You can add more keys to configure other settings.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: una-secret
stringData:
  MONGO_PASS: ...
```
