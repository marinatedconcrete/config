# Marinated Concrete Custom Fedora Kairos Image

[Kairos Factory](https://kairos.io/docs/reference/kairos-factory/) builds this custom image.

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
5. Stop the virtual machine.
6. Disconnect the ISO.
7. Start the virtual machine from the installed disk.
8. Check the operating system through SSH.

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
