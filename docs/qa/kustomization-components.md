# QA for Kustomize components

This page tells a reviewer what a good change looks like in the Kustomize components.
It also shows which checks run automatically and which checks need a person.
The branch protection data is from the GitHub API on 2026-11-24.
Read the data again before you depend on it.

## Scope

This page covers these paths:

- `kustomization/components/*`. Each directory is one component that a consumer installs from a Git URL or from a release asset.
- `kustomization/tests/*`. Each directory has a `test.yml` Ansible playbook for one component. The `pod_security.py` script supports the Pod Security tests.

The components are:

| Component                          | Released package                      | Pod Security level in README | Test                                |
| ---------------------------------- | ------------------------------------- | ---------------------------- | ----------------------------------- |
| `factorio`                         | `kustomize-factorio`                  | restricted                   | `factorio`                          |
| `kube-vip`                         | `kustomize-kube-vip`                  | privileged                   | `kube-vip`                          |
| `kube-vip-wireguard`               | `kustomize-kube-vip-wireguard`        | privileged                   | `kube-vip-wireguard`                |
| `mosquitto`                        | `kustomize-mosquitto`                 | restricted                   | `mosquitto`                         |
| `paperless`                        | `kustomize-paperless`                 | baseline                     | `paperless`                         |
| `pod-security/*` (five components) | `kustomize-pod-security` (one shared) | not applicable               | `pod-security-*` (five tests)       |
| `priorityclass`                    | `kustomize-priorityclass`             | restricted                   | `priorityclass`                     |
| `unifi-network-application`        | `kustomize-unifi-network-application` | baseline                     | `unifi-network-application`         |
| `redis`                            | none                                  | not stated                   | none. The `paperless` test uses it. |
| `gdp-coraltpu`                     | none                                  | not stated                   | none                                |

The release-please settings are in `release-please-config.json`.
The released versions are in `.release-please-manifest.json`.
The `just release-please-build` recipe builds and tests one released package.

## Review checklist

Apply each item to the files that the change touches.

### Commit and pull request

- [ ] The pull request title and the commit use Conventional Commits. The `Validate PR title` job in `semantic-commits.yml` checks the title only.
- [ ] The scope is the component name, for example `fix(paperless)` or `feat(kube-vip-wireguard)`.
- [ ] A change that a consumer must act on is a breaking change. This includes a new required patch, a new required Secret, and a change of the user namespace setup. Examples are `feat(paperless)!` in #1035 and `feat(unifi-network-application)!` in #1033.
- [ ] Put `!` immediately before the colon of the pull request title, for example `feat(paperless)!: ...`. For a pull request that a person writes, also add a `BREAKING CHANGE:` footer as the last paragraph of the pull request description. The description becomes the squash commit message. Text in the branch commits is discarded. Renovate major updates get `!` from `renovate.json` and have no footer.
- [ ] A change that does not break a consumer does not use `!`. In #1066 the reviewer asked to remove `!` because the change was not breaking.
- [ ] A change only to `kustomization/tests/**` uses the `test` type. Renovate uses `test(package)` for these files, and release-please makes no release for them.
- [ ] Renovate update commits keep the Renovate type. A minor update is `feat`. A major update is `feat(package)!`. A patch update is `chore(package)`. Do not change these types by hand.
- [ ] Do not edit `CHANGELOG.md` files or `.release-please-manifest.json` by hand. Release-please owns them. The one exception is a new package. A person then adds a line with the value `0.0.0` to `.release-please-manifest.json` and an entry to `release-please-config.json`.

### Component files

- [ ] Each released component has a `kustomization.yml`, a `README.md`, and an entry in `release-please-config.json` and `.release-please-manifest.json`.
- [ ] The component is a `kind: Component` that a consumer can select. A directory that has only children, such as `pod-security`, is not selected itself.
- [ ] Each container image uses a version and a digest in `newTag`, for example `2.0.22@sha256:...`. Renovate updates both values.
- [ ] Each image update comment or custom manager still matches the file. The `customManagers` in `renovate.json` read `# renovate:` comments and `newTag` values.
- [ ] The component does not set a namespace. The consumer sets it.
- [ ] Each component that needs a Secret or a patch from the consumer documents it, and the test supplies it.
- [ ] A new `kustomization.yml` builds. Run `just kustomize-lint`.

