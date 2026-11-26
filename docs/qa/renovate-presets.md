# QA for Renovate presets and configuration

This page tells a reviewer what a good change looks like for the Renovate configuration.
A reviewer can be a human or an agent.
The page also shows what automation proves and what a person must check.

## Scope

This page covers two groups of files.

- `renovate/devcontainer.json`, `renovate/marinatedconcrete.json`, and `renovate/recommended.json`. These files are shared presets.
  Other repositories use them in `extends`. The `renovate/README.md` file describes them.
- `renovate.json` in the repository root. This file is the Renovate configuration for this repository.
  It is not a shared preset. It extends the three presets.

The `renovate` path is one release package, `renovate-config`. See [release tooling](release-tooling.md).
A change in `renovate/` can make a release. A change in the root `renovate.json` does not make a release.

The root `renovate.json` pins the three presets to a released tag.
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
- Check that a new regex custom manager matches a file in this repository. `just renovate-lint` fails when it matches no file.
  A manager that only consumer repositories use needs an entry in `CONSUMER_ONLY_MANAGERS` in `scripts/renovate-checks.mjs`, with the `matchStrings` of the manager and a reason. A manager with other `matchStrings` is not skipped.
- Check that an `extends` entry for this repository names a preset file that exists. `just renovate-lint` fails when the file is missing.
  The check does not read the tag after `#`.

### Consumer impact

- A change in `renovate/` is a change to every consumer that uses the preset. Ask who gets the new behavior.
- Check that a new release tag group in `renovate/marinatedconcrete.json` matches the `package-name` value in `release-please-config.json`.
  The `matchCurrentValue` pattern must match the tag.
- Check that a new component or image has a group, a `sourceDirectory`, or both, if the preset needs them.
  Compare with the existing entries.
- Check `renovate/README.md` when a new preset file or a new use of a preset is added.

### Update behavior

- Check the auto-merge rules. Auto-merge must stay limited to updates that the repository has found safe.
  Third-party GitHub Actions must not auto-merge, because the image workflows give them write tokens.
  A rule after the global patch rule in `renovate.json` sets `automerge` to `false` for them.
  Check that a new auto-merge rule after that rule does not match third-party actions.
- Check that an auto-merge rule has a `minimumReleaseAge`, unless the rule has a reason for no age.
  The devcontainer-base rule sets `minimumReleaseAge` to `null` and gives its reason.
- Check that the default for a registry without release timestamps is `automerge` set to `false`.
  Keep the named exception for `ghcr.io/marinatedconcrete/devcontainer-base`. A later rule enables auto-merge for it.
- Check that a rule for a package does not depend on rule order by accident. Renovate applies later rules over earlier rules.
  Check that a rule near the end of `packageRules` does not hide an earlier rule.
- Check that `allowedVersions` constraints have a `description` that gives the reason.

### Commit type and scope

Commit and pull request title rules are in [AGENTS.md](../../AGENTS.md).
These points are specific to Renovate.

- Check the `semanticCommitType` and `semanticCommitScope` values.
- Major updates use `feat(package)!`. Minor updates use `feat(package)`. Updates to test files use `test`, so that no release is made.
  Renovate has no separate setting for the `!` marker. The major update rule in `renovate.json` adds it to the `semanticCommitType` string.
- A repository change to Renovate behavior uses the `renovate` scope.
  Use `feat` or `fix` when the change must make a release of `renovate-config`.
  The types `docs`, `build`, and `chore` also make a release when they change a file in a package path.
  The types `test` and `ci` do not make a release.
- A change that removes or renames a preset file, or removes behavior that a consumer uses, is a breaking change.
  See [the pull request template](../../.github/pull_request_template.md) for how to mark it.

### Documentation and prose

- Check that the prose follows [AGENTS.md](../../AGENTS.md). This applies to the `description` fields and to the `README.md` file.
- Check that a `README.md` example uses the `{version}` placeholder, not a fixed version tag. A fixed tag becomes old after each release.

### Evidence in the pull request

- A change in update behavior needs more proof than the validator gives. See Manual QA.
  Pull request #1014 is a good example. It showed a dry run and the resulting titles.

## Automated validation coverage

