# Marinated Concrete Fedora Devcontainer Base Image

Use this Fedora base image to build devcontainers for specified tasks.
The image supplies a small devcontainer environment for VS Code.

## Versions

The image uses CalVer versions in the format `YYYY.M.N`.
`YYYY` is the year and `M` is the month, with no leading zero.
`N` starts at `0` each month and increases with each release.
A failed release run can skip a value of `N`.
For example, the first release in November 2026 is `2026.11.0`.

Each release has these image tags:

- `latest`
- The version, for example `2026.11.0`

Each release also has a Git tag and a GitHub release.
Both use the name `devcontainer-base-YYYY.M.N`.

## Use in Another Repository

Use a version tag with a digest in the `FROM` line:

```Dockerfile
FROM ghcr.io/marinatedconcrete/devcontainer-base:2026.11.0@sha256:...
```

Renovate then sends an update for each new release.
Renovate does not change the `latest` tag to a version tag.
With `latest`, Renovate sends only digest updates.

Add the `renovate/marinatedconcrete` preset to your Renovate configuration.
With this preset, the Renovate pull request shows the release notes of the image.
See [`renovate/README.md`](../../renovate/README.md).

## Releases

The build workflow publishes a release each Thursday at 12:00 UTC.
The workflow publishes only from the `main` branch.
A pull request or a push to `main` builds and validates the image.
These events do not publish an image.

To publish a release at another time, run the workflow manually:

```sh
gh workflow run image-devcontainer-base.yml --repo marinatedconcrete/config --ref main
```

The workflow tests the image before it publishes the image.
The workflow pushes the tested image with no rebuild.

Each release contains the release notes and a CycloneDX SBOM of the image.
The release notes list the components and the requested packages.
The release notes also list the changes in the packages since the previous release.