### Security posture

- [ ] The workload meets the Pod Security level in its README badge. The test namespace in `kustomization/tests/<name>/namespace.yml` enforces the same level, so the Pod must pass admission.
- [ ] A change that lowers the level (for example restricted to baseline) is a deliberate decision. The reviewer must see the reason in the pull request, the badge, the test namespace label, and the README.
- [ ] Only `kube-vip` and `kube-vip-wireguard` run at the privileged level. A new privileged component needs a reason in the pull request.
- [ ] A workload that can use user namespaces sets `hostUsers: false`, and the README has a "Enable User Namespaces" section. `factorio`, `paperless`, and `unifi-network-application` do this. The test then sets `minikube_test__enable_user_namespaces: true`.
- [ ] Containers drop capabilities and block privilege escalation where the application allows it. In #1033 the reviewer asked to apply the same hardening to all images that use the same framework.
- [ ] A security claim in a pull request has a test or an explicit reason why no test is possible. In #1027 the reviewer asked whether a test can prove the restricted level.
- [ ] A Secret in a test file holds only throwaway values.
- [ ] The Pod Security components keep the version rules in their READMEs. Baseline and restricted enforcement use a fixed Kubernetes minor version. The other modes use `latest`.

### Documentation

- [ ] The README has the version badge and the Pod Security badge. A component that sets a `priorityClassName` also has the priority class badge.
- [ ] Each badge points at the right component. The version badge query uses the component path.
- [ ] The README has an Examples section with a Component example and a Resource example. The Resource URL has the form `.../releases/download/kustomize-<name>@v{version}/<name>.yml`.
- [ ] Setup sections use the same headings as the other READMEs: `Required Setup`, `Required Secrets`, `Required Patches`, and `Optional Patches`. The #1066 reviewer asked to keep `Optional Patches`.
- [ ] A change to a default value, a port, or a version also changes the README text that states it.
- [ ] New prose follows ASD-STE100, as `AGENTS.md` requires. Past changelog entries stay unchanged.

### Generated files

- [ ] Do not edit the files that have the `# @generated` header by hand. These are `kube-vip/daemonset/vip.yml`, `kube-vip/daemonset/services.yml`, `kube-vip/rbac.yml`, and `kube-vip-wireguard/daemonset/wireguard.yml`.
- [ ] A change to these files comes from the `codegen-kube-vip` recipe in the `justfile`. Change the recipe, then regenerate.
- [ ] A pushed change to `justfile` or to the two kube-vip `kustomization.yml` files can add a bot commit `chore(package): regenerate kube-vip manifests`. Pull it before you push again.

### Renovate behavior

- [ ] A rule in `renovate.json` that sets `automerge: false` for `ghcr.io`, `quay.io`, `registry.k8s.io`, and `lscr.io` images comes after the component rules. It overrides them. A person must merge these image updates. This applies to `kube-vip` (`ghcr.io/kube-vip/kube-vip`), `unifi-network-application` (`lscr.io/linuxserver/unifi-network-application`), and `paperless` (`ghcr.io`). A new rule must not remove this control.
- [ ] Updates of Docker Hub images can merge on their own. These are the `factorio`, `mosquitto`, and `redis` images, and the `mongo` and `busybox` images. A patch update merges after three days. The `factorio` and `mosquitto` groups also merge minor and digest updates. Check that the required tests cover the component, because `kube-vip-wireguard` has a test that is not required.
- [ ] A patch update of a GitHub Action that is not from GitHub also merges as a branch merge with no pull request, because the global patch rule has no manager filter.
- [ ] Version limits stay in place. Unifi MongoDB stays below 8.1.0.

## Automated validation coverage

The workflow file is `.github/workflows/ci.yml`. It runs on each `push`.
The workflow has no `pull_request` trigger.
The branch protection column shows whether the check is in the required status checks of `main`.
One approving review is required on `main`, but administrators can bypass this rule because `enforce_admins` is `false`.

