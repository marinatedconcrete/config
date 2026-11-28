# Marinated Concrete Custom Fedora Kairos Image

[Kairos Factory](https://kairos.io/docs/reference/kairos-factory/) builds this custom image.

## Use the Published Image

Select a version from the [Kairos Fedora releases](https://github.com/marinatedconcrete/config/releases?q=kairos-fedora).
Use the version number from the release tag as the OCI image tag.
For example, release `kairos-fedora-1.1.1` supplies `ghcr.io/marinatedconcrete/kairos-fedora:1.1.1`.

### Migrate an Existing Kairos Node

Use this procedure on an existing Kairos node in standard boot mode.
For trusted boot, use the [Kairos trusted boot upgrade procedure](https://kairos.io/docs/upgrade/trustedboot/).

1. Back up the node configuration and persistent data.
2. For a Kubernetes node, drain the node before the upgrade.
3. On the node, run the upgrade with the selected image tag:

   ```sh
   sudo kairos-agent upgrade --source oci:ghcr.io/marinatedconcrete/kairos-fedora:1.1.1
   ```

4. Restart the node after the command completes successfully.
5. Log in to the node. Check the image version in `/etc/kairos-release`.
6. For a Kubernetes node, check that the node is `Ready`. Then uncordon the node.

If the upgrade fails to boot, select the passive system from the boot menu.
See [Kairos manual upgrades](https://kairos.io/docs/upgrade/manual/) for the recovery system upgrade procedure.

### Install on a New Node

On a machine with Docker, download the selected image and use AuroraBoot to make an installer ISO:

```sh
IMAGE=ghcr.io/marinatedconcrete/kairos-fedora:1.1.1
docker pull "$IMAGE"
mkdir -p build/kairos-install
docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$PWD/build/kairos-install:/tmp/auroraboot" \
    quay.io/kairos/auroraboot:v0.30.0@sha256:5c12af1ecbb54193420abe0643f459a9812a2f90c88bba86a889dbcdf53e6fdf \
    build-iso --output /tmp/auroraboot "oci:$IMAGE"
```

Boot the target node from the ISO in `build/kairos-install`.
Open the Kairos WebUI on port 8080.
Supply your Kairos configuration.
Check the target disk before you start the installation.
Installation can erase the data on that disk.
After installation, remove the installation media.
Start the node from the installed disk.

## Cloud Datasources

At startup, Kairos tries to get userdata from cloud datasources.
`/system/oem/00_datasource.yaml` lists the datasources, which include AWS, Azure, and GCP.
Most of these datasources read a metadata service at `169.254.169.254` on the local network.
If a datasource supplies userdata, Kairos runs the stages in the userdata as root.
These stages can run commands.
Until a datasource supplies userdata, Kairos tries again at each startup.
In UKI boot mode, Kairos does not try, unless the kernel command line contains `kairos.pull_datasources`.

Physical hardware has no metadata service, so a node usually gets no userdata.
But a different device on the same network segment can answer at `169.254.169.254`.
Put each node on a network segment where you control all of the devices.

## End-to-End Boot Test

Run the end-to-end test in the devcontainer:

```sh
just e2e-kairos-fedora
```

The devcontainer includes QEMU, OVMF, Docker, and SSH client tools.
The test runs in this environment.
The container user must have read and write access to `/dev/kvm`.

The test uses the same procedure as an installation on physical hardware:

1. Build or reuse the Kairos Fedora OCI image.
2. Generate an installer ISO from that OCI image with AuroraBoot.
3. Boot the installer ISO in QEMU.
4. Submit the install through the Kairos WebUI on port 8080.
5. Stop the virtual machine. Disconnect the ISO. Start the virtual machine from the installed disk. Check the operating system through SSH.

By default, `just e2e-kairos-fedora` builds `images/kairos-fedora/Containerfile` locally as `kairos-fedora:0.0.0-e2e`.
Set `KAIROS_IMAGE` to test a specified image reference.
The image must exist in Docker, or AuroraBoot must be able to download it:

```sh
KAIROS_IMAGE=ghcr.io/marinatedconcrete/kairos-fedora:0.8.1 just e2e-kairos-fedora
```

Optional settings:

- `KAIROS_IMAGE`: The OCI image reference to convert to an installer ISO.
- `KAIROS_ISO`: The path to an existing ISO. Use this setting to test startup and installation without new installation media.
- `E2E_WORKDIR`: The output and log directory. The default is `build/e2e/kairos-fedora`.
- `E2E_INSTALL_TIMEOUT`, `E2E_BOOT_TIMEOUT`, `E2E_K3S_TIMEOUT`: The timeout settings.

The CI workflow builds the image in the local Docker daemon.
Then the workflow runs the same test script.
For release tags, the workflow publishes the image only after the end-to-end test passes.

## Release Notes

The [Image Release Notes action](../../actions/image-release-notes/README.md) writes the release notes for this image.
The build workflow runs the action for each build and supplies the notes as an artifact.
The release workflow adds the notes and the SBOM to the draft release before publication.

The `release-notes-components.sh` script supplies the Kairos rows for the component table.
The script reports the Kairos Agent, kairos-init, and Kubernetes versions.
The script also reports the Kairos variant and model.

Generate the notes and the SBOM from a local image:

```sh
just release-notes-kairos-fedora kairos-fedora:0.0.0-e2e
```

Supply the SBOM of an earlier release to add the package changes:

```sh
just release-notes-kairos-fedora kairos-fedora:0.0.0-e2e path/to/previous-sbom.cdx.json
```
