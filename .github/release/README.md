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

Recovery runs validation again.
If a draft already contains an image digest, publication uses that previously validated digest.
Keep candidate images available until publication succeeds.
If the saved digest is unavailable, publication stops.

Existing Git tags must identify the selected commit.
Existing version image tags must identify the saved digest.
Existing release assets must match the validated bytes.
A difference stops publication; the workflow does not replace the existing artifact.
An incomplete `starter` asset can be removed from a draft before another upload.

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

Candidate images can remain after failed runs.
Delete unused candidate tags through a separate registry cleanup process.
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
