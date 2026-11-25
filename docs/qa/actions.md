# QA for GitHub Actions

This page tells a reviewer what a good change to `actions/` looks like.
It also lists the checks that run automatically and the checks that do not.
A reviewer can be a person or an agent.

## Scope

The `actions/` directory holds the composite GitHub Actions that this repository publishes.
The directory has one action: `actions/image-release-notes`.

- `actions/image-release-notes/action.yml` generates the release notes and the SBOM for a container image.
- `actions/image-release-notes/publish/action.yml` adds the notes to a release and attaches the SBOM.
- `actions/image-release-notes/release-notes.sh`, `actions/image-release-notes/previous-sbom.sh`, and `actions/image-release-notes/publish/publish.sh` do the work.
- `actions/image-release-notes/image-references.mjs` reads a Containerfile.
  `actions/image-release-notes/image-references.test.mjs` tests it.
- `actions/image-release-notes/README.md` documents the inputs, the outputs, and the behavior.

Other repositories can use the action by tag.
This repository uses it as `./actions/image-release-notes` in `.github/workflows/image-kairos-fedora.yml`, `.github/workflows/image-github-runner-ci.yml`, and `.github/workflows/image-devcontainer-base.yml`.
Only `.github/workflows/image-devcontainer-base.yml` uses the `publish` action.
The `release-please-config.json` file releases the action as the package `image-release-notes`.
The tag format is `image-release-notes-X.Y.Z`.

The images that call the action and the Kustomize components are out of scope for this page.

## Review checklist

Apply each item to the diff.

### Language and format

- Prose follows ASD-STE100, as `AGENTS.md` requires.
  This applies to `README.md`, to comments in scripts and in `action.yml`, and to input descriptions.
- A change to an input or an output updates `action.yml` and the `Inputs` or `Outputs` table in `README.md` in the same commit.
  The description text must be the same in both files.
- The `just format` command changes nothing.
  Prettier formats every `.md`, `.yml`, `.yaml`, `.json`, and `.mjs` file in the repository.
- Past entries in `CHANGELOG.md` stay unchanged.
  Release Please writes this file.

### Security posture

- The `Image Release Notes` action in `actions/image-release-notes/action.yml` needs only `contents: read`.
  The three image workflows call it from jobs that have `contents: read`.
  A change must not add a permission requirement for this action.
- The `publish` action must run no code from the image.
  The comment in `publish/action.yml` states this rule.
  `publish.sh` must only read the two output files and call the GitHub API.
- Do not add a step that runs the image, or a script from the image, in a job that has write access.
- A workflow expression, such as `${{ inputs.component }}`, must not appear inside a `run:` script.
  Pass the value through `env:`, as the current steps do.
- Each external action in `action.yml` uses a full commit SHA with a version comment.
  The `actions/upload-artifact` step is an example. GitHub publishes this action.
- Tool images in `release-notes.sh` use a tag and a `sha256` digest.
  The `SYFT_IMAGE` and `CYCLONEDX_IMAGE` variables are examples.
  Each variable has a `# renovate: datasource=docker depName=...` comment on the line above it.

### Behavior

- The scripts keep `set -euo pipefail`.
  They report an error with a message and a nonzero exit.
- A failed run must not leave a stale file that a later step reads as new.
  Pull request #893 found this defect in `previous-sbom.sh`.
- The selection of the previous release compares versions as numbers.
  It must not compare dates or strings.
  It skips drafts and tags that are not `X.Y.Z`.
  It selects the highest version below `current-tag` when the caller supplies a tag.
  A reviewer asked for this in pull request #893.
- Name parsing in `release-notes.sh` must handle a registry with a port and a reference with a digest.
  A reviewer found a defect in this area in pull request #893.
- A new Containerfile rule has a test in `image-references.test.mjs`.
  Existing tests show the style: one `test(...)` for each rule, with a name that states the behavior.
- A new behavior of the scripts is in `README.md`.
  Section `Notes Contents` lists each section of the notes.

### Versioning and commit type

- The commit follows Conventional Commits.
  Recent history uses `feat(image-release-notes): ...` for a new input, and `fix: ...` for a defect.
- A breaking change to an input, an output, or a default uses `!`.
- A change in `actions/image-release-notes/` makes a release for the package.
  Do not edit `.release-please-manifest.json` or `CHANGELOG.md` by hand.
  Release Please opens the release PR.
- A change that affects only tests uses the `test` type, so that no release happens.
  Renovate does this for files that match `**/*.test.*`.
- Renovate sends tool image updates as `chore(package): update <image> docker tag to <version>`.
  The `renovate.json` file gives minor updates the `feat` type.
  Check that the type matches the effect on callers.
- The PR title is a Conventional Commit title.

### Renovate behavior

- A change to the script paths or to the `# renovate:` comment format must still match the regex manager for `^actions/.*\.sh$` in `renovate.json`.
  Otherwise Renovate stops sending updates for the tool images.
- `anchore/syft` and `cyclonedx/cyclonedx-cli` are Docker Hub images.
  The rule that automerges patch updates after three days applies to them.
  Read a minor update before you merge it, because it can change the SBOM.
- The `package.json` file keeps `dockerfile-ast` at an exact version.
  The `release-please-validate` recipe installs it with `npm ci --ignore-scripts`.

## Automated validation coverage

