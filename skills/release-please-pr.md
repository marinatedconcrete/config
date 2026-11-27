---
name: release-please-pr
version: 1.0.0
description: Review a Release Please pull request in marinatedconcrete/config. Do not edit generated files. Fix a release note with a commit override in the merged source pull request.
tags: [release, review]
---

## Recognize a release pull request

A release pull request has all of these properties:

- The head branch matches `release-please--branches--*`.
- While the pull request is open, the label is `autorelease: pending`. After publication, the label is `autorelease: tagged`.
- The title has the form `chore(main): release <package> <version>`.

The GitHub App `formwork-remover` opens these pull requests. On the branch, Release Please writes `.release-please-manifest.json`, the `CHANGELOG.md` of the package, and any version file.

## Do not edit generated files

- Do not suggest an edit to a generated file. Generated files are `CHANGELOG.md`, `.release-please-manifest.json`, and a version file such as `ansible/galaxy.yml` or `version.txt`.
- Release Please makes the branch again from `main` when the release notes change. Then it removes a manual change. Until then, a manual change stays and can merge.
- Do not ask the release bot to change the pull request. Ask a named maintainer to act.
- A release pull request is often behind `main`. This is not a reason to close it or to rebase it.
- Recommend a manual rebase only if the maintainer needs the exact version tag. Keep only the lines that the release pull request owns.

## Decide whether to recommend close

Recommend `close` only after you read the log.

1. Find the package path in `release-please-config.json`. The log names a package by its path.
2. Find the newest run of the Release Please workflow for the current commit of `main` in which the `Update Release PRs` step passed. A run can pass and skip this step. A run for an older commit can give an old answer. If there is no such run, write "not checked" and stop this check.
3. A body edit of a merged pull request changes the input but not `main`. Run `git log <tag>..origin/main --oneline -- <path>`, with the newest release tag of the package. If there is no tag, omit `<tag>..`. The `(#N)` in each subject names a pull request. Read the `lastEditedAt` of each with GraphQL. Read the `startedAt` of the step with `gh run view <id> --json jobs`. If an edit is later, write "not checked".
4. In the log of that step, the section for the path starts at `Building candidate release pull request for path: <path>`. It ends at the next such line or at `Looking for open release pull requests`.
   - `No commits for path: <path>, skipping` or `No user facing commits found ... skipping` in the section means that Release Please no longer plans the release. Recommend `close`.
   - `PR <url> remained the same` for this pull request, or a line for its update, means that Release Please still plans the release. Do not recommend `close`. Ask a named maintainer to decide.
5. If the log has none of these lines, write "not checked".

A section that lists only `**main:** release <package> <version>` has no real change. Release Please can still plan it. Use the log check above.

## Fix the wording of a release note

The release note text comes from the commit message of the merged source pull request. To fix the text, change the source pull request. Do not change the release pull request.

1. Find the merged pull request that made the commit. Use the link in the changelog entry. If there is no link, find the associated pull request of the commit. If there is none, an override cannot fix the note. Ask a named maintainer to decide.
2. The override changes the note and the version of each package that the commit touches. Check the release pull requests that you received for review. Ask a maintainer for the number of each other release pull request that has the commit. Make sure that the message is correct for each.
3. Ask a named maintainer to add this block to the body of that merged pull request. Do not edit the body yourself. Put the marker words in the body once only.

```text
BEGIN_COMMIT_OVERRIDE
feat(renovate): the corrected message (#1148)
END_COMMIT_OVERRIDE
```

4. Release Please reads the block at its next run. Editing a pull request body does not start a run. A push to `main` starts a run. A maintainer can also start the workflow on `main` with `workflow_dispatch` and an empty `release_pr` input. Do not rerun an old run. It keeps the old commit. A run with `release_pr` set never updates the release pull requests.
5. A run can publish other pending merged release pull requests. It skips the update of the open release pull requests in these cases:
   - The plan rejects a candidate, or a validation or a publication fails. One failed package blocks the update for all packages.
   - `main` has a newer commit when the update job starts. The step shows as skipped, and the run for the newer commit does the update.
6. After the run, check that the open release pull request shows the corrected note. If it does not, read the run summary and the log. Then tell the maintainer.

Follow these rules for the block. The `Update Release PRs` step runs Release Please 17.6.0. Runs of 17.11.2 gave the rules except the last two. Both have the same override code.

- Write the markers in upper case. Always write the `END_COMMIT_OVERRIDE` line. Without it, all later text of the body becomes part of the message.
- Release Please starts at the first `BEGIN_COMMIT_OVERRIDE` text, even when the text is part of a sentence. An empty first block makes it use the original message. To undo an override, delete the block.
- Write the message in Conventional Commit form. If it is not in this form, Release Please drops the commit, and the changelog and the version ignore it.
- Use the original type and the original breaking-change status of the commit. Release Please uses the type to select the version, so another type changes the release version.
- The block replaces the whole commit message. If the original message has a footer such as `Release-As:` or `BREAKING CHANGE:`, copy the footer into the block. Without the footer, the release version changes. A dropped `BREAKING CHANGE:` footer also removes its text from the changelog.
- Put the `(#N)` number of the pull request at the end of the first line. The link of the changelog entry comes from this text. Without it, the entry has only the commit link.
- Do not add a second message. A line that starts with a type, such as `feat:`, becomes its own changelog entry and can change the release version.
- The "How can I fix release notes?" section of the Release Please README at <https://github.com/googleapis/release-please> says that the override does not work with plain merges. This repository allows only squash merges.

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
