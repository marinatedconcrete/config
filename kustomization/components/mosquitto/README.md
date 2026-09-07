# Mosquitto Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fmosquitto&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-mosquitto%22)
[![Pod Security Standard: Restricted](https://img.shields.io/badge/pod_security_standard-restricted-green?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Fmosquitto%2Fdeployment.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs [Mosquitto](https://mosquitto.org/).
The container runs as the `mosquitto` user from the [`mosquitto` Docker image](https://github.com/eclipse/mosquitto/tree/master/docker/2.0).
This user has a `uid` and `gid` of `1883`.

# Examples

Replace `{version}` with the version that you want to use.

See the required patches and secrets below.

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

This secret contains the login credentials for the `password.conf` file in the container.
Each key is a username, and its value is a password.
The setup script hashes each password and adds the result to `password.conf`.

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

To change the [Mosquitto configuration](https://mosquitto.org/man/mosquitto-conf-5.html), add your configuration files with a patch.
You can put multiple `.conf` files in the `ConfigMap`.

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

This patch uses `$patch: delete` to remove the `emptyDir` configuration.
The patch mounts the `ConfigMap` defined above in its place.

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
