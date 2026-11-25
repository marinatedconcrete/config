---
description: Add a new Kustomize component to this repository, with its test, docs, release registration, and Renovate rules.
---

# Add a Kustomize component

Use this prompt to add one Kustomize component to `marinatedconcrete/config`.
The prompt is for coding agents and for people.
Read `AGENTS.md` first and follow it.
Replace `{name}` with the component name.

## Inputs

Get these facts before you start.
Ask the requester if you cannot find a fact.

- `{name}`: the component name in lowercase kebab case, for example `mosquitto`.
- The workload: the container images, ports, storage, and secrets.
- The issue to reference. Add "Part of #1076" only if the work is part of that issue.

## Reference examples

Copy the structure of a current component. Do not copy from memory.

- `kustomization/components/mosquitto`: a small `restricted` component with a `Deployment`, a `Service`, a PVC, and a generated `ConfigMap`.
- `kustomization/components/paperless`: a `baseline` component with documented exceptions.
- `kustomization/components/kube-vip-wireguard`: a recent component with its own release package.
  Commit `de1dc7d` added it. Run `git show --stat de1dc7d` to see the files of a new component.
  Some files in that commit are specific to kube-vip: `justfile`, `renovate.json`, `.devcontainer/devcontainer.json`, and `.github/workflows/codegen-kube-vip.yml`.
  Do not copy these changes for another component.
  The generic files are the component directory, the test directory, the CI matrix in `.github/workflows/ci.yml`, `release-please-config.json`, `.release-please-manifest.json`, and `renovate/marinatedconcrete.json`.
  That commit changed `.github/workflows/checks.yml`. This file is now `.github/workflows/ci.yml`.

## Step 1. Build the component

Create `kustomization/components/{name}/`.

1. Use `{name}` for the directory. Do not add a `kustomize-` prefix.
2. Add `kustomization.yml` with `kind: Component` and `apiVersion: kustomize.config.k8s.io/v1alpha1`.
3. Start each YAML file with `---`.
4. List each manifest under `resources`. Use one file for each resource kind, for example `deployment.yml` or `service.yml`.
5. Use a bare image name in the manifest, for example `image: eclipse-mosquitto`.
   Set the tag in the `images` list of `kustomization.yml`.
   Use `newTag: <version>@sha256:<digest>`. Always pin the digest.
6. Set `app.kubernetes.io/name: {name}` as the selector label.
7. Set `priorityClassName` on each pod.
   Use a class that `kustomization/components/priorityclass` defines.
   The classes are `critical-application-infra`, `critical-application`, `application-infra`, `application`, and `opportunistic`.
8. Set resource requests and limits, as the reference examples do.
9. Do not set `metadata.namespace`. The user sets the namespace.
10. Put secrets that the user must supply in the documentation. Do not put real secrets in the component.
11. For a group of components that share one release, use subdirectories. Keep one release package for the group, as `pod-security` does.

### Pod security level

Make the pod comply with the `restricted` Pod Security Standard whenever possible.
Set these fields on each container, including init containers:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  runAsNonRoot: true
  seccompProfile:
    type: RuntimeDefault
