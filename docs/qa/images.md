# QA for Container Images

This page tells a reviewer what a good change to a container image looks like.
It also lists what automation already proves and what a person must check.
A reviewer can be a human or an agent.

## Scope

The `images/` directory holds five container images.
Each image has its own directory, README, and workflow.

| Image                   | Directory                      | Build file      | Workflow                                            | Version source              |
| ----------------------- | ------------------------------ | --------------- | --------------------------------------------------- | --------------------------- |
| `buildah-action-runner` | `images/buildah-action-runner` | `Containerfile` | `.github/workflows/image-buildah-action-runner.yml` | release-please              |
| `devcontainer-base`     | `images/devcontainer-base`     | `Containerfile` | `.github/workflows/image-devcontainer-base.yml`     | CalVer, from the workflow   |
| `github-runner-ci`      | `images/github-runner-ci`      | `Containerfile` | `.github/workflows/image-github-runner-ci.yml`      | release-please              |
| `kairos-fedora`         | `images/kairos-fedora`         | `Containerfile` | `.github/workflows/image-kairos-fedora.yml`         | release-please              |
| `vscode-ssh-server`     | `images/vscode-ssh-server`     | `Dockerfile`    | `.github/workflows/image-vscode-ssh-server.yml`     | release-please (prerelease) |

These files also belong to this part:

- `images/*/build_files/`: The scripts that a `Containerfile` runs. The `Containerfile` mounts them from the `ctx` stage.
- `images/kairos-fedora/e2e.sh`: The boot and install test for the Kairos image.
- `images/*/release-notes-components.sh`: The scripts that add rows to the release notes.
- `.github/workflows/release-package.yml`: The workflow that tests and publishes a release image. It calls the image workflows.
- `.github/release/README.md`: The description of the release sequence.

The action in `actions/image-release-notes/` writes the release notes and the SBOM for three images.
A separate QA page covers this action.

`devcontainer-base` is not in `release-please-config.json`.
Its workflow creates a version tag each Thursday at 12:00 UTC.
A manual run on `main` also creates a release.
The other four images get a release from a release-please pull request.

## Review checklist

Apply each item that fits the change.

### Build files

- [ ] The change follows the `build_files` pattern.
      The `Containerfile` keeps the stages, arguments, mounts, labels, and final image settings.
      Executable scripts in `images/<name>/build_files/` hold the package installation and setup commands.
- [ ] Each new script is executable (mode `0755`) and sets `set -e` and `pipefail`.
- [ ] Each base image has a version tag and a digest.
      `fedora:45` in `kairos-fedora` and `fedora-minimal:44` in `devcontainer-base` have no digest.
      `renovate.json` sets `pinDigests: false` for these images, because old Fedora digests disappear.
- [ ] A version that Renovate must update has a `# renovate: datasource=... depName=...` comment on the line before it.
      `renovate.json` lists the file patterns in `customManagers`.
- [ ] Package installation uses `--setopt=install_weak_deps=False`.
- [ ] `buildah-action-runner` runs no `dnf upgrade`.
      The base image pin must stay in effect.
- [ ] The `Containerfile` has no duplicate `LABEL` keys.
      Each image sets `org.opencontainers.image.title`.
      The workflows add the other labels with `docker/metadata-action`.

### Security posture

Images do not have a Kubernetes pod-security level.
The pod-security level applies where a consumer runs the image.
For an image, check these items.

- [ ] The final image does not run as root, unless the image needs root.
      `github-runner-ci` ends as `1001:1001`, to match the ARC runner workspace.
      `vscode-ssh-server` ends as user `dev` (UID 1000).
      `devcontainer-base` ends as user `vscode`.
      `kairos-fedora` is an operating system image, so it has no `USER` instruction.
- [ ] The change adds no secret, token, or key to an image layer, a build argument, or a script.
      The `ARG USERNAME` in `devcontainer-base` has a `hadolint ignore=DL3064` comment, because it is a local account name.
- [ ] The change does not widen privilege.
      Look for `sudo`, `wheel`, added capabilities, and open firewall ports.
      `images/kairos-fedora/build_files/customization.sh` sets the services and the firewall ports.
- [ ] A change to `kairos-fedora` keeps the cloud datasource warning in `images/kairos-fedora/README.md` accurate.
- [ ] New workflow permissions are the least that the job needs.
      Each image workflow sets `contents: read` and `packages: write`.
      `test-github-actions-job-container` sets `packages: read`.
- [ ] A new third-party GitHub Action is pinned to a commit SHA with a version comment.
      `renovate.json` does not auto-merge third-party actions, because the image workflows give them write tokens.

### Tests

- [ ] A behavior change in an image comes with a change to its check.
      The checks are the `Smoke Test Image` step, the `test-github-actions-job-container` job, and `e2e.sh`.
- [ ] A new tool in `buildah-action-runner`, `github-runner-ci`, or `vscode-ssh-server` has a version command in the smoke test.
- [ ] A change to `kairos-fedora` passes `e2e.sh` in the pull request.
      The `build-container` job runs it when a changed path matches the workflow trigger.
