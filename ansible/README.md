# Ansible collection `marinatedconcrete.config`

This collection holds Ansible roles for the Marinated Concrete home infrastructure.

## Requirements

- `ansible-core` 2.19.3 or later.
- The [`kubernetes.core`](https://galaxy.ansible.com/ui/repo/published/kubernetes/core/) collection, version 2.0.0 or later. `ansible-galaxy` installs it with this collection.
- The [`kubernetes`](https://pypi.org/project/kubernetes/) Python package on the control node. The `kubernetes.core` collection uses it.

## Installation

Each release of this collection has a Git tag with the form `ansible-collection@vX.Y.Z`.
See the [releases](https://github.com/marinatedconcrete/config/releases) for the versions.
Replace `X.Y.Z` with the version that you need.

To install the collection, run this command:

```sh
ansible-galaxy collection install "git+https://github.com/marinatedconcrete/config.git#/ansible/,ansible-collection@vX.Y.Z"
```

To install the collection from a `requirements.yml` file, add this entry:

```yaml
collections:
  - name: https://github.com/marinatedconcrete/config.git#/ansible/
    type: git
    version: ansible-collection@vX.Y.Z
```

## Roles

### `longhorn_allow_encrypted_trim`

This role finds each attached, encrypted Longhorn `Volume`.
It sets the `discards` flag on each of these volumes, so that the trim command operates on them.
The role runs `cryptsetup` on the node that owns the volume.
It reads the encryption key from the `Secret` that the `StorageClass` names.
See the [role README](roles/longhorn_allow_encrypted_trim/README.md) for the requirements and an example playbook.

### `minikube_test`

This role starts a Minikube cluster and applies a kustomization to it.
The Kustomize component tests in this repository use this role.
Options can enable local path storage and prepare the node for a `Pod` with `hostUsers: false`.
At the end of the play, the role stops and deletes the Minikube profile.
See [`defaults/main.yml`](roles/minikube_test/defaults/main.yml) for the options.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