| Check                                                                                                                                                                                                        | What it proves                                                                                                                                                                                                                                                                      | Where it runs                                                                                                 | Required in branch protection   | Gap                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kustomize build of every component                                                                                                                                                                           | Each `kustomization.yml` under `kustomization/components` renders without error.                                                                                                                                                                                                    | `just kustomize-lint`, part of `just lint`. CI job `lint`.                                                    | yes (`lint`)                    | It does not check the output. It also runs only when the whole `just lint` run passes, so one Ansible lint failure hides the result.                            |
| `kustomization-test (factorio)`                                                                                                                                                                              | The StatefulSet becomes ready on Minikube with user namespaces. The admin and game Services have endpoints. The restricted level is enforced by the test namespace.                                                                                                                 | `just kustomization-test factorio`. CI job `kustomization-test (factorio)`.                                   | yes                             | It does not test a game connection or saved data.                                                                                                               |
| `kustomization-test (kube-vip)`                                                                                                                                                                              | Both DaemonSets become ready. Each log shows its own metrics port. The privileged namespace admits the Pods.                                                                                                                                                                        | `just kustomization-test kube-vip`. CI job `kustomization-test (kube-vip)`.                                   | yes                             | It does not test that a virtual IP address moves, because Minikube has one node.                                                                                |
| `kustomization-test (kube-vip-wireguard)`                                                                                                                                                                    | The WireGuard load balancer class settings are present. The init container stops the Pod when a node sysctl is 0. The DaemonSets start when the sysctls are 1. The tunnel comes up and the services instance skips the WireGuard Service.                                           | `just kustomization-test kube-vip-wireguard`. CI job `kustomization-test (kube-vip-wireguard)`.               | no                              | The job is not in the required checks, so a failure does not block a merge. The release job still runs this test before it publishes.                           |
| `kustomization-test (mosquitto)`                                                                                                                                                                             | The Deployment becomes ready and the Service has an endpoint. The restricted level is enforced.                                                                                                                                                                                     | `just kustomization-test mosquitto`. CI job `kustomization-test (mosquitto)`.                                 | yes                             | It does not test an MQTT login or a message.                                                                                                                    |
| `kustomization-test (paperless)`                                                                                                                                                                             | The StatefulSet becomes ready. A scan that is uploaded through Samba appears in Paperless through the Service and the public host name. Paperless removes the scan from the consume directory. The baseline level is enforced.                                                      | `just kustomization-test paperless`. CI job `kustomization-test (paperless)`.                                 | yes                             | The test covers `redis` only as a part of Paperless.                                                                                                            |
| `kustomization-test (priorityclass)`                                                                                                                                                                         | The component applies to a cluster.                                                                                                                                                                                                                                                 | `just kustomization-test priorityclass`. CI job `kustomization-test (priorityclass)`.                         | yes                             | The test has no assertion of its own. It does not check the names, the values, or which workloads use them.                                                     |
| `kustomization-test (unifi-network-application)`                                                                                                                                                             | The StatefulSet becomes ready and the Service has an endpoint. The baseline level is enforced.                                                                                                                                                                                      | `just kustomization-test unifi-network-application`. CI job `kustomization-test (unifi-network-application)`. | yes                             | It does not test the controller web interface or the `ServersTransport` patch.                                                                                  |
| `kustomization-test (pod-security-enforce-baseline)`, `(pod-security-enforce-restricted)`, `(pod-security-enforce-privileged)`, `(pod-security-audit-warn-baseline)`, `(pod-security-audit-warn-restricted)` | The component sets the right labels on every Namespace and keeps other labels. Allowed pairs of components give the same result in each order. A render with no Namespace is empty. For the baseline and restricted enforcement components, the Renovate manager reads the version. | `just kustomization-test pod-security-<name>`. CI job `kustomization-test (pod-security-<name>)`.             | no (none of the five)           | None of the five jobs is required. The tests do not read the version text in each README. Documented versions can differ from the real labels (see Known gaps). |
| Format check                                                                                                                                                                                                 | Prettier accepts every `.md`, `.yml`, `.yaml`, `.json`, and `.mjs` file, including nested files, and the `justfile` format is correct.                                                                                                                                              | `just check-format`. CI job `check-format`.                                                                   | yes                             | None. The recipes quote their globs, so Prettier expands them.                                                                                                  |
| Lint                                                                                                                                                                                                         | `ansible-lint`, `hadolint`, Kustomize build, the Renovate configuration check, and ShellCheck pass.                                                                                                                                                                                 | `just lint`. CI job `lint`.                                                                                   | yes                             | The `ansible-lint` step starts Minikube, so the job is slow.                                                                                                    |
| Release automation tests                                                                                                                                                                                     | The release scripts in `.github/release` select and publish the right package.                                                                                                                                                                                                      | `npm test --prefix .github/release`. CI job `release-automation-test`.                                        | no                              | A failure does not block a merge.                                                                                                                               |
| Pull request title check                                                                                                                                                                                     | The pull request title is a Conventional Commit.                                                                                                                                                                                                                                    | `.github/workflows/semantic-commits.yml`, job `Validate PR title`.                                            | no                              | The check does not look at commit messages. Branch protection requires linear history.                                                                          |
| Release validation                                                                                                                                                                                           | A release runs the component tests and a Kustomize build, then publishes a non-empty manifest.                                                                                                                                                                                      | `just release-please-build <project>`, from `.github/workflows/release-package.yml`.                          | not applicable (runs on `main`) | It finds a failure after the merge.                                                                                                                             |
| Kube-vip manifest regeneration                                                                                                                                                                               | The generated files match the `codegen-kube-vip` recipe output.                                                                                                                                                                                                                     | `just codegen-kube-vip`, from `.github/workflows/codegen-kube-vip.yml`.                                       | no                              | The workflow commits the result instead of failing. Nothing fails when someone edits a generated file by hand and the trigger paths do not match.               |

