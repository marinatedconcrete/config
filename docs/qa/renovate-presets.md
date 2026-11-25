# QA: Renovate presets and configuration

This page tells a reviewer what a good change looks like for the Renovate configuration.
A reviewer can be a human or an agent.
The page also shows what automation proves and what a person must check.

## Scope

This page covers two groups of files.

- `renovate/devcontainer.json`, `renovate/marinatedconcrete.json`, and `renovate/recommended.json`. These files are shared presets.
  Other repositories use them in `extends`. The `renovate/README.md` file describes them.
- `renovate.json` in the repository root. This file is the Renovate configuration for this repository.
  It is not a shared preset. It extends the three presets.

The `renovate` path is one release-please package, `renovate-config`.
The tag format is `renovate-config-<version>`.
A change in `renovate/` can make a release. A change in the root `renovate.json` does not make a release.

The root `renovate.json` pins the three presets to a released tag, for example `renovate-config-2.9.0`.
A change in `renovate/` has no effect on this repository until the release is made.
After the release, a Renovate pull request updates the tag.
The `marinatedconcrete` preset has a custom manager that updates these tags.

## Review checklist

### Files and structure

- Check that a preset change is in `renovate/*.json`. Check that a change for this repository only is in `renovate.json`.
- Check that a new `packageRules` entry in `renovate.json` has a `description` field. Most existing entries in that file have one.
- Check that each file keeps the `$schema` line.
- Check that a new custom manager uses a named capture group for `currentValue`.
  Check that it also sets `datasource` and `depName` with a capture group or a template.
  The validator rejects a manager without them.
- Check that a custom manager reads a `# renovate:` comment only when the file to update has that comment.
  Check that the `managerFilePatterns` entry limits the manager to the intended files.

### Consumer impact

- A change in `renovate/` is a change to every consumer that uses the preset. Ask who gets the new behavior.
- Check that a new release tag group in `renovate/marinatedconcrete.json` matches the `package-name` value in `release-please-config.json`.
  The `matchCurrentValue` pattern must match the tag.
- Check that a new component or image has a group, a `sourceDirectory`, or both, if the preset needs them.
  Compare with the existing entries.
- Check `renovate/README.md` when a new preset file or a new use of a preset is added.

### Update behavior

- Check the auto-merge rules. Auto-merge must stay limited to updates that the repository has found safe.
  The `renovate.json` file says that third-party GitHub Actions must not auto-merge, because the image workflows give them write tokens.
- Check that an auto-merge rule has a `minimumReleaseAge`, unless the rule has a reason for no age.
  The devcontainer-base rule sets `minimumReleaseAge` to `null` and gives its reason.
- Check that the default for a registry without release timestamps is `automerge` set to `false`.
  Keep the named exception for `ghcr.io/marinatedconcrete/devcontainer-base`. A later rule enables auto-merge for it.
- Check that a rule for a package does not depend on rule order by accident. Renovate applies later rules over earlier rules.
  Check that a rule near the end of `packageRules` does not hide an earlier rule.
- Check that `allowedVersions` constraints have a `description` that gives the reason.

### Commit type and scope

- Renovate commit titles must pass the Conventional Commits check. Check the `semanticCommitType` and `semanticCommitScope` values.
- Major updates use `feat(package)!`. Minor updates use `feat`. Updates to test files use `test`, so that release-please does not make a release.
  Renovate has no setting for the `!` marker. A rule uses the type string to add it.
- A repository change to Renovate behavior uses the `renovate` scope, for example `feat(renovate): ...` or `fix(renovate): ...`.
  Use `feat` or `fix` when the change must make a release of `renovate-config`.
  The release-please changelog sections include `feat`, `fix`, `docs`, `build`, and `chore`.
  A type that the sections do not list, such as `test`, does not make a release.
- A change that removes or renames a preset file, or removes behavior that a consumer uses, is a breaking change. Use `!` in the commit type.

### Documentation and prose

- Check that the prose follows ASD-STE100, as `AGENTS.md` requires. This applies to the `description` fields and to the `README.md` file.
- Check that a version tag in a `README.md` example is not far behind the latest release. See Known gaps.

### Evidence in the pull request

