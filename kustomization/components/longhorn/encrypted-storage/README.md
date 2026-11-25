# Longhorn encrypted storage component

This component adds the `longhorn-encrypted` StorageClass.
Set `storageClassName: longhorn-encrypted` on a new PersistentVolumeClaim to use it.

Install Longhorn 1.13 or later.
Load the `dm_crypt` module and install `cryptsetup` on each node that uses encrypted volumes.
Create the Secret before you mount an encrypted volume.
Keep a secure copy of the passphrase for volume recovery.

## Component example

Replace `{version}` with the release version.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/longhorn/encrypted-storage?ref=kustomize-longhorn@v{version}
```

## Required Secret

Supply your passphrase through your Secret management system.
If you use a different Secret name or namespace, patch all three CSI Secret references in the StorageClass.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: longhorn-crypto
  namespace: longhorn-system
type: Opaque
stringData:
  CRYPTO_KEY_VALUE: "<passphrase>"
  CRYPTO_KEY_PROVIDER: secret
```

See the [Longhorn volume encryption instructions](https://longhorn.io/docs/1.13.0/advanced-resources/security/volume-encryption/).
