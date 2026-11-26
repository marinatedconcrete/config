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

- Do not suggest an edit to a `CHANGELOG.md` file, to `.release-please-manifest.json`, or to a version file such as `ansible/galaxy.yml` or `version.txt`.
- Release Please makes the branch again from `main` each time it updates the pull request. The update removes a manual change.
- Do not ask the release bot to change the pull request. Ask a named maintainer to act.
- Recommend a manual rebase only if the maintainer needs the exact version tag. Keep only the lines that the release pull request owns.
- If the pull request is older than `main`, read the log of the last Release Please run on `main`. Check whether Release Please still plans the release. Recommend `close` only if the log confirms that it no longer plans the release. If you cannot read the log, write "not checked".

## Fix the wording of a release note

The release note text comes from the commit message of the merged source pull request. To fix the text, change the source pull request. Do not change the release pull request.

1. Find the merged pull request that made the commit. The changelog line links to it if a pull request exists. If the line has no link, an override cannot fix it. In that case, ask a named maintainer to decide.
2. Ask a named maintainer to add this block to the body of that merged pull request. Use one block only, because Release Please reads only the first block.

```text
BEGIN_COMMIT_OVERRIDE
fix(renovate): the corrected message

feat: a second message for the same commit
END_COMMIT_OVERRIDE
```

3. Release Please reads the block at its next run. A run starts on a push to `main`. A maintainer can also start the Release Please workflow by hand with an empty `release_pr` input. Editing a pull request body does not start a run. The block replaces the commit message.

Follow these rules for the block:

- Write each message as a Conventional Commit message. Start each message with a standard type such as `feat` or `fix`. Do not add `!` to the type of a message after the first message, because Release Please does not split that message off.
- Put a blank line between messages.
- The Release Please README says that the override does not work with plain merges. This repository allows only squash merges.
- Do not edit the body yourself. Ask the maintainer.

The "How can I fix release notes?" section of the Release Please README at <https://github.com/googleapis/release-please> describes this feature.

## Keep the version and tag check

Do this check on each release pull request. Do not skip it.

1. Read the package path and the package name in `release-please-config.json`. The title names the package name.
2. Compare the version in the title with the new version in `.release-please-manifest.json` for that path. They must match.
3. Compute the expected tag with the settings of the package. A setting of the package replaces the top-level setting.
   - The tag is the package name, then `tag-separator`, then the version. `include-v-in-tag` adds a `v` before the version.
   - The packages in `images/`, `actions/image-release-notes`, and `renovate` set `include-v-in-tag` to `false` and `tag-separator` to `-`. The tag of `renovate-config` 2.10.0 is `renovate-config-2.10.0`.
   - A package with no setting uses the top-level values, which are `@` and a `v`. The tag of `kustomize-paperless` 2.2.1 is `kustomize-paperless@v2.2.1`.
4. Check that no tag with that name exists. The publisher stops when the tag exists and points to a different commit.

Write the expected tag in your review. If the version, the package, or the tag does not match, ask a named maintainer to decide. Do not edit the files yourself.

## Other checks

- Check that the release has a real change. A section that lists only an entry of the form `**main:** release <package> <version>` has no real change. Check the log of the last Release Please run. Recommend `close` only if the log confirms that Release Please no longer plans the release.
- Check `mergeable`, `mergeStateStatus`, and the checks on the head commit.
- Do not merge the pull request. Recommend an action only.
- Ask one named person for a decision. Ask one question that has two answers, and put your recommendation first.