- A change in update behavior needs more proof than the validator gives. See Manual QA.
  The pull request that changed commit types (#1014) is a good example. It showed a dry run and the resulting titles.

## Automated validation coverage

The table lists each check that applies to this part.
Required in branch protection comes from `gh api repos/marinatedconcrete/config/branches/main/protection`.
The required checks are `lint`, `check-format`, `build`, and six `kustomization-test` jobs.
Branch protection also requires one approving review.

| Check                          | What it proves                                                                                                                                                           | Where it runs                                                                                                                                                                                              | Required in branch protection                            | Gap                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renovate configuration check   | Each file in `renovate/*.json` and `renovate.json` passes `renovate-config-validator`. It finds unknown options, wrong value types, and bad regular expression managers. | `just renovate-lint`, called by `just lint`. CI job `lint` in `.github/workflows/checks.yml`. Also `just release-please-validate renovate` in the `source` job of `.github/workflows/release-package.yml`. | Yes (`lint`)                                             | The check does not show that a rule matches a real dependency or that a custom manager finds a real version. The check accepts a malformed `extends` preset name. See Known gaps. |
| Format check                   | Prettier accepts the format of the JSON and Markdown files.                                                                                                              | `just check-format`. CI job `check-format` in `.github/workflows/checks.yml`.                                                                                                                              | Yes (`check-format`)                                     | A format check does not show ASD-STE100 compliance, as `AGENTS.md` says. No check covers the wording.                                                                             |
| Devcontainer image build       | The devcontainer image builds. The `lint` job runs in this image, so the validator runs with the locked Renovate version.                                                | CI job `build` in `.github/workflows/checks.yml`.                                                                                                                                                          | Yes (`build`)                                            | None for this part.                                                                                                                                                               |
| Pull request title check       | The pull request title is a Conventional Commit title.                                                                                                                   | CI job `Validate PR title` in `.github/workflows/semantic-commits.yml`. No just recipe.                                                                                                                    | No                                                       | The check is not required. The title controls the release type, so a bad title can make a wrong release.                                                                          |
| Release validation             | The `renovate` package passes `just renovate-lint` before the tag and the release are made.                                                                              | `just release-please-validate renovate`. CI job `source` in `.github/workflows/release-package.yml`.                                                                                                       | Not applicable (runs after merge, not on a pull request) | The check repeats the validator. It adds no behavior test.                                                                                                                        |
| Renovate on this repository    | Renovate reads the root `renovate.json` and the released presets and makes pull requests.                                                                                | The hosted Renovate app. No just recipe and no job in this repository.                                                                                                                                     | No                                                       | Renovate shows a problem only after merge, when it opens or fails to open a pull request. A configuration error can be silent.                                                    |
| Behavior of rules and managers | Nothing.                                                                                                                                                                 | None.                                                                                                                                                                                                      | No                                                       | No test shows what Renovate does with a rule. No test shows that a custom manager matches a real file. No test shows the commit titles.                                           |

## Manual QA

A person must check the behavior of the configuration, because no job does.

1. Run the validator on all files. Run `just renovate-lint`.
   The host needs `just` and `pnpm`. Run `pnpm install --frozen-lockfile` first.
   Each file must print `Config validated successfully`.
   If `pnpm` is not on the host, use `npx pnpm install --frozen-lockfile` and the devcontainer.
2. Break the file on purpose, to confirm that the check is live.
   For example, set `automerge` to the string `"yes"` in a copy of the file.
   Run `pnpm exec renovate-config-validator <file>`. The command must exit with status 1.
3. For a rule or a manager change, run a real Renovate dry run against a fork or a branch.
   Use `--platform=github --dry-run=full` and compare the branches and titles before and after the change.
   The pull request for #1014 did this and listed the titles that changed.
4. For a custom manager, check that its regular expression matches the target file.
   Search the file for the `# renovate:` comment form that the expression needs.
   Check the dry run output for the dependency the manager must find.
5. For a preset change, check the consumer view. Read `renovate/README.md` and confirm that the usage text is still true.
   Confirm that the preset file name and the `extends` string in the README are the same.
6. For a release, check that the release pull request for `renovate-config` has the expected version.
   After the release, check that the Renovate pull request that updates the tag in `renovate.json` passes the checks.
7. For a commit type change, read the new title that Renovate makes and run it through the Conventional Commits check.
   Renovate can pick the wrong type when one branch has a major update and a minor update.
   The note in #1014 says the `!` marker can be lost in that case.

## Known gaps

- No test checks what a rule or a custom manager does. A mistake in a regular expression passes the validator and has no effect.
  An issue can add a Renovate dry run or a fixture test.
- The validator accepts a malformed preset name in `extends`. A check that the tags in `renovate.json` exist as releases is missing.
- The `Validate PR title` check is not a required check. A bad title can make a wrong release or no release.
- `renovate/README.md` shows version `2.0.0` in its examples. The latest release is `2.9.0`.
  The text says the examples include a version tag, but a reader can copy an old version.
- `renovate/marinatedconcrete.json` has a group for each released component, but none for `kustomize-pod-security`.
  `kustomization/components/pod-security` is a release-please package. The preset does not group its releases.
  This is a possible omission. It is not confirmed as a defect.
- A major and a minor update in one branch can lose the `!` marker in the commit title. This is a known note from #1014.