- [ ] A change to `e2e.sh` does not lower a timeout or remove a check without a reason in the commit message.

### Documentation

- [ ] The image README matches the change.
      Update the README when the change affects users, for example tags, users, environment variables, volumes, or ports.
- [ ] New prose follows ASD-STE100, as `AGENTS.md` requires.
- [ ] No change edits a `CHANGELOG.md` by hand.
      Release-please writes these files.

### Versioning and commit type

- [ ] The pull request title and each commit use Conventional Commits.
      The `Validate PR title` check enforces the title.
- [ ] The scope is the image name, for example `fix(kairos-fedora): ...` or `feat(github-runner-ci): ...`.
      A change for more than one image can have no scope, as in `feat: pin devcontainer-base to CalVer releases and auto-merge updates` (#1018).
- [ ] The type matches the effect on the version.
      `release-please-config.json` lists `feat`, `fix`, `docs`, `build`, and `chore` in the changelog.
      A `feat` makes a minor release. A `fix` makes a patch release. A `!` makes a major release.
      The Fedora 45 upgrade (#988) and the `kairos-init` 4.4.0 update (#927) are `feat!` precedents.
- [ ] A change that must not make a release uses the `test` type.
      The AuroraBoot update (#1029) is the precedent.
- [ ] No pull request changes a release version, a `CHANGELOG.md`, or `.release-please-manifest.json`.
      Only the release-please pull request changes these files.
- [ ] A new image has an entry in `release-please-config.json`.
      It also needs a `groupName` rule and a changelog rule in `renovate/marinatedconcrete.json`, an image workflow, and a job in `release-package.yml`.

### Renovate behavior

- [ ] A dependency update uses the commit type that `renovate.json` assigns.
      A major update is `feat(package)!`, and a minor update is `feat(package)`.
      A change to `e2e.sh`, a `tests/` path, or a `*.test.*` file is `test(package)`.
- [ ] A `devcontainer-base` update is `chore(package)`.
      The result is a patch release of `github-runner-ci`.
      Renovate merges this update after all pull request checks pass.
- [ ] An automerge rule does not skip a check that matters.
      The Fedora digest rule and the `vscode-ssh-server` digest rule use `automergeType: branch`.
      A branch automerge waits for the required checks only.
      The image workflow checks are not required. See the known gaps.

### Release workflow

- [ ] A path filter in a workflow lists files that exist.
- [ ] A new image workflow supports `workflow_call` with the `sha` and `version` inputs.
      It exposes a `digest` output.
      It runs a smoke test before the release publishes the image.
- [ ] The release publishes the tested digest.
      The release does not rebuild the image.

## Automated validation coverage

The "Required" column comes from `gh api repos/marinatedconcrete/config/branches/main/protection`.
The required contexts are `lint`, `check-format`, `build`, and six `kustomization-test` jobs.
No image job is in this list.
The image workflows use path filters.
A required check from such a workflow stays pending on a pull request that does not match the paths.

| Check                                        | What it proves                                                                                                                               | Where it runs                                                                                                                                                                           | Required in branch protection | Gap                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Hadolint on each Containerfile               | The files follow the rules in `.hadolint.yaml`, with a failure threshold of `info`                                                           | `just hado-lint`, in the `lint` job of `checks.yml`                                                                                                                                     | yes (`lint`)                  | It checks static rules only. It does not build the image.                                                                        |
| ShellCheck on each `*.sh` file               | The scripts in `images/` and `actions/` have no ShellCheck findings                                                                          | `just shellcheck-lint`, in the `lint` job                                                                                                                                               | yes (`lint`)                  | It does not run the scripts.                                                                                                     |
| Format check                                 | The README files and workflow files follow the Prettier rules                                                                                | `just check-format`, in the `check-format` job                                                                                                                                          | yes (`check-format`)          | It does not check ASD-STE100 wording.                                                                                            |
| Devcontainer image build                     | The repository devcontainer builds with the pinned `devcontainer-base`                                                                       | The `build` job of `checks.yml`                                                                                                                                                         | yes (`build`)                 | It tests one consumer of `devcontainer-base`.                                                                                    |
| Pull request title check                     | The title uses Conventional Commits                                                                                                          | The `Validate PR title` job of `semantic-commits.yml`                                                                                                                                   | no                            | A bad title can merge.                                                                                                           |
| `buildah-action-runner` build and smoke test | The image builds. `buildah`, `curl`, `jq`, and `node` run.                                                                                   | The `Build Buildah Action Runner Image` job                                                                                                                                             | no                            | The test does not run a `buildah build`. A fork pull request does not push the image.                                            |
| `github-runner-ci` build and smoke test      | The image builds. The user is `1001:1001`. The home directories are writable. `brew`, `git`, `just`, `jq`, `rg`, `shellcheck`, and `yq` run. | The `Build GitHub Runner CI Image` job                                                                                                                                                  | no                            | The test does not check the other installed packages.                                                                            |
| `github-runner-ci` job container test        | A GitHub Actions job runs in the pushed image. The workspace is writable and `brew install` works.                                           | The `Test GitHub Actions Job Container` job                                                                                                                                             | no                            | It runs only when the workflow pushes the image. A fork pull request skips it. It does not use an ARC runner.                    |
| `kairos-fedora` build                        | The image builds and `kairos-init validate` passes                                                                                           | The `build-container` job in `image-kairos-fedora.yml`                                                                                                                                  | no                            | The path filter lists `.devcontainer/Dockerfile`. That file does not exist.                                                      |
| `kairos-fedora` boot and install test        | The ISO installs through the WebUI. The installed system reboots. SSH works. The hostname is correct. The `k3s` node is `Ready`.             | `just e2e-kairos-fedora`, and the `Run Kairos Fedora E2E` step of the `build-container` job                                                                                             | no                            | It runs in one virtual machine setup. It does not cover real hardware, an upgrade, or Longhorn, `iscsid`, and firewall behavior. |
| `vscode-ssh-server` build and smoke test     | The image builds. `/init.sh` and `sshd` are executable. User `dev` exists.                                                                   | The `build-container` job in `image-vscode-ssh-server.yml`                                                                                                                              | no                            | No test starts `sshd` or opens an SSH connection.                                                                                |
| `devcontainer-base` build and full pipeline  | The image builds. `just check-format && just lint && just test` pass in a devcontainer that uses the candidate image.                        | The `Build Devcontainer Base Image` job in `image-devcontainer-base.yml`                                                                                                                | no                            | The pipeline covers what this repository needs. Other consumers can need more.                                                   |
| Image release notes and SBOM                 | The notes and the SBOM generate for `kairos-fedora`, `github-runner-ci`, and `devcontainer-base`                                             | The `Generate Image Release Notes` step. `just release-notes-kairos-fedora`, `just release-notes-github-runner-ci`, and `just release-notes-devcontainer-base` run it on a local image. | no                            | `buildah-action-runner` and `vscode-ssh-server` have no notes or SBOM.                                                           |
| Action unit tests                            | The helper code for the release notes works                                                                                                  | `npm test --prefix actions/image-release-notes`, in the `image-release-notes-test` job                                                                                                  | no                            | The tests do not run Syft or the CycloneDX CLI.                                                                                  |
| Release automation tests                     | The release planner and publisher work                                                                                                       | `npm test --prefix .github/release`, in the `release-automation-test` job                                                                                                               | no                            | The tests do not run a real release.                                                                                             |
| Release validation                           | The tested digest, not a rebuild, gets the release version                                                                                   | The `release-package.yml` workflow, after a release pull request merges                                                                                                                 | not applicable                | It runs after the merge. No check runs on the pull request.                                                                      |

## Manual QA

A person must check these items, because no job covers them.

1. Read each changed `Containerfile` and `build_files` script.
   Confirm that the user, the packages, and the final settings match the README.
2. Build the image and run its smoke test on your machine.
   For `buildah-action-runner`, run these commands from the repository root:

   ```sh
   docker build -f images/buildah-action-runner/Containerfile -t buildah-action-runner:qa images/buildah-action-runner
   docker run --rm buildah-action-runner:qa bash -lc 'buildah --version && curl --version && jq --version && node --version'
   ```

   For another image, copy the commands from the `Smoke Test Image` step of its workflow.

3. For `kairos-fedora`, run `just e2e-kairos-fedora` in the devcontainer.
   The container user needs read and write access to `/dev/kvm`.
   The README lists the settings, such as `KAIROS_IMAGE` and `E2E_WORKDIR`.
   The test takes a long time. The default install timeout is 25 minutes.
4. For `kairos-fedora`, boot the image on real hardware when the change affects drivers, firmware, storage, networking, or the boot loader.
   The GRUB `tpm` fix (#1000) and the Longhorn services are examples.
   The virtual machine test cannot show these effects.
5. For `vscode-ssh-server`, run the container with `AUTHORIZED_KEYS_URL` set.
   Open an SSH connection on port 2222.
   Confirm that a VS Code Remote SSH session starts.
6. For a change to a release workflow, read the concurrency settings and the publish order.
   A review of #1004 found that two release runs could replace `latest` out of order.
   Check that one release finishes before the next release starts.
7. For a change to the release notes, run the matching `just release-notes-<image>` recipe on a local image.
   Read the file `build/release/<component>-notes.md`.
8. After a release, pull the image by digest from `ghcr.io/marinatedconcrete/<image>`.
   Confirm that the digest equals the digest in the release record.

## Known gaps

Each gap can become an issue.

- No image job is a required check.
  A pull request that breaks an image can merge when the path-filtered job fails.
  An aggregate job that always runs and reads the path-filtered results can fix this.
- `.github/workflows/image-kairos-fedora.yml` lists `.devcontainer/Dockerfile` in its path filters.
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
