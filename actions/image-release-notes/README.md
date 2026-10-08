# Image Release Notes Action

This composite action writes release notes that show the contents of a container image.

[Syft](https://github.com/anchore/syft) reads the packages from the image and writes a [CycloneDX](https://cyclonedx.org/) SBOM.
The [CycloneDX CLI](https://github.com/CycloneDX/cyclonedx-cli) compares that SBOM with the SBOM of the previous release.
The action runs both tools in pinned container images.

The action writes two files:

- `{component}-notes.md`: The Markdown sections for the release body.
- `{component}-sbom.cdx.json`: The CycloneDX SBOM of the image.

## Notes Contents

The notes contain these sections:

1. The image components.
   This section shows the operating system that Syft reports.
   The section also shows the packages in `highlight-packages`.
   The optional components script adds more rows.
2. The requested packages.
   This section shows the packages that the image build installs by name.
   The list does not include the packages that the package manager installs as dependencies.
   Syft does not record this difference, so the action asks `dnf`.
   The action omits this section when the image has no `dnf` command.
3. The package changes since the previous release.
   The action omits this section for the first release.

The SBOM contains every package type that Syft finds.
The tables show only the type in `package-type`, which is `rpm` by default.
A full SBOM contains thousands of language components.
These components make the change table too long.

## Use in Another Repository

Add this step after the build step.
The image must be in the local Docker daemon.
Replace `{version}` with a version from the [GitHub releases](https://github.com/marinatedconcrete/config/releases?q=%22image-release-notes%22).

```yaml
- uses: marinatedconcrete/config/actions/image-release-notes@image-release-notes-{version}
  with:
    artifact-name: mack-release-notes
    component: mack
    highlight-packages: kernel systemd
    image: ghcr.io/marinatedconcrete/mack:${{ steps.version_tag.outputs.tag }}
    tag: ${{ github.ref_type == 'tag' && github.ref_name || '' }}
```

This action needs `contents: read` permission.

To publish the notes, add a second job.
That job reads the files and writes the release.
That job runs no code from the image.
No code from the image runs with write permission:

```yaml
publish-release-notes:
  needs: build
  if: ${{ github.ref_type == 'tag' }}
  runs-on: ubuntu-24.04
  permissions:
    contents: write
  steps:
    - uses: actions/checkout@<sha> # v7.0.1
    - uses: actions/download-artifact@<sha> # v7.0.0
      with:
        name: mack-release-notes
        path: build/release
    - uses: marinatedconcrete/config/actions/image-release-notes/publish@image-release-notes-{version}
      with:
        component: mack
        tag: ${{ github.ref_name }}
```

See `.github/workflows/image-kairos-fedora.yml` for the complete example.

The publish action needs a release at the tag.
Create the release before the job runs.

## Renovate

Add both of these presets to the `extends` list of your Renovate configuration:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/marinatedconcrete#renovate-config-{version}",
    "github>marinatedconcrete/config//renovate/recommended#renovate-config-{version}"
  ]
}
```

The `recommended` preset pins the reference to a commit.
That preset also writes the version in a comment.
With the `marinatedconcrete` preset, Renovate can read the version from the release tag.
Without the `marinatedconcrete` preset, Renovate cannot read the tag format.
Renovate then sends no update.

## Other Notes

The action finds the previous release in the tags that start with `{component}-`.
Use the same `component` value that the release tags use.

The action writes the two files to `build/release/` in the workspace.
Add that directory to the `.gitignore` file, or set the `directory` input.

## Inputs

| Input                | Required | Default               | Description                                                                                                           |
| -------------------- | -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `artifact-name`      | no       |                       | The name of the workflow artifact. Leave this input empty to skip the upload.                                         |
| `component`          | yes      |                       | The prefix for the output files and for the release tags of this image.                                               |
| `components-script`  | no       |                       | The path to a script that runs in the image and prints more component rows.                                           |
| `directory`          | no       | `build/release`       | The directory for the output files.                                                                                   |
| `highlight-packages` | no       |                       | The packages to show in the component table. Separate the names with spaces.                                          |
| `image`              | yes      |                       | The OCI image reference to examine. The image must be in the local Docker daemon.                                     |
| `package-type`       | no       | `rpm`                 | The package type for the tables. The SBOM keeps all package types.                                                    |
| `tag`                | no       |                       | The tag of this release. The action names this tag in the change table, and does not compare the release with itself. |
| `token`              | no       | `${{ github.token }}` | The token that the action uses to read releases.                                                                      |

## Outputs

| Output         | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| `notes-path`   | The path of the Markdown release notes.                     |
| `previous-tag` | The tag of the release that the change table compares with. |
| `sbom-path`    | The path of the CycloneDX SBOM.                             |

## Publish Inputs

The `publish` action takes these inputs:

| Input       | Required | Default               | Description                                                       |
| ----------- | -------- | --------------------- | ----------------------------------------------------------------- |
| `component` | yes      |                       | The prefix of the output files of the Image Release Notes action. |
| `directory` | no       | `build/release`       | The directory that contains the notes and the SBOM.               |
| `tag`       | yes      |                       | The release tag.                                                  |
| `token`     | no       | `${{ github.token }}` | The token that the action uses to write the release.              |

## Components Script

Supply a components script to add image-specific rows to the component table.
The script runs in the image with `/bin/sh`.
The script prints one line for each row.
Each line contains a label, a tab, and a version.

See `images/kairos-fedora/release-notes-components.sh` for an example.
That script reports the Kairos Agent, kairos-init, and Kubernetes versions.
The script also reports the Kairos variant and model.

## Local Use

Use the `just` recipe:

```sh
just release-notes kairos-fedora kairos-fedora:0.0.0-e2e "kernel systemd" images/kairos-fedora/release-notes-components.sh
```

Supply the SBOM of an earlier release as the last argument to add the package changes.
