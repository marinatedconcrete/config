# QA for release tooling

## Scope

This page covers the files that plan, validate, and publish releases.
Use it to review a change to any of these files:

- `.github/release/*`. This directory has the Node.js release scripts, their tests, `package.json`, and `package-lock.json`. Its `README.md` describes the release sequence and recovery.
- `.github/scripts/next-calver-version.sh`. This script gives the next CalVer version for the `devcontainer-base` image.
- `release-please-config.json` and `.release-please-manifest.json`. These files list each released package and its current version.

The release workflows call these files.
Review a change to `.github/workflows/release-please.yml` and `.github/workflows/release-package.yml` with this page also.
The `release-please-build` and `release-please-validate` recipes in `justfile` are part of the same flow.

## Review checklist

### Release configuration

- Each path in `packages` in `release-please-config.json` has an entry in `.release-please-manifest.json`. Each path exists in the repository.
- Do not edit a version in `.release-please-manifest.json` by hand. Release Please changes it in a release PR. One exception applies. To register a new package, a person adds a line with the value `0.0.0` to this file and a matching entry to `release-please-config.json`.
- A new image package sets `include-v-in-tag` to `false` and `tag-separator` to `-`. Compare it with `images/kairos-fedora`.
- A new package path must also fit `plan.mjs`. That script accepts only `kustomization/components/*`, `actions/*`, `ansible`, `renovate`, and four named images. Other paths fail at release time with `Unsupported release path`. Update `plan.mjs`, its tests, and `release-package.yml` in the same PR.
- A new image needs its own job in `.github/workflows/release-package.yml`. A new component needs a test in `kustomization/tests/` and an entry in the `kustomization-test` matrix in `.github/workflows/ci.yml`.
- A new source package needs a case in the `release-please-validate` recipe in `justfile`.
- Keep past changelog entries unchanged. Do not change `changelog-sections` without a reason.

### Release scripts

- The scripts do not publish before validation succeeds. The Git tag must not exist before validation. Read the release sequence in `.github/release/README.md`.
- A rerun gives the same end state. Publication must stop, with no write, when an existing tag, asset, or image digest differs from the validated value.
- Publisher changes keep compatibility with existing validation records. An incompatible record must stop publication before any write.
- A new behavior has a test in the matching `*.test.mjs` file. The tests use simulated GitHub API responses. Do not add a test that calls the real GitHub API or GHCR.
- A change to the release sequence, recovery, or package validation updates `.github/release/README.md` in the same PR.
- Keep release scripts as `.mjs` files in `.github/release/`. The Prettier globs in `justfile` cover every `.md`, `.yml`, `.yaml`, `.json`, and `.mjs` file, including nested files.
- A change to workflow concurrency keeps `cancel-in-progress: false` for release runs. An active release run must not be canceled.

### Security

- Keep `permissions` at the minimum. The release workflows use `contents: read` and `packages: write`.
- The GitHub App token creates tags and publishes releases. Do not use it in a step that runs code from an image.
- Pin each third-party action to a full commit SHA with a version comment. Renovate keeps these pins.
- Do not put untrusted values in a `run:` script as `${{ }}` text. Pass them in `env:`, as the existing workflows do.
- Install Node.js dependencies with `npm ci --ignore-scripts`.

### Shell script

- `.github/scripts/next-calver-version.sh` passes `shellcheck`.
- The script reads tag names from standard input and prints one version. It does not call the network.
- Update the comment at the top of the script when the version format changes. Check the caller in `.github/workflows/image-devcontainer-base.yml` also.

### Renovate behavior

- `release-please` in `.github/release/package.json` has an exact version. Renovate updates it with a `fix(package)` commit for a patch update, a `feat(package)` commit for a minor update, and a `feat(package)!` commit for a major update. Renovate merges a patch update without a PR when its checks pass. A person must make sure that the release script tests pass before a minor or major update merges. The `release-automation-test` job is not a required check.
- Renovate auto-merges digest, minor, and patch updates of `actions/*`. The global patch rule also auto-merges patch updates of third-party actions, as a branch merge with no PR. A person must merge a minor or major update of a third-party action.
- Do not edit `package-lock.json` by hand. Use `npm install --prefix .github/release --package-lock-only --ignore-scripts`.

### Commit type and scope

- The PR title uses a Conventional Commits header. The `Validate PR title` job checks it.
- These paths are not release packages, so a change to them does not make a release by itself. Past changes use `fix:` for a defect in the release flow and `feat:` for new release behavior, with no scope. Example: `fix: validate source releases with only their own checks`.
- Use the scope `package` only for Renovate dependency updates.
- Add `!` only for a breaking change to a released package.

## Automated validation coverage

The "Required" column comes from `gh api repos/marinatedconcrete/config/branches/main/protection`, which is read-only.
At the time of writing, the required checks are `lint`, `check-format`, `build`, and six `kustomization-test` entries.
The `release-automation-test` job is not required.

