---
name: release-please-pr
version: 1.0.0
description: Review a Release Please pull request in marinatedconcrete/config. Do not edit generated files. Fix a release note with a commit override in the merged source pull request.
tags: [release, review]
---

Use this skill when you review a pull request that Release Please opened.

## Recognize a release pull request

A release pull request has all of these properties:

- The head branch matches `release-please--branches--*`. An example is `release-please--branches--main--components--renovate-config`.
- While the pull request is open, the label is `autorelease: pending`. After publication, the label is `autorelease: tagged`.
- The title has the form `chore(main): release <package> <version>`. An example is `chore(main): release renovate-config 2.10.0`.

The GitHub App `formwork-remover` opens these pull requests. Release Please writes `.release-please-manifest.json` and the `CHANGELOG.md` of the package on the branch. For `ansible-collection`, it also writes `ansible/galaxy.yml`. For `kustomize-pod-security`, it also writes `version.txt`.

## Do not edit generated files

- Do not suggest an edit to a generated file. Generated files are `CHANGELOG.md`, `.release-please-manifest.json`, and a version file such as `ansible/galaxy.yml` or `version.txt`.
- Release Please makes the branch again from `main` when the release notes change. Then it removes a manual change. Until then, a manual change stays and can merge.
- Do not ask the release bot to change the pull request. Ask a named maintainer to act.
- A release pull request is often behind `main`. This is not a reason to close it or to rebase it.
- Recommend a manual rebase only if the maintainer needs the exact version tag. Keep only the lines that the release pull request owns.

## Decide whether to recommend close

Recommend `close` only after you read the log. Do these steps.

1. Find the package path in `release-please-config.json`. The log names a package by its path.
2. Find the newest run of the Release Please workflow for the current commit of `main` in which the `Update Release PRs` step passed. A run can pass and skip this step. A run for an older commit can give an old answer. If there is no such run, write "not checked" and stop this check.
3. Read the log of that step for the path.
   - `No commits for path: <path>, skipping` or `No user facing commits found ... skipping` means that Release Please no longer plans the release. Recommend `close`.
   - `PR <url> remained the same`, or a line for an updated pull request, means that Release Please still plans the release. Do not recommend `close`. Ask a named maintainer to decide.
4. If the log has no line for the path, write "not checked".

A section that lists only an entry of the form `**main:** release <package> <version>` has no real change. Release Please can still plan this release. Use the log check above.

## Fix the wording of a release note

The release note text comes from the commit message of the merged source pull request. To fix the text, change the source pull request. Do not change the release pull request.

1. Find the merged pull request that made the commit. Use the link in the changelog entry if it exists. If there is no link, find the commit. Then check for an associated pull request. If the commit has no associated pull request, an override cannot fix the note. In that case, ask a named maintainer to decide.
2. Ask a named maintainer to add this block to the body of that merged pull request. Do not edit the body yourself. Put the marker words in the body once only.

```text
BEGIN_COMMIT_OVERRIDE
feat(renovate): the corrected message (#1148)
END_COMMIT_OVERRIDE
```

3. Release Please reads the block at its next run. Editing a pull request body does not start a run. A push to `main` starts a run. A maintainer can also start the workflow on `main` with `workflow_dispatch` and an empty `release_pr` input. Do not rerun an old run, because it keeps the old commit. A run with `release_pr` set never updates the release pull requests.
4. A run can publish other pending merged release pull requests. It skips the update of the open release pull requests in these cases:
   - The plan rejects a candidate, or a validation or a publication fails. One failed package blocks the update for all packages.
   - `main` has a newer commit when the update job starts. The step shows as skipped, and the run for the newer commit does the update.
5. After the run, check that the open release pull request shows the corrected note. If it does not, read the run summary and the log. Then tell the maintainer.

Follow these rules for the block. The runs of Release Please 17.11.2 gave the rules except the last two. The `Update Release PRs` step runs version 17.6.0. The override code is the same in both versions.

- Write the markers in upper case, as in the example. Always write the `END_COMMIT_OVERRIDE` line. Without it, all later text of the body becomes part of the message.
- Release Please starts at the first `BEGIN_COMMIT_OVERRIDE` text, even when the text is part of a sentence. An empty first block makes it use the original message. To undo an override, delete the block.
- Write the message in Conventional Commit form. If it is not in this form, Release Please drops the commit, and the changelog and the version ignore it.
- Use the original type and the original breaking-change status of the commit. Release Please uses the type to select the version, so another type changes the release version.
- The block replaces the whole commit message. If the original message has a footer such as `Release-As:` or `BREAKING CHANGE:`, copy the footer into the block. Without the footer, the release version changes. A dropped `BREAKING CHANGE:` footer also removes its text from the changelog.
- Put the `(#N)` number of the pull request at the end of the first line. The link of the changelog entry comes from this text. Without it, the entry has only the commit link.
- Do not add a second message. A line that starts with a type, such as `feat:`, becomes its own changelog entry and can change the release version.
- The Release Please README says that the override does not work with plain merges. This repository allows only squash merges.

The "How can I fix release notes?" section of the Release Please README at <https://github.com/googleapis/release-please> describes this feature.

## Keep the version and tag check

1. Read the package path and the package name in `release-please-config.json`. The title names the package name.
2. Compare the version in the title with the new version in `.release-please-manifest.json` for that path. They must match.
3. Compute the expected tag with the settings of the package. A setting of the package replaces the top-level setting.
   - The tag is the package name, then `tag-separator`, then the version. `include-v-in-tag` adds a `v` before the version.
   - The packages in `images/`, `actions/image-release-notes`, and `renovate` set `include-v-in-tag` to `false` and `tag-separator` to `-`. The tag of `renovate-config` 2.10.0 is `renovate-config-2.10.0`.
   - A package with no setting uses the top-level values, which are `@` and a `v`. The tag of `kustomize-paperless` 2.2.1 is `kustomize-paperless@v2.2.1`.
4. Check that no tag with that name exists before the merge. If one exists, ask a named maintainer to decide.

Write the expected tag in your review. If the version, the package, or the tag does not match, ask a named maintainer to decide.

## Other checks

- Check `mergeable`, `mergeStateStatus`, and the checks on the head commit.
- Do not merge the pull request. Recommend an action only.
- Ask one named person for a decision. Ask one question that has two answers. Put your recommendation first.
