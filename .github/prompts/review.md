# Review a pull request

Use this prompt to review a pull request in `marinatedconcrete/config`.
Automated reviewers and human reviewers can use it.
Read the pull request diff before you apply the checklist.
Read `AGENTS.md` for the repository rules.

## Output

Write a review that a maintainer can act on.
Start with one verdict: `approve`, `request changes`, `wait`, or `ask the maintainer`.
Give a reason for each finding.
Give the file and line for each finding.
Separate blocking findings from optional suggestions.
Write the commands you ran and the results you saw for each external fact.
Do not state a fact that you did not check.
Write "not checked" for an item that you could not check.

## General checklist

### Pull request title and commits

- The title must follow [Conventional Commits](https://www.conventionalcommits.org/).
  The `Validate PR title` check enforces this rule.
- The type must match the effect of the change.
  Release Please uses the type to select the release version.
- A breaking change must use `!` before the colon.
  See "Breaking changes" below for the definition.
- Read the pull request body.
  See "Pull request body" below.
- A change to a package must use a type that causes the correct release.
  A `feat` change in `images/kairos-fedora` causes a minor release of the image.
- Renovate uses the `test` type for `e2e.sh`, `tests/`, and `*.test.*` files.
  A change with this type does not cause a release.
  Do not accept a `test` type for a file that changes a released artifact.
- Commits must not change files outside the stated scope.
- Do not ask the author to squash or amend a commit that already has review comments.
  Ask for a new commit instead.

### Pull request body

The repository allows only squash merge.
The squash commit message is the pull request title and the pull request body.
GitHub copies the whole body into the commit, and this includes HTML comments.
Release Please reads that commit message.
Read the real body, not only the diff.

```sh
gh pr view <number> --json title,body --jq '.title, .body'
gh pr view <number> --json body --jq '.body' | grep -n '<!--'
gh pr view <number> --json body --jq '.body' | grep -niE 'breaking[ -]change'
```

The second command lists each line that starts an HTML comment.
The third command lists each line that has a breaking change token.
Write "not checked" if `gh` fails.

Flag each of these items:

- A leftover HTML comment from `.github/pull_request_template.md`.
  The comment becomes noise in the commit.
  Ask the author to delete it.
- A placeholder that the author did not edit.
  Examples are an empty `## Summary`, a `## Testing` list with no marked item, and example text from the template.
- A title that is not a valid Conventional Commit.
  The `Validate PR title` job in `.github/workflows/semantic-commits.yml` runs `amannn/action-semantic-pull-request`.
  The job passes no `types` or `scopes` input.
  The action therefore accepts its default types and any scope.
  The repository uses the name of the component as the scope, for example `paperless` or `kube-vip`.
  Renovate uses the scope `package`.
  The job cannot check that the type fits the change.
  Check the type yourself.
- A breaking change footer in the wrong form.
  The footer is a line that starts with `BREAKING CHANGE:` or `BREAKING-CHANGE:`.
  The footer must be the last paragraph of the body.
  A blank line must be before the footer.
  A `## Breaking changes` heading is not a footer, because Release Please ignores it.
  A footer token in an HTML comment is a defect.
  Release Please can read it and mark the pull request as breaking.
  Release Please reads the dash form `BREAKING-CHANGE` even in the middle of a line.
  Report each such token.
- Extra text that can change how Release Please reads the commit.
  Text after the footer becomes part of the footer.
  A `BEGIN_COMMIT_OVERRIDE` block replaces the commit message, as in #988.
  A `Release-As:` footer sets the release version.
  Accept these only if the maintainer wants the effect.
  Ask the author to state the reason.

The template tells the author to delete the breaking change comment when the change is not breaking.
A body with no footer is correct for a change that is not breaking.

Automation pull requests are exempt from the template checks.
Renovate and Release Please write their own bodies.
Do not ask them to follow the template.
Still check the title and the breaking change annotation.

### Breaking changes

A change is breaking when a consumer must edit their own files, cluster, hosts, or workflows after they move to the new version.
A change is also breaking when the consumer sees a new behavior with no edit of their own.
Ask this question: "Can a consumer who changes only the version pin see a failure or a new behavior?"
If the answer is yes, the change is breaking.
Judge the effect on the consumer, not the size of the diff.

Each part has its own version, tag, and consumers:

| Part                                               | How a consumer pins it                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Kustomize component in `kustomization/components/` | `?ref=kustomize-<name>@v<version>` or the release asset of that tag                        |
| Image in `images/`                                 | The image tag, for example `kairos-fedora:1.1.1` for the Git tag `kairos-fedora-1.1.1`     |
| Action in `actions/`                               | `uses: marinatedconcrete/config/actions/image-release-notes@image-release-notes-<version>` |
| Ansible collection in `ansible/`                   | The Git tag of the collection                                                              |
| Renovate presets in `renovate/`                    | `github>marinatedconcrete/config//renovate/<file>#renovate-config-<version>`               |

`release-please-config.json` lists the released parts.
A change outside these paths does not cause a release.
A `!` on such a change has no release effect.

#### What is breaking, by part

Kustomize components:

- A resource that a consumer can patch or select is renamed, removed, or replaced.
  Examples are the Deployment that became a container in a StatefulSet and the renamed PVC in #1035.
  Another example is the split of the kube-vip DaemonSets in #376.
- A port, port name, Service name, label, selector, or namespace changes.
  Consumers use these in scrape rules, firewall rules, NetworkPolicy objects, and patches.
  Examples are #958 (metrics port) and #1035 (port name).
- The component needs something new from the consumer or the cluster.
  Examples are a new required component (#285), a new secret key (#1035), and node support for user namespaces (#1027, #1033, #1035).
- The component path or the package changes, as in #904.
- A component is removed.
- A major version of a pinned workload image changes, such as kube-vip v1 (#453) and Paperless v3 (#839).
  Read the upstream release notes to decide.

Not breaking for a Kustomize component:

- A patch or minor update of an image that needs no change in the consumer files.
  Renovate merges these updates for the Factorio, kube-vip, Mosquitto, and UniFi components without a person.
- A new optional resource or setting that does not change an existing selector, port, or name.
- A change to a README, a test, or a comment.
- A refactor that does not change the rendered output.

To check the last item, compare the rendered output before and after the change.
Run `kustomize build kustomization/components/<name>` on the base branch and on the head, then compare the results.

Images:

- The entrypoint, the user, a file path, or the tag scheme changes.
- A package, command, or file that a consumer uses is removed or renamed.
- The default behavior changes.
  Examples are the Kairos v4.4.0 hardening (#927) and the Fedora major version (#988).
- A major version of the base image or of the Kairos tools changes, as the Kairos section below says.

Not breaking for an image: a patch update of a package, a rebuild, or a change to the release notes.

Action (`actions/image-release-notes`):

- An input is removed, renamed, or made required.
- An output is removed or renamed.
- The meaning of an input, the default of an input, or the name of an output file changes.
- The action needs a new permission.

`action.yml` and the README list the inputs and outputs.
Not breaking for the action: a new optional input with a default that keeps the old behavior, as in #1040.
Another example is a new row in the notes, as in #1020.

Ansible collection:

- A role is removed or renamed.
- A role variable is removed, renamed, or has a new default that changes behavior.
  The variables in `ansible/roles/minikube_test/defaults/main.yml` are an example.
- A play is removed, as in the `kustomization_test` play.
- The value of `requires_ansible` in `ansible/meta/runtime.yml` rises.
- A new collection or tool is required.
- A major update of `ansible` in `ansible/requirements.txt` is breaking, as in #1052.

Not breaking for the collection: a new role, a new variable with a default that keeps the old behavior, or a fix to a task.

Renovate presets:

- A preset file is renamed or removed.
  An example is the rename of `default.json` to `marinatedconcrete.json`.
- A preset starts to extend another config or to set a time zone.
- A change makes Renovate open a different set of pull requests for the consumer.
  History does not show how the maintainers treat this case.
  Recommend `!` and let the maintainer decide.

Not breaking for the presets: a rule that affects only this repository, or a fix to a regular expression that keeps the same matches.

#### Renovate major updates

Renovate marks each major update as `feat(package)!`.
The rule `Use a breaking commit type for major updates` in `renovate.json` does this.
The `!` matters only when the update changes a released path.
A major update of a development tool, for example in `.devcontainer/` or `justfile`, causes no release.
Do not block such an update because of the `!`.

For a major update of a released part, read the upstream release notes.
Decide if the consumer must act.
Do not assume that a major update is safe because Renovate wrote it.
In history, #839 (Paperless v3) and #1052 (Ansible v15) have `!` and no footer.
#927 (`kairos-init` v4.4.0) has a footer that lists the effects.
History does not show a rule for this case.
Recommend a footer when the release notes show a consumer action.
Do not demand a footer when they show none.
Renovate writes the body, so ask a maintainer to add the footer or a commit override, as #988 did.

#### Kairos major versions

Apply the Kairos section below in addition.
A major update of `kairos-init` in `images/kairos-fedora/Containerfile` changes the image.
It is breaking for `kairos-fedora` when the release notes show a changed default or a removed feature.
In history, #927 is breaking and has a footer.
A minor or patch update is not breaking, as in the `kairos-fedora` 1.1.0 and 1.1.1 releases.
An `auroraboot` update in `e2e.sh` has the `test` type and causes no release.

#### How to annotate

History shows this practice:

- Each change that the maintainers call breaking has `!` before the colon.
  `git log origin/main -E --grep '^[a-z]+(\([^)]*\))?!:' --format='%h %s'` lists 18 commits.
- The hand-written pull requests #958, #1027, #1033, #1035, and #927 have a footer.
  The footer tells the consumer what to do, and it appears in the release notes.
- Older breaking changes (#285, #376, #904) have `!` and no footer.
  The Renovate majors (#453, #839, #1052) also have `!` and no footer.
  Release Please then writes the title as the breaking entry, for example in `kustomize-kube-vip` 4.0.0.
- The pull request #988 has `!` and no footer.
  It uses a commit override.
- No commit in `origin/main` has a footer and no `!`.

Use these rules:

- Require `!` before the colon for each breaking change.
- Require a footer when a person writes the pull request and the consumer must act.
  The footer has a short migration note.
- Recommend a footer, but do not require it, for a Renovate update.
- Do not require a footer on a change that is not breaking.

What to write in the review:

- The change looks breaking and has no annotation.
  Request changes.
  Name the part, the consumer-visible change, and the file.
  Ask the author to add `!` to the title and a footer to the body.
  A title or body edit makes no new commit.
- The change has `!` or a footer, but it does not look breaking.
  Ask the author to name the action that the consumer must take.
  If there is no such action, ask the author to remove `!`, because `!` makes a major release of the part.
  Make this blocking only when the part has a release.
- The change has a footer and no `!`.
  Request changes and ask for `!`.
- You are not sure that the change is breaking.
  Write "ask the maintainer".
  Give a recommendation and the reason.
  State that history does not show a rule.

### Documentation and comments

- Prose must follow ASD-STE100, as `AGENTS.md` describes.
  This rule applies to Markdown files, release notes, and code comments.
- Check the wording.
  A formatting check does not show ASD-STE100 compliance.
- Past changelog entries must stay unchanged.
- Commands, identifiers, URLs, and version numbers must stay unchanged when the prose changes.
- A comment must explain a reason that the code cannot show.

### Formatting, lint, and tests

- The author must run `just format` before the commit.
- Check that these CI jobs pass: `check-format`, `lint`, `build`, `build-container`, and the `kustomization-test` jobs.
- A change to a component in `kustomization/components/` must have a test in `kustomization/tests/`.
  The author can run `just kustomization-test <component>`.
- A change to `images/kairos-fedora/` starts the image build and the e2e test.
  The e2e test is `images/kairos-fedora/e2e.sh`.
  Check that the e2e job ran and passed.
  Do not accept a skipped e2e job for a change to that image.
- A change to `.github/release/` or `actions/image-release-notes/` must keep its own tests passing.
- Do not accept a change that disables a test to make a check pass.

### Kubernetes manifests and pod security

- A workload must work under the restricted pod security profile.
  See `kustomization/components/pod-security/`.
- Check each container for `runAsNonRoot`, `allowPrivilegeEscalation: false`, dropped capabilities, and a `RuntimeDefault` seccomp profile.
- A workload that needs a baseline or privileged profile needs a stated reason in the pull request.
  The reason must name the namespace and the setting.
- Do not accept a weaker profile only to make a test pass.
- A new component must have a test that uses the pod-security component tests.

### Release and Renovate behavior

- Release Please makes the release pull request for each package.
  Do not change `.release-please-manifest.json` or a `CHANGELOG.md` file by hand.
- Do not move or edit a published tag or release.
- A change to `renovate/` or `renovate.json` must pass `just lint`.
  The `renovate-lint` recipe checks the Renovate configuration.
- A Renovate pull request does not have a human author.
  Review it as you review any other change.
  Renovate groups, delays, and automerges updates only as the `packageRules` in `renovate.json` say.
- Renovate cannot read the release state of an upstream project when the datasource is an image registry.
  See the next section for the Kairos case.

### Automated findings

- Treat a finding from a bot, a scanner, or another agent as a claim to check.
- Verify the claim in the code or with a command.
- Fix a confirmed finding.
- Dismiss a finding that is wrong or a style preference.
  Write the concrete reason in the reply.
- Do not change code only to remove a warning that has no effect.

## Pull requests from automation

Use this section when the author is an automation account and no person is behind the pull request.
Examples are `renovate`, `formwork-remover` (the GitHub App that runs Release Please), and Hive bots.
A review of these pull requests is correct and useful.
The review decides if the change is safe and still wanted.
Do this section in addition to the general checklist.

### What to check

- Check that the change is safe.
  Read the diff and the upstream release notes for the new version.
- Check that the change is still wanted.
  Another pull request can replace it, or the base can be old.
- Check that the pull request can merge.
  Read `mergeable` and `mergeStateStatus` with `gh pr view <number> --json mergeable,mergeStateStatus`.
- Check that all required checks pass on the head commit.
- For a release pull request, check that the release has a real change.
  Read the new section in `CHANGELOG.md`.
  A section that lists only an earlier `chore(main)` release commit is not a real change.

- Check the title and the breaking change annotation, as the general checklist says.
  Do not apply the pull request template checks to the body.

### What not to do

- Do not comment on style in a generated file.
  Release Please writes `CHANGELOG.md`, `version.txt`, and `.release-please-manifest.json`.
  Renovate writes its own branch and title.
- Do not ask the bot to change the code.
  The bot cannot answer.
  Ask a maintainer to act, or change the source of the generated file.

### Who decides

- A named maintainer makes each decision.
  Do not address the bot.
  Do not address only the organization handle, because it is not a person.
- If the change is stale, say what tooling can regenerate it.

### Stale or no-op release pull requests

- Release Please skips a package when it finds no user-facing commits.
  The old release pull request then stays open and does not update.
  It can conflict with `main`.
- A manual rebase of a generated branch is the wrong fix.
  It copies tool output by hand and the tool can replace it.
- Recommend `close`.
  Give the reason: the pull request is stale, or its release has no real change.
  State that Release Please opens a new release pull request when a new release commit exists.
- Recommend a rebase only if the maintainer needs the exact version tag.
  In that case, keep only the lines that the release pull request owns.
- Before you recommend `close`, read the log of the last `Release Please` run on `main`.
  Check if Release Please still plans this release.
  Write "not checked" if you cannot read the log.

### How to ask for a decision

- Name one person.
- Ask one question that has two answers.
- Put your recommendation first, then the reason in one sentence.
- Use this form:

```text
Decision needed: @<maintainer>, close this release PR so Release Please can regenerate it, or keep it for the 1.1.1 tag?
Recommendation: close. The 1.1.1 section lists only the 1.1.0 release commit.
```

The maintainer can answer with `close` or `keep`.

## Upstream Kairos changes (mandatory)

Do this section for every pull request that touches anything from the `kairos-io` organization.
This includes image tags, digests, and versions for `quay.io/kairos/*`.
This also includes links to a `kairos-io` GitHub repository or release.
Do this section in addition to the general checklist.
Do not approve until you have written the result of the release check.

### Why this change is risky

Kairos publishes version 4 releases from the `kairos-io/kairos` repository.
The images `kairos-init` and `auroraboot` now use the same version numbers as that repository.
The `kairos-io/kairos-init` and `kairos-io/auroraboot` repositories are archived.
Its last release is `v0.17.3` for `kairos-init` and `v0.31.0` for `auroraboot`.
The release notes of `kairos-io/kairos` `v4.6.0` say that the Kairos pipeline releases AuroraBoot.
Do not look for a version 4 release in the archived repositories.

A container image tag can exist before the release is ready.
A GitHub release can have the pre-release flag, or can be a draft, when the image tag exists.
Renovate reads only the image registry.
It cannot read the GitHub release.
It does not know if a release is a pre-release.
It does not know if the release is published.
A Renovate pull request can therefore propose a tag that upstream has not released.

Evidence from the repository at the time of writing (2026-11-24):

- `kairos-io/kairos` `v4.5.1` and `v4.6.0` are still pre-releases.
  Their images exist in `quay.io`.
  Renovate can propose these tags, because it reads only the registry.
- `kairos-io/kairos` `v4.7.0` is published and is not a pre-release.
  The release was published at 2026-11-23T06:11:50Z.
  The `kairos-init:v4.7.0` image was pushed at 06:18:38Z, after the release.
  The `auroraboot:v4.7.0` image was pushed at 10:05:08Z, after the release.
- Pull request #1059 (`kairos-init` `v4.7.0`) and #1072 (`auroraboot` `v4.7.0`) use these two images.
  The digests in both pull requests match the digests in `quay.io`.
  For these two pull requests the release is published, so the check passes.
  The problem can still occur for the next update.
  The release API does not show past states.
  This evidence cannot prove that the image never came first.

### Where Kairos artifacts are used

A bump of a Kairos tag affects only these files:

- `images/kairos-fedora/Containerfile` uses `quay.io/kairos/kairos-init`.
  The `FROM` line pins a tag and a digest.
  A change here changes the `kairos-fedora` image.
  A `feat` or `fix` type also causes a `kairos-fedora` release.
- `images/kairos-fedora/e2e.sh` uses `quay.io/kairos/auroraboot` in `AURORABOOT_IMAGE`.
  It builds the installer ISO for the e2e test.
  A change here changes the test only.
- `images/kairos-fedora/release-notes-components.sh` reads `/etc/kairos-release` and the `kairos-agent --version` output.
  A change to the output format of Kairos can break the release notes.
- `.github/workflows/image-kairos-fedora.yml` builds and tests the image.
  It runs `images/kairos-fedora/e2e.sh`.
- `images/kairos-fedora/README.md` and `actions/image-release-notes/README.md` describe this use.

The repository has no other use of Kairos artifacts.
The `ansible/`, `kustomization/`, and `renovate/` directories do not pin a `kairos-io` artifact.
Search again with `grep -rIn 'kairos' --exclude-dir=.git --exclude-dir=node_modules .`.
Report each new file that appears in the result.

### How Renovate handles Kairos today

- The rule for `ghcr.io/**`, `quay.io/**`, `registry.k8s.io/**`, and `lscr.io/**` sets `automerge` to `false`.
  It also sets `minimumReleaseAgeBehaviour` to `timestamp-optional`.
  Renovate never merges a Kairos update by itself.
  A person must merge each Kairos pull request.
- No rule groups `quay.io/kairos/*` packages.
  `kairos-init` and `auroraboot` get separate pull requests.
- The patch rule sets `minimumReleaseAge` to `3 days`.
  The quay rule does not remove it.
  Renovate skips the wait when the registry gives no timestamp, because of `timestamp-optional`.
  Do not assume that a delay protected the pull request.
- No rule in `renovate.json` or `renovate/` sets `stabilityDays`, a pre-release setting, or a datasource for the `kairos-io` GitHub releases.
- The `feat(package)` and `test(package)` titles come from the update type and the file rules.
  A `kairos-init` minor update in `Containerfile` has the type `feat`.
  An `auroraboot` update in `e2e.sh` has the type `test`.
- Renovate cannot know whether the upstream release is a draft, a pre-release, or missing.
  Renovate also cannot know whether the image content is the final content of the release.

### Run this check

Set `TAG` to the new tag from the diff.
Run each command and read the result.
Use `gh` with authentication.
The `jq` and `skopeo` tools must be on the path.

```sh
TAG=v4.7.0

# 1. Read the release state in the upstream repository.
gh api "repos/kairos-io/kairos/releases/tags/$TAG" \
  --jq '"tag=\(.tag_name) prerelease=\(.prerelease) draft=\(.draft) published=\(.published_at)"'

# 2. Read the image tag, digest, and push time for each Kairos image.
for img in kairos-init auroraboot; do
  curl -fsS "https://quay.io/api/v1/repository/kairos/$img/tag/?specificTag=$TAG&onlyActiveTags=true" |
    jq -r --arg i "$img" '.tags[] | "\($i) \(.name) digest=\(.manifest_digest) pushed=\(.last_modified)"'
done

# 3. Check that the registry digest matches the digest in the diff.
skopeo inspect --raw "docker://quay.io/kairos/kairos-init:$TAG" | sha256sum
skopeo inspect --raw "docker://quay.io/kairos/auroraboot:$TAG" | sha256sum
```

Expected result for command 1: `prerelease=false draft=false` and a `published` time.
If the release does not exist or is a draft, `gh api` prints `Not Found (HTTP 404)`.
The tag endpoint does not show a draft release to a user without write access.
Treat a 404 as "not published".

Command 2 prints one line for each image.
Compare each `pushed` time with the `published` time of the release.
Command 3 prints the digest of the manifest.
It must equal the digest after `@sha256:` in the diff.
If the digests differ, request changes.
Someone pushed the tag again, or the pull request is stale.

To list the state of the newest releases, run this command.

```sh
gh api "repos/kairos-io/kairos/releases?per_page=10" \
  --jq '.[] | [.tag_name, .prerelease, .draft, .published_at] | @tsv'
```

### Decision rule

| Result                                                               | Decision           | What to write                                                                                                                |
| -------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Release exists, `prerelease=false`, `draft=false`, and digests match | Proceed            | State the release URL, the published time, and the digests. Continue with the general checklist.                             |
| Release is a pre-release                                             | Wait               | Request no merge. State that the image exists but the release is a pre-release. Check again after the next release.          |
| Release is a draft or does not exist (404)                           | Wait               | State that the image exists without a published release. Name the tag.                                                       |
| The tag is a pre-release and an older, stable tag exists             | Ask the maintainer | Ask whether to take the pre-release or to wait. Do not choose for the maintainer.                                            |
| Digest in the diff differs from the registry                         | Request changes    | Give both digests. Ask for a rebase or a new Renovate run.                                                                   |
| The registry or `gh` is not reachable                                | Ask the maintainer | Write "not checked" and the error. Do not approve.                                                                           |
| The change is a major update, or the version scheme changes          | Ask the maintainer | Read the release notes first. Name each breaking change that affects `Containerfile`, `e2e.sh`, or the release notes script. |

Check each of these items for a Kairos update, after the decision is "proceed":

- Read the release notes of `kairos-io/kairos` for the new tag.
  Look for changes to `kairos-init` arguments, to the `/etc/kairos-release` fields, and to AuroraBoot.
- Check that the e2e job in `image-kairos-fedora.yml` ran and passed on the head commit.
- Check that the `kairos-init` and `auroraboot` versions in the diff match, when both change.
  A mismatch is acceptable only with a stated reason.

Write the result in the review in this form:

```text
Kairos release check for <tag>:
- release: <URL>, prerelease=<value>, draft=<value>, published <time>
- image: <image> digest <digest>, pushed <time>
- digests match the diff: <yes or no>
- decision: <proceed, wait, or ask the maintainer>
```

### Suggested Renovate changes

These changes are suggestions.
Do not make them in a review of another change.
Open a separate pull request after the maintainer agrees.

- Add a `minimumReleaseAge` of several days for `quay.io/kairos/**` to give upstream time to publish.
  The `timestamp-optional` setting may skip this wait when `quay.io` gives no timestamp.
  Test this before you trust it.
- Read the release state with a Renovate custom manager and the `github-releases` datasource for `kairos-io/kairos`.
  This datasource treats a pre-release as unstable.
  The image digest would then need a separate pin, because the datasource does not give a digest.
  This option needs a design and a test.
- Group `kairos-init` and `auroraboot` updates in one pull request so that the versions stay equal.

None of these changes were tested.