Not in the table:

- `redis` and `gdp-coraltpu` have no test of their own.
- `just kustomization-tests` runs every test in one command. CI runs each test as its own job.

## Manual QA

Automation cannot check these items. A person must do them.

1. Read the README as a consumer. Replace `{version}` and follow the Component example in a scratch Kustomization. Run `kustomize build` on it. The `just kustomize-lint` recipe does not check the README text.
2. Compare each version and port in the README with the files. For the Pod Security components, compare the README table with `namespace-labels.yml`.
3. For a change to a privileged or `hostUsers` setting, read the Pod spec and explain in the pull request why the level is the lowest that works.
4. For a change to `kube-vip` or `kube-vip-wireguard`, test on a real cluster with at least two nodes. Minikube cannot test fail over of a virtual IP address. Run `kubectl get pods -n <namespace>` and `kubectl logs` for each DaemonSet.
5. For a new image major version, read the upstream release notes for data migration. The tests start a new instance only. They do not test an upgrade from stored data.
6. For a change in a component that has a user namespace requirement, confirm that the target nodes support user namespaces.
7. Run the tests that apply to the change before you ask for review. Use `just kustomization-test <name>` for one component, or `just test` for all. These need Minikube, Docker, and Ansible. `just` and `kustomize` also must exist. If a tool is missing, say so in the pull request. Warning: the `minikube_test` role runs `minikube stop` and `minikube delete --profile=<test directory name>` when a test ends. Do not give a Minikube profile that you want to keep the same name as a test directory.
8. Check that the pull request shows the required checks and not only some of them. A `kustomization-test` job that is not required can fail while the pull request looks mergeable.

## Known gaps

- The enforce-baseline and enforce-restricted READMEs state version `v1.36`. Their `namespace-labels.yml` files set `v1.37`. The Pod Security tests read the YAML, not the README.
- The `priorityclass` README version badge queries the `factorio` path, so it shows the Factorio version.
- `kustomization-test (kube-vip-wireguard)`, the five `pod-security-*` test jobs, `release-automation-test`, `image-release-notes-test`, and `Validate PR title` are not required checks. Add them to branch protection or document the reason.
- The `priorityclass` test has no assertion.
- No test checks a security context directly. The tests rely on the namespace admission level. A restricted component that is deployed without the label is not checked.
- No test checks that a README example builds. A broken example is not found.
- No test covers `redis` and `gdp-coraltpu` on their own. They have no release package.
- No test covers an upgrade from an earlier release of a component.
- No check confirms that each component has an entry in `release-please-config.json` and a `kustomization-test` matrix entry. A new component can miss one of them.
