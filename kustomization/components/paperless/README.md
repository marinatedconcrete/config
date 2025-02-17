# Paperless Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fpaperless&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-paperless%22)
[![Pod Security Standard: Baseline](https://img.shields.io/badge/pod_security_standard-baseline-yellow?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Fpaperless%2Fstatefulset.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This will deploy an instance of [paperless-ngx](https://docs.paperless-ngx.com/). This component requires a redis instance (provided via component of the same name) and optionally can use the related samba component.

# Example Usage

Note: please replace `{version}` with the desired version you wish to use.

See below for additionally required patches and secrets.

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

This contains the administrator password used by the container, and any dates that you may want to ignore. The admin password is not user facing, because the container is set up to automatically login as the admin, assuming that some external mechanism (ex: Authelia) provides an authentication solution.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: paperless-secrets
stringData:
  # comma separate multiple dates
  # These dates may be sensitive or non-public (ex: birthdays) and thus best represented as a secret.
  ignored_dates: "2023-12-28,1980-04-23"
  paperless_admin_password: super-secure-unhashed-password
```

# Optional Components

See the [samba-upload component](../samba-upload/README.md).

# Optional Patches

## Set the paperless hostname

You may want to configure the [PAPERLESS_URL](https://docs.paperless-ngx.com/configuration/#PAPERLESS_URL) setting to ensure proper security, especially if this service is exposed on the internet.

```yaml
patches:
  - path: patches/configure-hostname.yml
    target:
      kind: StatefulSet
      name: paperless
```
