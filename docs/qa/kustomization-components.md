# QA for Kustomize components

This page tells a reviewer what a good change looks like in the Kustomize components.
It also shows which checks run automatically and which checks need a person.

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

The release setup is in [release tooling](./release-tooling.md).

## Review checklist

Apply each item to the files that the change touches.

### Commit and pull request

- The title and commit follow [AGENTS.md](../../AGENTS.md). The scope is the component name, for example `fix(paperless)` or `feat(kube-vip-wireguard)`.
- A change that a consumer must act on is a breaking change. This includes a new required patch, a new required Secret, and a change of the user namespace setup. Examples are `feat(paperless)!` in #1035 and `feat(unifi-network-application)!` in #1033. Annotate it as the [pull request template](../../.github/pull_request_template.md) describes.
- A change that does not break a consumer does not use `!`.
- A change only to `kustomization/tests/**` uses the `test` type. It makes no release.
- Do not edit `CHANGELOG.md` files or `.release-please-manifest.json` by hand. See [release tooling](./release-tooling.md).

### Component files

- Each released component has a `kustomization.yml`, a `README.md`, and an entry in `release-please-config.json` and `.release-please-manifest.json`.
- The component is a `kind: Component` that a consumer can select. A directory that has only children, such as `pod-security`, is not selected itself.
- Each container image uses a version and a digest in `newTag`, for example `2.0.22@sha256:...`. Renovate updates both values.
- Each image update comment or custom manager still matches the file. The `customManagers` in `renovate.json` read `# renovate:` comments and `newTag` values.
- The component does not set a namespace. The consumer sets it.
- Each component that needs a Secret or a patch from the consumer documents it, and the test supplies it.
- A new `kustomization.yml` builds. Run `just kustomize-lint`.

### Security posture

- The workload meets the Pod Security level in its README badge. The test namespace in `kustomization/tests/<name>/namespace.yml` enforces the same level, so the Pod must pass admission.
- A change that lowers the level (for example restricted to baseline) is a deliberate decision. The reviewer must see the reason in the pull request, the badge, the test namespace label, and the README.
- Only `kube-vip` and `kube-vip-wireguard` run at the privileged level. A new privileged component needs a reason in the pull request.
- A workload that can use user namespaces sets `hostUsers: false`, and the README has a "Enable User Namespaces" section. `factorio`, `paperless`, and `unifi-network-application` do this. The test then sets `minikube_test__enable_user_namespaces: true`.
- Containers drop capabilities and block privilege escalation where the application allows it. Apply the same hardening to all images that use the same framework.
- A security claim in a pull request has a test or an explicit reason why no test is possible.
- A Secret in a test file holds only throwaway values.
- The Pod Security components keep the version rules in their READMEs. Baseline and restricted enforcement use a fixed Kubernetes minor version. The other modes use `latest`.

### Documentation

- The README has the version badge and the Pod Security badge. A component that sets a `priorityClassName` also has the priority class badge.
- Each badge points at the right component. The version badge query uses the component path.
- The README has an Examples section with a Component example and a Resource example. The Resource URL has the form `.../releases/download/kustomize-<name>@v{version}/<name>.yml`.
- Setup sections use the same headings as the other READMEs: `Required Setup`, `Required Secrets`, `Required Patches`, and `Optional Patches`.
- A change to a default value, a port, or a version also changes the README text that states it.
- New prose follows ASD-STE100, as `AGENTS.md` requires. Past changelog entries stay unchanged.

### Generated files

- Do not edit the files that have the `# @generated` header by hand. These are `kube-vip/daemonset/vip.yml`, `kube-vip/daemonset/services.yml`, `kube-vip/rbac.yml`, and `kube-vip-wireguard/daemonset/wireguard.yml`.
- A change to these files comes from the `codegen-kube-vip` recipe in the `justfile`. Change the recipe, then regenerate.
- A pushed change to `justfile` or to the two kube-vip `kustomization.yml` files can add a bot commit `chore(package): regenerate kube-vip manifests`. Pull it before you push again.

### Renovate behavior

Renovate rules and auto-merge behavior are in [Renovate presets](./renovate-presets.md).

- Version limits stay in place. Unifi MongoDB stays below 8.1.0.

## Automated validation coverage

