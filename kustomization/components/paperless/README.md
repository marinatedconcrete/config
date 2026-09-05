# Paperless Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fpaperless&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-paperless%22)
[![Pod Security Standard: Baseline](https://img.shields.io/badge/pod_security_standard-baseline-yellow?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Fpaperless%2Fstatefulset.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs [paperless-ngx](https://docs.paperless-ngx.com/).
A Redis instance is necessary. The Redis component supplies this instance.
The component includes a Samba container for scanned document uploads through the network.

# Examples

Replace `{version}` with the version that you want to use.

See the required patches and secrets below.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/paperless?ref=kustomize-paperless@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-paperless@v{version}/paperless.yml
```

# Required Secrets

## `paperless-secrets`

This secret contains the administrator password, the secret key for cryptographic signing, and the dates to ignore.
Use a long, random value for the secret key.
Keep this value unchanged across restarts and upgrades.

The container logs in as the administrator automatically.
Users do not enter this password.
This configuration needs an external authentication service, such as Authelia.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: paperless-secrets
stringData:
  # Separate multiple dates with commas.
  # Store private dates, such as birthdays, in a secret.
  ignored_dates: "2023-12-28,1980-04-23"
  paperless_admin_password: super-secure-unhashed-password
  paperless_secret_key: long-random-secret-key
```


# Samba Uploads

Scanners with network access can upload documents to CIFS/SMB network shares.
The Samba container gives scanners access to the `paperless-scans` PVC.
Paperless processes these files automatically.
Paperless removes each file from this PVC after processing.

### `kustomization.yml`

```yaml
patches:
  # Configure the external IP address for the Samba service.
  - path: patches/configure-samba-address.yml
    target:
      kind: Service
      name: samba
  # As an alternative, configure a kube-vip annotation.
  - path: patches/configure-samba-annotation.yml
    target:
      kind: Service
      name: samba
```

#### `patches/configure-samba-address.yml`

```yaml
---
apiVersion: v1
kind: Service
metadata:
  name: this-is-ignored-but-is-required
spec:
  loadBalancerIP: 192.0.2.2
```

#### `patches/configure-samba-annotation.yml`

```yaml
---
- op: add
  path: /metadata/annotations
  value:
    kube-vip.io/loadbalancerIPs: 192.0.2.2
```

# Optional Patches

## Set the paperless hostname

Use [PAPERLESS_URL](https://docs.paperless-ngx.com/configuration/#PAPERLESS_URL) to configure the service URL for security checks.
This setting is very important when users can access the service from the internet.

```yaml
patches:
  - path: patches/configure-hostname.yml
    target:
      kind: StatefulSet
      name: paperless
```

#### `patches/configure-hostname.yml`

```yaml
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: this-is-ignored-but-is-required
spec:
  template:
    spec:
      containers:
        - name: paperless
          env:
            - name: PAPERLESS_URL
              value: https://paperless.example.com
```
