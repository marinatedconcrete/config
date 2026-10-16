# Release automation

Release Please selects the package, version, release notes, and merge commit.
The version must match `.release-please-manifest.json` at that commit.
The workflow checks out that commit before each build.

The release sequence is:

1. Select a merged release PR.
2. Build and test its commit.
3. Create its Git tag.
4. Create a draft release with a validation record.
5. Upload the validated artifacts.
6. Verify the artifacts.
7. Publish the release.
8. Update the release PR labels.

The Git tag does not exist before validation succeeds.
The tag can exist before the release artifacts are available.
GitHub and GHCR do not support one transaction for all publication operations.

## Package validation

| Package | Validation | Publication |
| --- | --- | --- |
| Kustomize component | Component tests and Kustomize build | Nonempty YAML manifest |
| Kairos Fedora | Image build and installation/startup tests | Tested image digest in GHCR |
| Buildah Action Runner | Image build and smoke test | Tested image digest in GHCR |
| GitHub Runner CI | Image build, smoke test, and Actions job-container test | Tested image digest in GHCR |
| VSCode SSH Server | Image build and smoke test | Tested image digest in GHCR |
| Ansible and Renovate | Format, lint, and component tests | Git tag and GitHub release |

Patch-only components must pass their tests.
They do not upload an empty manifest.

Image validation can upload a temporary `candidate-` tag to GHCR.
This tag is not a release version.
The publisher assigns the release version to the tested digest without a rebuild.
PR and branch image checks keep their existing publication rules.
Image tag pushes do not start another build.

## Concurrency

The release workflow does not cancel an active run when another push arrives.
GitHub can keep up to 100 pending runs in this concurrency group.
A full queue can reject additional runs.
Each run discovers pending release PRs again.
One failed package does not cancel another package.
The planner records errors separately for each candidate.
Valid candidates continue to validation and publication.
A separate job reports rejected candidates and makes the workflow fail.
Each error identifies the package path and release PR.
A failure during release discovery stops publication and produces a planning error.
The error-reporting job reports setup failures and invalid recovery requests.
Release Please updates release PRs after successful publication.
It also updates PRs when no releases are pending.
Planning or publication failures prevent those updates.
Publication also uses a separate concurrency group for each release tag.

The GitHub App creates tags and publishes releases.
These operations can start other workflows.
The publisher uses the workflow token for GHCR authentication.

## Recovery

Run the Release Please workflow on `main` to process pending releases again.
Specify a merged release PR number to recover one release:

```sh
gh workflow run release-please.yml \
  --repo marinatedconcrete/config \
  --ref main \
  -f release_pr=894
```

Use the PR number even if the release tag does not exist.
Explicit recovery can find PRs outside the automatic 200-PR search window.
The workflow obtains the version from Release Please and checks the original merge commit.
Later commits and releases do not change this source commit.

The validation workflows and publisher use the commit that started the workflow.
The source checkout uses the selected release commit.
Start a new recovery run on `main` to use publication fixes without a new package version.
A rerun of an existing workflow uses its original workflow commit.
Publisher changes must preserve compatibility with existing validation records.
An incompatible record must stop publication before any write.
The image migration check prevents legacy tag builds; it does not select the publisher commit.

Recovery first checks for an existing published release.
It verifies the commit, validation record, asset sizes, asset hashes, and image version digest.
It then completes the PR labels without a rebuild or image publication.
A verification failure stops recovery without a label change.
New releases and drafts run validation again.
If a draft already contains an image digest, publication uses that previously validated digest.
Keep candidate images available until publication succeeds.
If the saved digest is unavailable, publication stops.

Existing Git tags must identify the selected commit.
Existing version image tags must identify the saved digest.
Existing release assets must match the validated bytes.
A difference stops publication; the workflow does not replace the existing artifact.
Incomplete `starter` and `open` assets can be removed from a draft before another upload.
Unknown asset states stop publication without deletion.
A draft still requires rebuilt assets to match its validation record.
If those bytes cannot be reproduced, restore the original validated artifacts before recovery.

The draft body contains a validation record in an HTML comment.
Keep this record unchanged.
Image commits must contain the new release workflow.
Older commits can start legacy tag workflows that replace the version image.
Use a new release PR for those image commits.

Releases from older workflows do not contain this record.
Recovery stops for those releases instead of changing them automatically.

If publication succeeds but a label update fails, recovery completes the label update.
The pending label is removed last.
A tag, draft, or partial upload alone does not indicate successful publication.
Check the workflow result and the published release.

Candidate tags remain after successful and failed runs.
Successful candidate tags remain as aliases of the released digest without a time limit.
An alias does not require another copy of the image layers.
The release workflow does not delete package versions.
The [GitHub Packages API](https://docs.github.com/en/rest/packages/packages) deletes a container version, including all its tags.
Do not delete a version that has a release tag.
Do not delete a digest referenced by a draft validation record.
Keep failed candidates until recovery succeeds or an operator abandons the release.
Before manual cleanup, check all tags and draft validation records for each candidate digest.
Delete only abandoned candidate versions that have no release tags or draft references.
Automatic cleanup requires a separate retention policy and is not part of this workflow.
Dependency changes can produce different bytes when the same commit is rebuilt.
The workflow does not guarantee reproducible builds.

## Validation

Run these commands in the repository devcontainer:

```sh
yarn --immutable
npm ci --prefix .github/release --ignore-scripts
npm test --prefix .github/release
just format
just check-format
just lint
just test
```

The tests use the pinned Release Please parser and simulated GitHub API responses.
They check interruptions, duplicate publication, conflicting artifacts, and image digest recovery.
They do not publish releases or images.
GitHub event delivery and GHCR publication require separate integration checks.
