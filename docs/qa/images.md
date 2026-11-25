# QA for container images

This page tells a reviewer what a good change to a container image looks like.
It also lists what automation already proves and what a person must check.
A reviewer can be a human or an agent.

## Scope

The `images/` directory holds five container images.
Each image has its own directory, README, and workflow.

| Image                   | Build file      | Version source              |
| ----------------------- | --------------- | --------------------------- |
| `buildah-action-runner` | `Containerfile` | release-please              |
| `devcontainer-base`     | `Containerfile` | CalVer, from the workflow   |
| `github-runner-ci`      | `Containerfile` | release-please              |
| `kairos-fedora`         | `Containerfile` | release-please              |
| `vscode-ssh-server`     | `Dockerfile`    | release-please (prerelease) |

These files also belong to this part:

- `images/*/build_files/`: The scripts that a `Containerfile` runs. The `Containerfile` mounts them from the `ctx` stage.
- `images/kairos-fedora/e2e.sh`: The boot and install test for the Kairos image.
- `images/*/release-notes-components.sh`: The scripts that add rows to the release notes.
- `.github/release/README.md`: The description of the release sequence.

The action in `actions/image-release-notes/` writes the release notes and the SBOM for three images.
A separate QA page covers this action.

`devcontainer-base` is not in `release-please-config.json`.
Its workflow creates a CalVer version tag on a schedule.
A manual run on `main` also creates a release.
The other four images get a release from a release-please pull request.
See [release tooling](release-tooling.md) for the release-please mechanics.

## Review checklist

Apply each item that fits the change.

### Build files

- The change follows the `build_files` pattern.
      The `Containerfile` keeps the stages, arguments, mounts, labels, and final image settings.
      Executable scripts in `images/<name>/build_files/` hold the package installation and setup commands.
- Each new script is executable (mode `0755`) and sets `set -e` and `pipefail`.
- Each base image has a version tag and a digest.
      `fedora:45` in `kairos-fedora` and `fedora-minimal:44` in `devcontainer-base` have no digest.
      `renovate.json` sets `pinDigests: false` for these images, because old Fedora digests disappear.
- A version that Renovate must update has a `# renovate: datasource=... depName=...` comment on the line before it.
      `renovate.json` lists the file patterns in `customManagers`.
- Package installation uses `--setopt=install_weak_deps=False`.
- `buildah-action-runner` runs no `dnf upgrade`.
      The base image pin must stay in effect.
- The `Containerfile` has no duplicate `LABEL` keys.
      `buildah-action-runner`, `github-runner-ci`, and `kairos-fedora` set `org.opencontainers.image.title` in the `Containerfile`.
      `buildah-action-runner` and `github-runner-ci` also set `org.opencontainers.image.description`.
      `devcontainer-base` and `vscode-ssh-server` set no `LABEL`.
      The workflows of all images except `devcontainer-base` add labels with `docker/metadata-action`.

### Security posture

Images do not have a Kubernetes pod-security level.
The pod-security level applies where a consumer runs the image.
For an image, check these items.

- The final image does not run as root, unless the image needs root.
      `github-runner-ci` ends as `1001:1001`, to match the ARC runner workspace.
      `vscode-ssh-server` ends as user `dev` (UID 1000).
      `devcontainer-base` ends as user `vscode`.
      `kairos-fedora` is an operating system image, so it has no `USER` instruction.
- The change adds no secret, token, or key to an image layer, a build argument, or a script.
      The `ARG USERNAME` in `devcontainer-base` has a `hadolint ignore=DL3064` comment, because it is a local account name.
- The change does not widen privilege.
      Look for `sudo`, `wheel`, added capabilities, and open firewall ports.
      `images/kairos-fedora/build_files/configure.sh` sets the services and the firewall ports.
- A change to `kairos-fedora` keeps the cloud datasource warning in `images/kairos-fedora/README.md` accurate.
- New workflow permissions are the least that the job needs.
- A new third-party GitHub Action is pinned to a commit SHA with a version comment.
      See the known gaps.

### Tests

- A behavior change in an image comes with a change to its check.
      The checks are the image smoke test, the `github-runner-ci` job container test, and `e2e.sh`.