```

Set `runAsUser`, `runAsGroup`, and `fsGroup` on the pod when the image needs a fixed user, as `mosquitto` does.

Use `baseline` or `privileged` only when the workload cannot run under `restricted`.
Before you accept an exception, try these fixes:

1. Run the container as a non-root user.
2. Add only the capabilities that the container needs. Keep `drop: [ALL]`.
3. Set `hostUsers: false` so the pod runs in a user namespace.
   `paperless` does this. Document the node requirements in the README.
4. Do not run a privileged step in the pod. Ask the node owner to do it, and add an init container that is not privileged and checks the result. `kube-vip-wireguard` checks node sysctls this way.

Justify each exception in these three places:

- A comment in the manifest that names the field and the reason, for example the `CHOWN` comment in `kustomization/components/paperless/statefulset.yml`.
- The Pod Security badge in the component README. Use `baseline` or `privileged` in place of `restricted`.
- The PR description.

## Step 2. Add the end-to-end test

For a standalone component, create `kustomization/tests/{name}/`.
For a shared release, create `kustomization/tests/{group}-{child}/` for each child.
The release build runs `just kustomization-test` with these directory names, so a different name breaks the release.
Use each test directory name for `{name}` in the test commands and the CI matrix entries below.
Start from `kustomization/tests/mosquitto`.

| File                | Content                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `kustomization.yml` | A `Kustomization` that lists `../../components/{name}` and `../../components/priorityclass` under `components`. Set `namespace: {name}-test`. |
| `namespace.yml`     | A `Namespace` named `this-is-ignored-but-is-required`. Set the labels in the next paragraph.                                                  |
| `test.yml`          | An Ansible play that uses the `marinatedconcrete.config.minikube_test` role.                                                                  |
| Other files         | Secrets and other inputs that the component needs, listed under `resources`.                                                                  |

Set these labels in `namespace.yml`.
Use the same level as the component README:

```yaml
pod-security.kubernetes.io/enforce: restricted
pod-security.kubernetes.io/enforce-version: latest
```

In `test.yml`:

1. Set `minikube_test__test_dir: kustomization/tests/{name}` in the role variables.
2. Set `kubernetes_core_k8s__context: {name}`. The role names the minikube profile with this value.
3. Set `test_namespace` to `"{{ (lookup('file', 'kustomization.yml') | from_yaml).namespace }}"`.
4. Wait for each workload to become ready with `kubernetes.core.k8s`, `wait: true`, and `wait_timeout: 300`.
5. Assert one behavior that a user can see, for example that the `Service` has an endpoint.
   Do not only check that the manifests apply.
6. Set `minikube_test__enable_local_path_storage: true` if the component uses a PVC.
   Set `minikube_test__enable_user_namespaces: true` if the pod sets `hostUsers: false`.

The Pod Security admission controller enforces the namespace label in minikube.
A pod that breaks the label does not start, so the test fails.
This is the proof that the component meets its stated level.

Run the test:

```sh
just kustomization-test {name}
```

The recipe runs `ansible-playbook kustomization/tests/{name}/test.yml`.
It needs `minikube`, `ansible-playbook`, and the `marinatedconcrete.config` collection.
The devcontainer has these tools.
Run `just test` to run every component test.

## Step 3. Add the CI matrix entry

Add `{name}` to `jobs.kustomization-test.strategy.matrix.kustomization-test` in `.github/workflows/ci.yml`.
Add the entry in the place that fits the list. The list is not in strict alphabetical order now.
The `.github/workflows/release-package.yml` workflow runs the same test before it publishes a release.

GitHub shows each matrix entry as a separate check named `kustomization-test (<entry>)`.
If branch protection on `main` lists required checks by name, a maintainer must add `kustomization-test ({name})`.
You cannot change branch protection from a PR.
Say in the PR description that this manual update may be necessary.

## Step 4. Write the documentation

Create `kustomization/components/{name}/README.md`.
Copy the structure of `kustomization/components/mosquitto/README.md`.

1. Start with the heading `# {Name} Component`.
2. Add the version badge. Copy it from another README and change the component path and the release search text to `kustomize-{name}`.
3. Add the Pod Security Standard badge with the real level.
4. Add the priority class badge if the component sets one.
5. Describe what the component installs in short sentences.
6. Add the `# Examples` section with a `## Component` example and a `## Resource` example.
   The component URL is `https://github.com/marinatedconcrete/config/kustomization/components/{name}?ref=kustomize-{name}@v{version}`.
   The resource URL is `https://github.com/marinatedconcrete/config/releases/download/kustomize-{name}@v{version}/{name}.yml`.
7. Add `# Required Secrets`, `# Required Setup`, `# Required Patches`, and `# Optional Patches` sections where they apply.
   Show a complete example for each secret and each patch.
8. Document each node or cluster requirement, for example user namespace support.

Do not create `CHANGELOG.md`. Release Please creates it.

## Step 5. Register the release package

Edit these files.
Keep the sort order that each file has now. In `.release-please-manifest.json`, add the line at the end of the component lines.

1. `release-please-config.json`: add a package under `packages`.

   ```json
   "kustomization/components/{name}": {
     "initial-version": "1.0.0",
     "package-name": "kustomize-{name}",
     "release-type": "simple"
   }
   ```

   The key is the component path. The package name is `kustomize-` plus `{name}`.
   The tag is then `kustomize-{name}@v<version>`.

2. `.release-please-manifest.json`: add `"kustomization/components/{name}": "0.0.0"`.
   With `initial-version` set to `1.0.0`, the first `feat` commit makes release `1.0.0`.
3. `renovate/marinatedconcrete.json`: add a `packageRules` entry that groups the updates of the new package for consumers.

   ```json
   {
     "groupName": "marinatedconcrete {Name} Kustomize Component",
     "groupSlug": "marinatedconcrete-kustomize-{name}",
     "matchCurrentValue": "kustomize-{name}@**",
     "matchPackageNames": ["marinatedconcrete/config"]
   }
   ```

Do not edit `CHANGELOG.md` files or version numbers by hand.
Release Please owns them.

## Step 6. Add the Renovate rules

Renovate updates the `newTag` values in `images` of `kustomization.yml`.
It reads `tag@sha256:digest`, so it updates the tag and the digest together.
The rules in `renovate.json` decide how updates merge.

