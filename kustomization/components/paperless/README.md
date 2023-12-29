# Paperless Component

This will deploy an instance of [paperless-ngx](https://docs.paperless-ngx.com/). This component requires a redis instance (provided via component of the same name) and optionally can use the related samba component.

# Example Usage

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: paperless

components:
  # Core paperless service
  - https://github.com/marinatedconcrete/config/kustomization/components/paperless
  # Paperless depends on redis
  - https://github.com/marinatedconcrete/config/kustomization/components/redis
```

See below for additionally required patches and secrets.

## Required Secrets

### `paperless-secrets`

This contains the administrator password used by the container, and any dates that you may want to ignore. The admin password is not user facing, because the container is set up to automatically login as the admin, assuming that some external mechanism (ex: Authelia) provides an authentication solution.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: paperless-secrets
stringData:
  # comma separate multiple dates
  # These dates may be sensitive or non-public (ex: birthdays) and thus best represented as a secret.
  ignored_dates: '2023-12-28,1980-04-23'
  paperless_admin_password: super-secure-unhashed-password
```

## Optional Components
See the [samba-upload component](../samba-upload/README.md).

## Optional Patches

### Set the paperless hostname

You may want to configure the [PAPERLESS_URL](https://docs.paperless-ngx.com/configuration/#PAPERLESS_URL) setting to ensure proper security, especially if this service is exposed on the internet.

```yaml
patches:
  - path: patches/configure-hostname.yml
    target:
      kind: StatefulSet
      name: paperless
```