| What is validated                            | How to run                               | What it proves                                                                                                                                                                                                                                                                                    | What it does not prove                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renovate configuration                       | `just renovate-lint`                     | Each file in `renovate/*.json` and `renovate.json` passes `renovate-config-validator`. It finds unknown options, wrong value types, and bad regular expression managers.                                                                                                                          | That a rule matches a real dependency. That a custom manager finds a real version. That a release tag after `#` in `extends` exists.                       |
| Custom managers and `extends` names          | `just renovate-lint`                     | `node scripts/renovate-checks.mjs` runs after the validator. Each regex custom manager matches a tracked file and one of its `matchStrings` entries matches in a file. Each `extends` entry for this repository names an existing file in `renovate/`. An explicit extension must match the file. | That a manager reads the right file or finds the right version. A manager in `CONSUMER_ONLY_MANAGERS` is skipped. Other repositories and built-in presets. |
| Format of JSON and Markdown files            | `just check-format`                      | Prettier accepts the format.                                                                                                                                                                                                                                                                      | ASD-STE100 compliance. No check covers the wording.                                                                                                        |
| Release validation of the `renovate` package | `just release-please-validate renovate`  | The package passes `just renovate-lint` before the tag and the release are made.                                                                                                                                                                                                                  | Any behavior. The check repeats the validator. It runs after merge, not on a pull request.                                                                 |
| Renovate on this repository                  | Manual. The hosted Renovate app runs it. | Renovate reads the root `renovate.json` and the released presets and makes pull requests.                                                                                                                                                                                                         | A problem before merge. Renovate shows a problem only when it opens or fails to open a pull request. A configuration error can be silent.                  |
| Behavior of rules and managers               | Manual. See Manual QA.                   | Nothing is automated.                                                                                                                                                                                                                                                                             | What Renovate does with a rule. That a custom manager matches a real file. The commit titles.                                                              |

## Manual QA

A person must check the behavior of the configuration, because no job does.

1. Run the validator on all files. Run `just renovate-lint`.
   The host needs `just` and `pnpm`. Run `pnpm install --frozen-lockfile` first.
   Each file must print `Config validated successfully`.
   If `pnpm` is not on the host, use `npx pnpm install --frozen-lockfile` and the devcontainer.
2. Break the file on purpose, to confirm that the check is live.
   For example, set `automerge` to the string `"yes"` in a copy of the file.
   Run `pnpm exec renovate-config-validator <file>`. The command must exit with status 1.
   Change an `extends` preset name to `doesnotexist`, or change a `managerFilePatterns` entry to match no file.
   Run `node scripts/renovate-checks.mjs`. The command must exit with status 1 and name the entry.
3. For a rule or a manager change, run a real Renovate dry run against a fork or a branch.
   Use `--platform=github --dry-run=full` and compare the branches and titles before and after the change.
   Never omit `--dry-run=full`. Without it, Renovate creates real branches and pull requests.
4. For a custom manager, check that its regular expression matches the target file.
   Search the file for the `# renovate:` comment form that the expression needs.
   Check the dry run output for the dependency the manager must find.
5. For a preset change, check the consumer view. Read `renovate/README.md` and confirm that the usage text is still true.
   Confirm that the preset file name and the `extends` string in the README are the same.
6. For a release, check that the release pull request for `renovate-config` has the expected version.
   After the release, check that the Renovate pull request that updates the tag in `renovate.json` passes the checks.
7. For a commit type change, read the new title that Renovate makes and compare it with the rules in [AGENTS.md](../../AGENTS.md).
   Renovate can pick the wrong type when one branch has a major update and a minor update.
   The `!` marker can be lost in that case.

## Known gaps

- No test checks what a rule or a custom manager does. A mistake in a regular expression passes the validator and has no effect.
  An issue can add a Renovate dry run or a fixture test.
- No check tests that the tags in `renovate.json` exist as releases.
- The check for custom managers reads the tracked files with a JavaScript regular expression. Renovate uses RE2, so a rare syntax difference is possible.
  The check accepts a manager that matches one file by accident. It does not show that the manager finds the right dependency.
- A major and a minor update in one branch can lose the `!` marker in the commit title. See Manual QA.