1. Patch updates already auto-merge after 3 days through the "Auto-merge all patch updates" rule.
2. For a component whose minor updates are also safe, add a rule like the `mosquitto` rule:

   ```json
   {
     "description": "Auto-merge all {name} updates",
     "automerge": true,
     "automergeType": "branch",
     "groupName": "{name}",
     "matchFileNames": ["kustomization/components/{name}/kustomization.yml"],
     "matchUpdateTypes": ["minor", "patch", "digest"],
     "minimumReleaseAge": "3 days"
   }
   ```

   Add the rule next to the other component rules.
   Skip it if a person must review minor updates.

3. To keep an image on one release line, add an `allowedVersions` rule, like the `mongo` rule for `unifi-network-application`.
4. The rule "Require manual review for registries without release timestamps" disables auto-merge for `ghcr.io`, `quay.io`, `registry.k8s.io`, and `lscr.io` images.
   This rule comes after the component rules, so it overrides them. Read the order of the rules in `renovate.json` before you expect an auto-merge for these registries.
5. Renovate commits use the `package` scope, set by `:semanticCommitScope(package)`.
   Do not add a different scope rule.
   Renovate uses `feat` for minor updates and `feat(package)!` for major updates.
   Files under `tests/` use the `test` type, so they do not make a release.
6. If you add a `# renovate:` comment for a version outside `images`, check that a `customManagers` entry in `renovate.json` matches it.
   Do not add a second source of the same version.

## Step 7. Verify

Run these commands from the repository root.
Use the devcontainer CLI if a tool is not on the host.
Report each tool that you could not run.

```sh
kustomize build kustomization/components/{name}/ > /dev/null
just kustomize-lint
just renovate-lint
just kustomization-test {name}
just format
just check-format
just lint
```

- `just kustomize-lint` builds every component. It needs `kustomize`.
- `just renovate-lint` validates `renovate.json` and the files in `renovate/`. It needs `pnpm install --frozen-lockfile`.
- `just kustomization-test {name}` needs `minikube` and Docker.
  `just kustomization-test` and `just test` start and delete minikube profiles. The handlers of the `minikube_test` role run `minikube stop` and `minikube delete`.
  Run them in the devcontainer or on a machine that has no profile with the same name.
- `just lint` also runs `ansible-lint` and needs `minikube`. Run the parts that you can.
- Check all new prose against ASD-STE100. `just check-format` does not check it.
- Check that `git status` shows no stray files, for example a built manifest.

## Step 8. Commit and open the PR

1. Make a branch. Do not commit to `main`.
2. Use Conventional Commits. Sign the commits when possible.
   - A new component: `feat({name}): add the {name} component`.
   - A breaking change to a released component: `feat({name})!: ...`. Put `!` immediately before the colon. Add a `BREAKING CHANGE:` footer as the last paragraph of the PR description.
   - A fix: `fix({name}): ...`.
   - Documentation only: `docs({name}): ...`.
   - Test only: `test({name}): ...`. Renovate uses the same `test` type for test files.
     Use the component name as the scope.
     The changelog sections are `feat`, `fix`, `docs`, `build`, and `chore`.
3. Put the reasons, and each Pod Security exception, in the PR description. The repository allows only squash merge. The PR title and the PR description become the commit on `main`, and the text in the branch commits is discarded.
4. Run `just format` before each commit.
5. Open the PR. Use a Conventional Commit title, because `.github/workflows/semantic-commits.yml` checks it.
6. Add "Part of #1076" to the PR description only if the work is part of that issue.
   Do not use "Fixes" or "Closes" for #1076.
7. After review, add new commits. Do not squash or amend a reviewed commit.
8. Do not edit a version number, a `CHANGELOG.md` file, or a tag. Release Please does that after the merge.

### A finished PR contains

- `kustomization/components/{name}/` with `kustomization.yml`, the manifests, and `README.md`.
- `kustomization/tests/{name}/` with `test.yml`, `kustomization.yml`, and `namespace.yml`.
- One new line in the matrix of `.github/workflows/ci.yml`.
- One new package in `release-please-config.json` and one new line in `.release-please-manifest.json`.
- One new group rule in `renovate/marinatedconcrete.json`.
- A Renovate auto-merge rule in `renovate.json`, if the component needs one.
- A PR description that lists the verification results, each exception to `restricted`, and the possible manual update of the required checks.

Put all of these changes in one `feat({name})` commit. This is the established practice.
A new component also causes a release of the Renovate preset, because `renovate/marinatedconcrete.json` changes.
See `renovate/CHANGELOG.md` version 2.9.0 and `kube-vip-wireguard` in #1010.
