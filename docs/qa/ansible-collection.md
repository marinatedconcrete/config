# QA for the Ansible collection

## Scope

This page applies to every change under `ansible/`.
That directory is the `marinatedconcrete.config` Ansible collection.
It has this content.

- `ansible/galaxy.yml` holds the collection metadata and the version.
- `ansible/meta/runtime.yml` sets the minimum `ansible-core` version.
- `ansible/roles/minikube_test` starts Minikube and applies a kustomization. The Kustomize component tests in `kustomization/tests/*/test.yml` use this role.
- `ansible/roles/longhorn_allow_encrypted_trim` sets the `discards` flag on encrypted Longhorn volumes. Consumers outside this repository run this role.
- `ansible/requirements.txt` pins `ansible`, `ansible-lint`, and `kubernetes`. The devcontainer image installs these packages.
- `ansible/.config/ansible-lint.yml` sets the lint profile to `production`.

Release Please releases `ansible/` as the package `ansible-collection`.
See [release tooling](release-tooling.md) for the release process.
For commit and PR title rules, see `AGENTS.md`.
The tests in `kustomization/tests/` are outside this page.
The QA page for Kustomize components covers them.

## Review checklist

Apply each item that matches the change.

### Conventions

- Variable names use the role prefix.
  The `minikube_test` role uses `minikube_test__`.
  The `longhorn_allow_encrypted_trim` role uses `longhorn_allow_encrypted_trim_`.
  Do not mix the two styles in one role.
- Each module name is fully qualified, for example `ansible.builtin.command`.
  The `production` lint profile enforces this rule.
- Each `command` task that always changes state sets `changed_when: true`.
  Each task that only reads state sets `changed_when: false`.
- Each task has a `name`.
  A comment explains each non-obvious reason, such as the `/var` mount in `minikube_test`.
- A new role has `meta/main.yml` and a `README.md`.
  The `longhorn_allow_encrypted_trim` role is the model.
  The `minikube_test` role has no `README.md`.
- Each new option or variable is used.

### Behavior and security

- A change to `minikube_test` keeps every existing test working.
  Run at least one test that uses the changed option.
  The `factorio` test uses `minikube_test__enable_user_namespaces` and `minikube_test__enable_local_path_storage`.
- A new option in `minikube_test` has a default in `defaults/main.yml` and a comment.
  The default keeps the old behavior.
- A change to `minikube_test` does not weaken the pod security tests.
  The role starts Minikube with `--force`.
  Check that a new option does not hide a security failure.
- A task that handles a secret sets `no_log: true`.
  See `process_volume.yml` in `longhorn_allow_encrypted_trim` for the pattern.
- A change to `longhorn_allow_encrypted_trim` does not print the encryption key.
  The key comes from the Kubernetes `Secret` field `CRYPTO_KEY_VALUE`.
- The tasks stay safe to run again, or the change says why they cannot.
  The `minikube_test` tasks use `changed_when: true` by design.

### Docs

- A change to a role option or to role behavior updates the role `README.md` and the comments in `defaults/main.yml`.
- A change that forces a consumer to act is a breaking change.
  Annotate it as the [pull request template](../../.github/pull_request_template.md) describes.
  Commit `ac44fe3` (`feat(factorio)!`) is an example.

### Versioning and release

- The change does not edit `version` in `ansible/galaxy.yml` or `ansible/CHANGELOG.md`.
  Release Please sets them.
- The commit type matches the effect on consumers.
  `feat`, `fix`, and a breaking change make a release.
  `chore`, `docs`, and `build` also make a release when the change touches the collection path.
  Types that the release configuration does not list, such as `test` and `ci`, make no release.
- The scope names the thing that changed.
  Use the role or component directory name, such as `factorio` or `longhorn_allow_encrypted_trim`, or `ansible`.
- A change that adds or moves a file in the collection builds correctly.
  See "Check the collection package" below.
  Commit `c305050` fixed a missing license file in the collection.

### Renovate behavior

- The `# renovate: datasource=... depName=...` comment stays directly above the version that it updates.
  The `minikube_test__kubernetes_version` variable in `defaults/main.yml` uses this form.
- A Renovate update of a dependency in `ansible/requirements.txt` has the intended release effect.
  The release configuration lists this file in `exclude-paths`, but the exclusion has no effect in practice.
  Commit `9cc8e0f` changed only this file and made a breaking `ansible-collection` release.
  See [Renovate presets](renovate-presets.md) for the update rules.
- The `requires_ansible` value in `ansible/meta/runtime.yml` keeps the form `">=X.Y.Z"`.
  A custom manager in `renovate.json` reads it.
- A change to the Renovate rules for the collection passes `just renovate-lint`.

## Automated validation coverage

