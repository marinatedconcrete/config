# Paperless Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fpaperless&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-paperless%22)
[![Pod Security Standard: Baseline](https://img.shields.io/badge/pod_security_standard-baseline-yellow?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Fpaperless%2Fstatefulset.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs [paperless-ngx](https://docs.paperless-ngx.com/).
A Redis instance is necessary. The Redis component supplies this instance.
The Paperless `Pod` includes a Samba container for scanned document uploads through the network.

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

This secret contains the administrator password, the secret key for cryptographic signing, the dates to ignore, and the Samba password.
Use a long, random value for the secret key.
Keep this value unchanged across restarts and upgrades.

The container logs in as the administrator automatically.
Users do not enter this password.
This configuration needs an external authentication service, such as Authelia.

Scanners use the Samba password to upload documents.
If the secret does not contain `printer_samba_password`, the Samba container does not start.
Then the Paperless `Pod` does not become ready, and the Paperless service is not available.

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
  printer_samba_password: scanner-password
```

# Required Setup

## Enable User Namespaces

The `Pod` runs in a user namespace, because the component sets `hostUsers: false`. Each node must support user namespaces. Read the [Kubernetes requirements for user namespaces](https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/#before-you-begin) for the versions of the kernel, the container runtime, and Kubernetes. On a node without this support, the `Pod` does not start. The volumes of the `Pod` must support idmapped mounts. NFS volumes do not. Longhorn `ReadWriteMany` volumes use NFS.


# Samba Uploads

Scanners with network access can upload documents to CIFS/SMB network shares.
The Samba container in the Paperless `Pod` gives scanners access to the `paperless-consume` PVC.
The share name is `Scans`, and the user name is `printer`.
Paperless processes these files automatically.
Paperless removes each file from this PVC after processing.

### `kustomization.yml`

```yaml
patches:
  # Configure the external IP address for the Samba service.
  - path: patches/configure-samba-address.yml
    target:
      kind: Service
      name: samba-svc
  # As an alternative, configure a kube-vip annotation.
  - path: patches/configure-samba-annotation.yml
    target:
      kind: Service
      name: samba-svc
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

## Network Policies

The `samba-svc` Service accepts TCP port 445 and sends it to the port named `smb` of the Paperless `Pod`.
A NetworkPolicy matches the port of the `Pod`, not the port of the Service.
If a NetworkPolicy selects the Paperless `Pod` for ingress, allow the port named `smb` from the scanners.

## Change the Samba Container

To change the Samba configuration, patch the `samba` container of the `paperless` StatefulSet.
Use a strategic merge patch that names the container.
Do not use a JSON patch with a container index, because the index can change.
The Samba container can mount the other volumes of the `Pod`, for example `paperless-media`.

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

# Upgrade to Version 2

Version 2 moves the Samba container into the Paperless `Pod`.
Version 2 also runs the `Pod` in a user namespace.

Before the upgrade, do these steps:

1. Make sure that each node supports user namespaces. See [Enable User Namespaces](#enable-user-namespaces).
2. Make sure that `paperless-secrets` contains `printer_samba_password`.
3. Move each patch for the `samba` Deployment to the `samba` container of the `paperless` StatefulSet. See [Change the Samba Container](#change-the-samba-container).
4. Change each patch for the `paperless-scans` PVC to the `paperless-consume` PVC.
5. If a NetworkPolicy selects the Paperless `Pod` for ingress, allow the port named `smb`. See [Network Policies](#network-policies).
6. Make sure that the `paperless-scans` PVC is empty. After the upgrade, Paperless does not read the files in this PVC.

The `paperless-consume` PVC replaces the `paperless-scans` PVC, because the access mode of a PVC cannot change.
Version 2 does not use the `samba` Deployment or the `paperless-scans` PVC.
If your deployment tool does not delete unused resources, delete them manually after the upgrade:

```shell
kubectl --namespace <namespace> delete deployment samba
kubectl --namespace <namespace> delete pvc paperless-scans
```

Version 1 uses these resources again if you go back to version 1.
Delete them only after version 2 works.