- A new tool in `buildah-action-runner`, `github-runner-ci`, or `vscode-ssh-server` has a version command in the smoke test.
- A change to `kairos-fedora` passes `e2e.sh` in the pull request.
      The workflow runs it when a changed path matches the workflow trigger.
- A change to `e2e.sh` does not lower a timeout or remove a check without a reason in the commit message.

### Documentation

- The image README matches the change.
      Update the README when the change affects users, for example tags, users, environment variables, volumes, or ports.
- New prose follows [AGENTS.md](../../AGENTS.md).

### Versioning and commit type

- The pull request title and each commit follow [AGENTS.md](../../AGENTS.md).
      Mark a breaking change as [the pull request template](../../.github/pull_request_template.md) describes.
- The scope is the image name, for example `fix(kairos-fedora): ...`.
      A change for more than one image can have no scope.
- The type matches the effect on the version.
      A `feat` or `fix` releases the image. A `test` change does not.
- No pull request changes a release version, a `CHANGELOG.md`, or `.release-please-manifest.json`.
      See [release tooling](release-tooling.md).
- A new image has an entry in `release-please-config.json` and an entry with the value `0.0.0` in `.release-please-manifest.json`.
      It also needs a `groupName` rule and a changelog rule in `renovate/marinatedconcrete.json`, an image workflow, and a job in the release workflow.

### Renovate behavior

- A `devcontainer-base` update is `chore(package)`.
      The result is a patch release of `github-runner-ci`.
- An automerge rule does not skip a check that matters.
      See [Renovate presets](renovate-presets.md).
      The image workflows do not run on a Renovate branch that merges as a branch merge.
      They run after the merge.

### Release workflow

- A path filter in a workflow lists files that exist.
- A new image workflow supports `workflow_call` with the `sha` and `version` inputs.
      It exposes a `digest` output.
      It runs a smoke test before the release publishes the image.
- The release publishes the tested digest.
      The release does not rebuild the image.

## Automated validation coverage

Run `just --list` to find the recipes.
Read `.github/workflows` to see which checks run on a pull request.

| What is validated                   | How to run                                      | What it proves                                                                                                                               | What it does not prove                                                                                                           |
| ----------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Containerfile rules                 | `just hado-lint`                                | The files follow the rules in `.hadolint.yaml`, with a failure threshold of `info`                                                           | It checks static rules only. It does not build the image.                                                                        |
| Shell scripts                       | `just shellcheck-lint`                          | The scripts in `images/` and `actions/` have no ShellCheck findings                                                                          | It does not run the scripts.                                                                                                     |
| README and workflow format          | `just check-format`                             | The README files and workflow files follow the Prettier rules                                                                                | It does not check ASD-STE100 wording.                                                                                            |
| Devcontainer image                  | manual                                          | The repository devcontainer builds with the pinned `devcontainer-base`                                                                       | It tests one consumer of `devcontainer-base`.                                                                                    |
| Pull request title                  | manual                                          | The title uses Conventional Commits                                                                                                          | A bad title can merge.                                                                                                           |
| `buildah-action-runner` build       | manual                                          | The image builds. `buildah`, `curl`, `jq`, and `node` run.                                                                                   | The test does not run a `buildah build`. A fork pull request does not push the image.                                            |
| `github-runner-ci` build            | manual                                          | The image builds. The user is `1001:1001`. The home directories are writable. `brew`, `git`, `just`, `jq`, `rg`, `shellcheck`, and `yq` run. | The test does not check the other installed packages.                                                                            |
| `github-runner-ci` job container    | manual                                          | A GitHub Actions job runs in the pushed image. The workspace is writable and `brew install` works.                                           | It runs only when the workflow pushes the image. A fork pull request skips it. It does not use an ARC runner.                    |
| `kairos-fedora` build               | manual                                          | The image builds and `kairos-init validate` passes                                                                                           | The path filter lists `.devcontainer/Dockerfile`. That file does not exist.                                                      |
| `kairos-fedora` boot and install    | `just e2e-kairos-fedora`                        | The ISO installs through the WebUI. The installed system reboots. SSH works. The hostname is correct. The `k3s` node is `Ready`.             | It runs in one virtual machine setup. It does not cover real hardware, an upgrade, or Longhorn, `iscsid`, and firewall behavior. |
| `vscode-ssh-server` build           | manual                                          | The image builds. `/init.sh` and `sshd` are executable. User `dev` exists.                                                                   | No test starts `sshd` or opens an SSH connection.                                                                                |
| `devcontainer-base` full pipeline   | manual                                          | The image builds. `just check-format && just lint && just test` pass in a devcontainer that uses the candidate image.                        | The pipeline covers what this repository needs. Other consumers can need more.                                                   |
| Image release notes and SBOM        | `just release-notes-<image>`                    | The notes and the SBOM generate for `kairos-fedora`, `github-runner-ci`, and `devcontainer-base`                                             | `buildah-action-runner` and `vscode-ssh-server` have no notes or SBOM.                                                           |
| Release notes action helper code    | `npm test --prefix actions/image-release-notes` | The helper code for the release notes works                                                                                                  | The tests do not run Syft or the CycloneDX CLI.                                                                                  |
| Release planner and publisher       | `npm test --prefix .github/release`             | The release planner and publisher work                                                                                                       | The tests do not run a real release.                                                                                             |
| Release publishes the tested digest | manual                                          | The tested digest, not a rebuild, gets the release version                                                                                   | It runs after the merge. No check runs on the pull request.                                                                      |

