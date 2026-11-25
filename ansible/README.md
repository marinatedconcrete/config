# Ansible collection `marinatedconcrete.config`

This collection holds Ansible roles and playbooks for the Marinated Concrete home infrastructure.

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

## Kairos playbooks

Add the nodes to the `kairos` inventory group. Use an SSH account with privilege escalation.
Use `--limit` to select the nodes for each operation.

| Playbook             | Operation                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `kairos_setup`       | Copy the initial cloud configuration to a newly installed node and reboot if the file changes. Run this before the node serves workloads. |
| `kairos_reconfigure` | Check for a configuration change. If the file changes, drain the node, copy the file, and reboot.                                         |
| `kairos_reboot`      | Drain and reboot the node.                                                                                                                |
| `kairos_upgrade`     | Drain the node, apply an image to the active system, and reboot.                                                                          |

Set `kairos_config_src` to an absolute path to a Kairos cloud configuration file on the Ansible control host.
Setup and reconfiguration manage `/oem/100_ansible.yaml`.
Use a configuration that preserves Ansible SSH access.
See the [Kairos configuration documentation](https://kairos.io/docs/advanced/after-install/).

For maintenance of Kubernetes nodes, install `kubectl` on the Ansible control host.
Set `kairos_kube_context` to the kubeconfig context for the cluster.
Set `kairos_kubernetes_node` per host if the inventory name differs from the Kubernetes node name.
Make sure the Kubernetes API stays available while a node reboots.
Run one maintenance playbook at a time for the cluster.

The maintenance playbooks work on one node at a time.
They stop if the node is already cordoned or if its drain fails.
Drains respect PodDisruptionBudgets and refuse to delete pods with local data in emptyDir volumes.
The playbooks uncordon a node after Kubernetes reports the new boot and the node is Ready.
If maintenance fails after it cordons the node, examine the node before you uncordon it manually.

The upgrade playbook defaults to `ghcr.io/marinatedconcrete/kairos-fedora:1.1.1`.
Set `kairos_image` to a different tag or digest to select a different image.
Make sure the Kairos upgrade configuration has automatic reboot disabled.
See the [Kairos upgrade documentation](https://kairos.io/docs/upgrade/manual/).

```sh
ansible-playbook -i inventory.yml marinatedconcrete.config.kairos_setup --limit node1 -e kairos_config_src=/path/to/cloud-config.yaml
ansible-playbook -i inventory.yml marinatedconcrete.config.kairos_reconfigure --limit node1 -e kairos_config_src=/path/to/cloud-config.yaml -e kairos_kube_context=home
ansible-playbook -i inventory.yml marinatedconcrete.config.kairos_reboot --limit node1 -e kairos_kube_context=home
ansible-playbook -i inventory.yml marinatedconcrete.config.kairos_upgrade --limit node1 -e kairos_kube_context=home
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
