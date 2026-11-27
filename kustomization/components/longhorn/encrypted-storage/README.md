# Longhorn encrypted storage component

This component adds the `longhorn-encrypted` StorageClass.
Set `storageClassName: longhorn-encrypted` on a new PersistentVolumeClaim to use it.
The `Retain` policy keeps the volume after you delete the claim.
Remove the volume manually when you no longer need the data.

Install Longhorn with support for encrypted volumes.
The Kairos Fedora image includes `cryptsetup` and the kernel modules.
On other images, install `cryptsetup`.
Load the `dm_crypt` module on each storage node.
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

See the [Longhorn volume encryption instructions](https://longhorn.io/docs/1.12.0/advanced-resources/security/volume-encryption/).