## Manual QA

A person must check these items, because no automation covers them.

1. Read each changed `Containerfile` and `build_files` script.
   Confirm that the user, the packages, and the final settings match the README.
2. Build the image and run its smoke test on your machine.
   For `buildah-action-runner`, run these commands from the repository root:

   ```sh
   docker build -f images/buildah-action-runner/Containerfile -t buildah-action-runner:qa images/buildah-action-runner
   docker run --rm buildah-action-runner:qa bash -lc 'buildah --version && curl --version && jq --version && node --version'
   ```

   For another image, copy the commands from the smoke test step of its workflow.

3. For `kairos-fedora`, run `just e2e-kairos-fedora` in the devcontainer.
   The container user needs read and write access to `/dev/kvm`.
   The README lists the settings, such as `KAIROS_IMAGE` and `E2E_WORKDIR`.
   The test takes a long time. The default install timeout is 25 minutes.
4. For `kairos-fedora`, boot the image on real hardware when the change affects drivers, firmware, storage, networking, or the boot loader.
   GRUB `tpm` settings and the Longhorn services are examples.
   The virtual machine test cannot show these effects.
5. For `vscode-ssh-server`, run the container with `AUTHORIZED_KEYS_URL` set.
   Open an SSH connection on port 2222.
   Confirm that a VS Code Remote SSH session starts.
6. For a change to a release workflow, read the concurrency settings and the publish order.
   Two release runs can replace `latest` out of order.
   Check that one release finishes before the next release starts.
7. For a change to the release notes, run the matching `just release-notes-<image>` recipe on a local image.
   Read the file `build/release/<component>-notes.md`.
8. After a release, pull the image by digest from `ghcr.io/marinatedconcrete/<image>`.
   Confirm that the digest equals the digest in the release record.

## Known gaps

Each gap can become an issue.

- A patch update of a third-party GitHub Action can merge with no pull request.
  See [Renovate presets](renovate-presets.md).
  The image workflows do not run before the merge, and the actions get `packages: write` tokens.
- No image check is required.
  A pull request that breaks an image can merge when the path-filtered check fails.
  An aggregate job that always runs and reads the path-filtered results can fix this.
- The `kairos-fedora` workflow lists `.devcontainer/Dockerfile` in its path filters.
  The repository has `.devcontainer/Containerfile`, not that file.
  A change to the devcontainer file does not start the Kairos workflow.
- `images/kairos-fedora/Containerfile` sets `org.opencontainers.image.title` two times.
  The second value, `kairos-fedora`, replaces the first value, `A custom Fedora-based Kairos image.`.
- `buildah-action-runner` and `vscode-ssh-server` have no release notes or SBOM.
- No test starts `sshd` in `vscode-ssh-server`.
  No test runs a `buildah build` in `buildah-action-runner`.
- No scan checks the images for known vulnerabilities.
- The Kairos test does not test an upgrade from the previous release.
- A fork pull request does not run the `github-runner-ci` job container test.
- The `justfile` has no recipe that runs the smoke tests of all images on a local machine.
