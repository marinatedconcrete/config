# Mosquitto Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fmosquitto&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-mosquitto%22)
[![Pod Security Standard: Restricted](https://img.shields.io/badge/pod_security_standard-restricted-green?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Fmosquitto%2Fstatefulset.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This will deploy the [Mosquitto](https://mosquitto.org/). This runs as as the `mosquitto` user
from the [`mosquitto` Docker image](https://github.com/eclipse/mosquitto/tree/master/docker/2.0),
which runs with a `uid` and `gid` of `1883`.

# Example Usage

Note: please replace `{version}` with the desired version you wish to use.

See below for additionally required patches and secrets.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/mosquitto?ref=kustomize-mosquitto@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-mosquitto@v{version}/mosquitto.yml
```

# Required Secrets

## `mosquitto-password-conf-secret`

This contains the logins that you want to be included in the `password.conf` file in the container.
Each key will be treated as the username, and the contents the password to hash and add to
`password.conf`.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mosquitto-password-conf-secret
stringData:
  someuser: super-secure-unhashed-password
```

# Optional Patches

## Add Configuration Options

If you want to change the [configuration](https://mosquitto.org/man/mosquitto-conf-5.html) of
`mosquitto`, you can patch in your own config files. You can place as many `.conf` files as you
would like in the `ConfigMap`.

### `kustomization.yml`

```yaml
configMapGenerator:
  - files:
      - configmap/logging.conf
    name: mosquitto-config-configmap
patches:
  - path: patches/add_custom_config.yml
    target:
      kind: Deployment
      name: mosquitto-deployment
```

### `configmap/logging.conf`

```
log_type all
```

### `patches/add_custom_config.yml`

This patch is taking advantage of the `$patch: delete` functionality of Kustomize to remove the
`emptyDir` configuration and instead mount the `ConfigMap` that was just defined.

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: this-is-ignored-but-is-required
spec:
  template:
    spec:
      volumes:
        - emptyDir:
            $patch: delete
          name: mosquitto-config
          configMap:
            name: mosquitto-config-configmap
```