The required checks come from `gh api repos/marinatedconcrete/config/branches/main/protection`.
They are `lint`, `check-format`, `build`, and six `kustomization-test (...)` jobs.
The rule also requires one approving review and a linear history.
An administrator can bypass the review rule, because `enforce_admins` is false.

| Check                       | What it proves                                                                                                                                   | Where it runs                                                                                                                                                                                                                   | Required in branch protection | Gap                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Image reference tests       | The 42 tests in `image-references.test.mjs` pass. They prove how the action reads a Containerfile: stages, `ARG` values, `--from`, and `target`. | `npm test --prefix actions/image-release-notes`. CI job `image-release-notes-test` in `.github/workflows/ci.yml`.                                                                                                               | no                            | A failing test does not block a merge.                                                              |
| ShellCheck                  | The three scripts of the action have no ShellCheck findings.                                                                                     | `just shellcheck-lint`. CI job `lint` runs `just lint`.                                                                                                                                                                         | yes                           | ShellCheck does not find logic errors.                                                              |
| Format check                | Prettier accepts the `.mjs`, `.yml`, `.json`, and `.md` files.                                                                                   | `just check-format`. CI job `check-format`.                                                                                                                                                                                     | yes                           | This does not check ASD-STE100 wording.                                                             |
| Release validation          | The commit that Release Please selects passes ShellCheck and the unit tests before the release.                                                  | `just release-please-validate actions/image-release-notes`. CI job `source` in `.github/workflows/release-package.yml`.                                                                                                         | no                            | This runs after the merge, so it cannot block a merge.                                              |
| PR title check              | The PR title is a Conventional Commit title.                                                                                                     | CI check `Validate PR title` in `.github/workflows/semantic-commits.yml`.                                                                                                                                                       | no                            | A failing title does not block a merge.                                                             |
| Renovate config check       | `renovate.json` is valid.                                                                                                                        | `just renovate-lint`. CI job `lint`.                                                                                                                                                                                            | yes                           | The check does not prove that the regex manager finds the `SYFT_IMAGE` and `CYCLONEDX_IMAGE` lines. |
| Image build with the action | The action runs end to end on a real image: Syft, the notes, and the artifact upload.                                                            | CI jobs `build-container` in `image-kairos-fedora.yml`, `build-github-runner-ci` in `image-github-runner-ci.yml`, and `build` in `image-devcontainer-base.yml`. They run on a PR that changes `actions/image-release-notes/**`. | no                            | The jobs do not assert the contents of the notes. They run only when the path filter matches.       |

The required `build` check is the job `build` in `.github/workflows/ci.yml`.
It builds the devcontainer and does not run the action.

Behavior that no job covers:

- `release-notes.sh`, `previous-sbom.sh`, and `publish/publish.sh` have no tests.
  This includes the choice of the previous release, the change table, and the edit of the release body.
- Neither `action.yml` nor `publish/action.yml` has a test.
- No test runs the `publish` action against a draft release.
- No job checks that the tables in `README.md` agree with `action.yml`.

## Manual QA

Do these checks when automation cannot decide.

1. Run the unit tests.

   ```sh
   npm ci --prefix actions/image-release-notes --ignore-scripts
   npm test --prefix actions/image-release-notes
   ```

2. Run ShellCheck on the scripts.

   ```sh
   just shellcheck-lint
   ```

3. Generate the notes for a small image.
   This needs a Docker daemon.
   It pulls the pinned Syft image.

   ```sh
   just release-notes qa-smoke alpine:latest
   ```

   Read `build/release/qa-smoke-notes.md`.
   It must have the `Image Components` table.
   Delete `build/release` after the check.

4. If you change the Containerfile handling, run a real Containerfile.

   ```sh
   just release-notes-devcontainer-base <image>
   ```

   The table must show the base image row first.
   It must show one row for each `COPY --from` image.

5. If you change the change table, supply the SBOM of an earlier release as the `previous` argument of `just release-notes`.
   Check one added package, one removed package, and one changed package.
6. If you change `previous-sbom.sh` or `publish/publish.sh`, test with a repository that has draft and published releases.
   Use a scratch repository or a fork, and set `GH_REPO` to it.
   Never run the script against `marinatedconcrete/config`.
   The script runs `gh release upload --clobber` and `gh release edit` on the repository that `gh` selects.
   Run the script again with the same tag.
   The release body must hold one notes section and one SBOM asset.
7. If you change `action.yml`, open a PR that matches a path filter of an image workflow.
   Read the job summary and the uploaded artifact in that run.

## Known gaps

- Add `image-release-notes-test` to the required checks in branch protection.
- Add tests for `previous-sbom.sh`: version order, drafts, a rerun of an old tag, and a failed download.
  Pull request #893 found defects in these cases by review.
- Add tests for `release-notes.sh` with a fixed SBOM: the component table, the change table, and an image with no `dnf`.
- Add a test for `publish/publish.sh` that runs it twice with the same tag.
- Add a check that the regex manager in `renovate.json` finds the tool image lines in `release-notes.sh`.
- Add a check that the tables in `README.md` match `action.yml`.
- Make the image workflows assert the notes, not only create them.
- Renovate automerges patch updates of external GitHub Actions through the global patch rule, and the image workflows hold write tokens.
  Review these updates after they merge.