| Check                                           | What it proves                                                                                                                         | Where it runs                                                                       | Required in branch protection                      | Gap                                                                                                                                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release script tests (`node --test *.test.mjs`) | Release planning, publication, recovery, and image digest checks work with simulated GitHub API responses. 58 tests passed locally.    | `npm test --prefix .github/release`. CI job `release-automation-test` in `ci.yml`.  | No                                                 | A failure does not block a merge. `plan.test.mjs` tests `plan.mjs`. No test covers the command-line entry check in `plan.mjs` or the files `publish-cli.mjs` and `recover-cli.mjs`. No `just` recipe runs the tests. |
| ShellCheck on `next-calver-version.sh`          | The script has no ShellCheck findings.                                                                                                 | `just shellcheck-lint`, run by `just lint`. CI job `lint`.                          | Yes                                                | None for syntax.                                                                                                                                                                                                     |
| Behavior of `next-calver-version.sh`            | Nothing.                                                                                                                               | No check.                                                                           | Not applicable                                     | No test for an empty list, a leading zero, a number above 9, or a different prefix. The `devcontainer-base` workflow runs the script only for schedule and manual runs on `main`.                                    |
| Prettier format                                 | The `.github/release/*.mjs` files, JSON files, and Markdown files follow the Prettier format. This includes both release-please files. | `just check-format`. CI job `check-format`.                                         | Yes                                                | None known.                                                                                                                                                                                                          |
| Renovate configuration check                    | `renovate.json` and `renovate/*.json` are valid.                                                                                       | `just renovate-lint`. CI job `lint`.                                                | Yes                                                | The check does not cover `release-please-config.json`.                                                                                                                                                               |
| PR title check                                  | The PR title follows Conventional Commits.                                                                                             | CI job `Validate PR title` in `semantic-commits.yml`.                               | No                                                 | A merge with a wrong title can give a wrong version bump or no release. The check applies to the PR title only.                                                                                                      |
| Source release validation                       | The `ansible`, `renovate`, and `actions/*` packages pass their own checks before release.                                              | `just release-please-validate <path>`. CI job `source` in `release-package.yml`.    | Not applicable. It runs after a release PR merges. | No check runs before the merge. A failure shows only after the release PR merges.                                                                                                                                    |
| Component release build                         | A Kustomize component passes its test and builds before release.                                                                       | `just release-please-build <project>`. CI job `component` in `release-package.yml`. | Not applicable. It runs after a release PR merges. | Same as above.                                                                                                                                                                                                       |
| Release config and manifest consistency         | Nothing.                                                                                                                               | No check.                                                                           | Not applicable                                     | No check compares `release-please-config.json` with `.release-please-manifest.json`. No schema check runs. No check compares package paths with the paths in `plan.mjs`.                                             |
| Workflow syntax and logic                       | Nothing.                                                                                                                               | No check.                                                                           | Not applicable                                     | No `actionlint` or `yamllint` run. A mistake in `release-package.yml` shows only on a real release.                                                                                                                  |
| End-to-end release                              | Nothing.                                                                                                                               | No check.                                                                           | Not applicable                                     | No test makes a tag, a draft release, or a GHCR tag. The README says that GitHub event delivery and GHCR publication need separate integration checks.                                                               |

## Manual QA

Automation cannot prove real publication.
Do these checks when a change touches the release sequence, `plan.mjs`, or `publish.mjs`.

1. Run the local checks:

   ```sh
   pnpm install --frozen-lockfile
   npm ci --prefix .github/release --ignore-scripts
   npm test --prefix .github/release
   just shellcheck-lint
   just renovate-lint
   just check-format
   ```

2. Run the version script with sample tag names:

   ```sh
   printf 'devcontainer-base-2026.11.9\ndevcontainer-base-2026.11.1\n' \
     | bash .github/scripts/next-calver-version.sh devcontainer-base-2026.11
   ```

   The output must be `2026.11.10`.
   An empty input must give `2026.11.0`.

3. Check that the config and the manifest list the same paths. Run this command from the repository root:

   ```sh
   node -e 'const c=require("./release-please-config.json"),m=require("./.release-please-manifest.json");const a=Object.keys(c.packages),b=Object.keys(m);console.log(a.filter(x=>!b.includes(x)),b.filter(x=>!a.includes(x)))'
   ```

   Both lists must be empty.

4. For a change to the publisher or the workflows, inspect the release workflow result for a recent release PR after the change reaches `main`. Confirm that its release is published, not a draft. Check its tag and validation record. Use simulated recovery tests for routine QA. Do not start a production recovery run solely to test the change. A recovery run for a draft or a missing release starts a new validation and publication.
5. Before merge, check the package and expected tag in the release PR. After merge, check the Release Please run on `main` for rejected candidates.
6. Read the workflow `permissions` and the secrets use in the diff. Automation does not check them.

## Known gaps

- Make `release-automation-test` a required check. It is the only check for the release scripts, and a failure does not block a merge.
- Add a test for `next-calver-version.sh`. Cover an empty list, a leading zero, a number above 9, and a different prefix.
- Add a check that each package in `release-please-config.json` has a manifest entry, an existing path, and a supported path in `plan.mjs`.
- Add a workflow linter, for example `actionlint`, to `just lint`.
- Add tests for the command-line entry check in `plan.mjs` and for the files `publish-cli.mjs` and `recover-cli.mjs`.
- Add a `just` recipe that runs the release script tests. The README lists `npm test` only.
- Run source and component release validation on release PRs, before the merge.
- Limit the write tokens of third-party actions. The auto-merge of third-party patch updates gives the code of these actions access to the write tokens of the workflows, with no human review.
- Fix the exclusion of `ansible/requirements.txt`. The file is in `exclude-paths` for `ansible` in `release-please-config.json`. Commit `9cc8e0f` (#1052) changed only this file, but the `ansible-collection` 2.0.0 changelog lists it.