| What is validated                     | How to run it                                        | What it proves                                                                                                      | What it does not prove                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ansible-lint` (`production` profile) | `just ansible-lint`                                  | The role YAML follows the lint rules. This includes fully qualified module names, task names, and role `meta` data. | The rules `galaxy[no-changelog]` and `galaxy[version-incorrect]` are skipped.                                                                      |
| File format                           | `just check-format`                                  | Prettier accepts the `*.yml`, `*.json`, and `*.md` files.                                                           | `ansible/galaxy.yml` and `**/CHANGELOG.md` are in `.prettierignore`. The check does not test wording.                                              |
| Pinned packages                       | Manual: build the devcontainer image                 | The pinned packages in `ansible/requirements.txt` install in the devcontainer image.                                | The build does not run the collection code.                                                                                                        |
| Kustomize component tests             | `just kustomization-test <component>` or `just test` | The `minikube_test` role starts Minikube and applies a kustomization. Each test then checks its own component.      | A test for one component does not cover the others. Run `just test` for a change to the role.                                                      |
| `minikube_test` options               | `just kustomization-test factorio`                   | The `factorio` test uses `enable_user_namespaces` and `enable_local_path_storage`.                                  | No test sets `minikube_test__minikube_nodes`. No test uses `enable_user_namespaces` without `enable_local_path_storage`.                           |
| `longhorn_allow_encrypted_trim`       | Manual: see "Check the Longhorn role"                | Only the lint and the format check read this role. Nothing automated proves its behavior.                           | The role needs a Longhorn cluster, encrypted volumes, SSH access to the nodes, and `cryptsetup`. A broken task shows only when a consumer runs it. |
| Release validation for `ansible`      | `just release-please-validate ansible`               | The release commit passes `ansible-lint` and the component tests before the tag and the GitHub release exist.       | It runs after merge. A failure blocks the release only. It does not block the change.                                                              |
| Collection build                      | Manual: see "Check the collection package"           | The collection archive has all needed files.                                                                        | No automation runs `ansible-galaxy collection build`. Commit `c305050` shows that an archive can miss a file while all checks pass.                |
| Consumer install                      | Manual                                               | A consumer can install the collection from the Git tag.                                                             | No automation installs the collection from a tag.                                                                                                  |

## Manual QA

Automation does not cover these items.
Do them when the change touches the named area.

### Run the lint locally

The `just ansible-lint` recipe starts a Minikube profile named `ansible-lint`.
Run it in the devcontainer.

```sh
just ansible-lint
```

Outside the devcontainer, install the pinned tools in a virtual environment.
Then run the lint from `ansible/`.

```sh
python3 -m venv /tmp/ansible-venv
/tmp/ansible-venv/bin/pip install -r ansible/requirements.txt
cd ansible && /tmp/ansible-venv/bin/ansible-lint
```

The lint creates the directory `ansible/.ansible`.
Git ignores it.
The `build_ignore` list in `ansible/galaxy.yml` keeps it out of the collection archive.

### Run the role tests

Run each test that uses the changed role.
Use the devcontainer.
The `kustomization-test` recipe needs Docker, Minikube, and the installed collection.

Warning: the role handlers run `minikube stop` and `minikube delete` on a Minikube profile.
The profile name is the component directory name, or the value of `kubernetes_core_k8s__context` when it is set.
Do not use a profile name that you need to keep.

```sh
just kustomization-test factorio
just test
```

The test host must support user namespaces for `factorio`.
A change to `minikube_test` can break a test for another component.
Run `just test` for a change to `minikube_test`.

### Check the Longhorn role

Do this check for any change to `longhorn_allow_encrypted_trim`.
No automation covers this role.
Run it only against a disposable test cluster.
Never run it against a production cluster.

1. Use a test cluster that has Longhorn and at least one encrypted volume. Use a `StorageClass` with `parameters.encrypted` set to `"true"`.
2. Install `pexpect` on the target nodes.
3. Run the playbook from the role `README.md`.
4. On the node that owns the volume, run `cryptsetup status <volume name>`. Check that the `flags` line shows `discards`.
5. Run the playbook with `-v`. Check that no encryption key appears in the output.

### Check the collection package

Do this check for a change that adds or moves a file in `ansible/`.

```sh
ansible-galaxy collection build ansible --output-path /tmp/collection-build
tar -tzf /tmp/collection-build/marinatedconcrete-config-*.tar.gz
```

Check that `LICENSE`, `README.md`, `meta/runtime.yml`, and each role file are in the list.
The archive has no `galaxy.yml`, because its data goes into `MANIFEST.json`.
Check that the list has no `.ansible/` entries.

### Check a release PR

A release PR for `ansible-collection` changes `ansible/CHANGELOG.md`, `ansible/galaxy.yml`, and `.release-please-manifest.json`.
Check that the new version matches the highest commit type since the last tag.
Check that each `BREAKING CHANGE` text tells a consumer what to change.

## Known gaps

- The `minikube_test` role has no `README.md`.
  The comments in `defaults/main.yml` are the only description of its options.
- No test runs `longhorn_allow_encrypted_trim`.
- No automation builds the collection archive or installs it from a tag.
- The `just ansible-lint` recipe does not stop the `ansible-lint` Minikube profile when the lint fails.
  The `set -e` setting ends the script before `minikube stop`.
- The `exclude-paths` entry for `ansible/requirements.txt` in `release-please-config.json` has no effect.
  Commit `9cc8e0f` changed only this file and made a breaking release.
- The skip list in `ansible/.config/ansible-lint.yml` has no comment that gives the reason for each skip.
