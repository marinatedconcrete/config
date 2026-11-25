# Longhorn S3 backup component

This component adds a backup target named `s3`. It leaves the `default` target in place.
Install Longhorn 1.13 or later.
Create the S3 bucket and supply credentials with access to the bucket.
Set `backupTargetName: s3` in the parameters of a StorageClass for new volumes that use this target.
To start backups, use the Longhorn UI or configure a Longhorn recurring backup job.

## Component example

Replace `{version}` with the release version.
Set `namespace` to the namespace of the Longhorn installation.
Replace `my-bucket` and `us-east-1` with the bucket name and region.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: longhorn-system
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/longhorn/s3-backup?ref=kustomize-longhorn@v{version}
patches:
  - target:
      group: longhorn.io
      kind: BackupTarget
      name: s3
    patch: |-
      - op: replace
        path: /spec/backupTargetURL
        value: s3://my-bucket@us-east-1/
```

## Required Secret

Create the Secret in the Longhorn namespace.
Supply the keys through your Secret management system.
For an S3-compatible provider, set `AWS_ENDPOINTS` to the provider URL.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: longhorn-s3-credentials
  namespace: longhorn-system
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: "<access-key-id>"
  AWS_SECRET_ACCESS_KEY: "<secret-access-key>"
```

See the [Longhorn backup target instructions](https://longhorn.io/docs/1.13.0/snapshots-and-backups/backup-and-restore/set-backup-target/).