| Validated                                                                 | How to run                                          | What it proves                                                                                                                                                                                                                                                                      | What it does not prove                                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Build of every component                                                  | `just kustomize-lint`                               | Each `kustomization.yml` under `kustomization/components` renders without error.                                                                                                                                                                                                    | The output.                                                                                            |
| `factorio`                                                                | `just kustomization-test factorio`                  | The StatefulSet becomes ready on Minikube with user namespaces. The admin and game Services have endpoints. The test namespace enforces the restricted level.                                                                                                                       | A game connection or saved data.                                                                       |
| `kube-vip`                                                                | `just kustomization-test kube-vip`                  | Both DaemonSets become ready. Each log shows its own metrics port. The privileged namespace admits the Pods.                                                                                                                                                                        | That a virtual IP address moves, because Minikube has one node.                                        |
| `kube-vip-wireguard`                                                      | `just kustomization-test kube-vip-wireguard`        | The WireGuard load balancer class settings are present. The init container stops the Pod when a node sysctl is 0. The DaemonSets start when the sysctls are 1. The tunnel comes up and the services instance skips the WireGuard Service.                                           | Fail over of a virtual IP address.                                                                     |
| `mosquitto`                                                               | `just kustomization-test mosquitto`                 | The Deployment becomes ready and the Service has an endpoint. The restricted level is enforced.                                                                                                                                                                                     | An MQTT login or a message.                                                                            |
| `paperless`                                                               | `just kustomization-test paperless`                 | The StatefulSet becomes ready. A scan that is uploaded through Samba appears in Paperless through the Service and the public host name. Paperless removes the scan from the consume directory. The baseline level is enforced.                                                      | `redis` on its own.                                                                                    |
| `priorityclass`                                                           | `just kustomization-test priorityclass`             | The five PriorityClass objects exist with their expected values.                                                                                                                                                                                                                    | Which workloads use the PriorityClass objects.                                                         |
| `unifi-network-application`                                               | `just kustomization-test unifi-network-application` | The StatefulSet becomes ready and the Service has an endpoint. The baseline level is enforced.                                                                                                                                                                                      | The controller web interface or the `ServersTransport` patch.                                          |
| The five `pod-security-*` components                                      | `just kustomization-test pod-security-<name>`       | The component sets the right labels on every Namespace and keeps other labels. Allowed pairs of components give the same result in each order. A render with no Namespace is empty. For the baseline and restricted enforcement components, the Renovate manager reads the version. | The version text in each README. Documented versions can differ from the real labels (see Known gaps). |
| Format of Markdown, YAML, JSON, and `.mjs` files, and the `justfile`      | `just check-format`                                 | Prettier accepts every such file, including nested files.                                                                                                                                                                                                                           | ASD-STE100 compliance.                                                                                 |
| Ansible, Dockerfile, Kustomize, Renovate configuration, and shell scripts | `just lint`                                         | `ansible-lint`, `hadolint`, Kustomize build, the Renovate configuration check, and ShellCheck pass.                                                                                                                                                                                 | Any behavior of the components.                                                                        |
| Release scripts                                                           | `npm test --prefix .github/release`                 | The release scripts in `.github/release` select and publish the right package.                                                                                                                                                                                                      | A release of a real component.                                                                         |
| Release of one package                                                    | `just release-please-build <project>`               | The component tests and a Kustomize build pass, and the published manifest is not empty.                                                                                                                                                                                            | A problem before the merge. A release finds a failure after the merge.                                 |
| Kube-vip generated manifests                                              | `just codegen-kube-vip`                             | The generated files match the recipe output.                                                                                                                                                                                                                                        | A hand edit of a generated file. The automation commits its result instead of failing.                 |

`redis` and `gdp-coraltpu` have no test of their own.

## Manual QA

Automation cannot check these items. A person must do them.

1. Read the README as a consumer. Replace `{version}` and follow the Component example in a scratch Kustomization. Run `kustomize build` on it. The `just kustomize-lint` recipe does not check the README text.
2. Compare each version and port in the README with the files. For the Pod Security components, compare the README table with `namespace-labels.yml`.
3. For a change to a privileged or `hostUsers` setting, read the Pod spec and explain in the pull request why the level is the lowest that works.
4. For a change to `kube-vip` or `kube-vip-wireguard`, test on a real cluster with at least two nodes. Minikube cannot test fail over of a virtual IP address. Run `kubectl get pods -n <namespace>` and `kubectl logs` for each DaemonSet.
5. For a new image major version, read the upstream release notes for data migration. The tests start a new instance only. They do not test an upgrade from stored data.
6. For a change in a component that has a user namespace requirement, confirm that the target nodes support user namespaces.
7. Run the tests that apply to the change before you ask for review. Use `just kustomization-test <name>` for one component, or `just test` for all. These need Minikube, Docker, and Ansible. `just` and `kustomize` also must exist. If a tool is missing, say so in the pull request. Warning: the `minikube_test` role runs `minikube stop` and `minikube delete --profile=<test directory name>` when a test ends. Do not give a Minikube profile that you want to keep the same name as a test directory.

## Known gaps

- The enforce-baseline and enforce-restricted READMEs state version `v1.36`. Their `namespace-labels.yml` files set `v1.37`. The Pod Security tests read the YAML, not the README.
- The `priorityclass` README version badge queries the `factorio` path, so it shows the Factorio version.
- No test checks a security context directly. The tests rely on the namespace admission level. A restricted component that is deployed without the label is not checked.
- No test checks that a README example builds. A broken example is not found.
- No test covers `redis` and `gdp-coraltpu` on their own. They have no release package.
- No test covers an upgrade from an earlier release of a component.
- No check confirms that each component has an entry in `release-please-config.json` and a `kustomization-test` matrix entry. A new component can miss one of them.
