# Marinated Concrete's Custom Fedora-Based Kairos Image

This utilizes the [Kairos Factory](https://kairos.io/docs/reference/kairos-factory/) to produce our very own custom image.

## End-to-End Boot Test

Run the e2e test from the devcontainer:

```sh
just e2e-kairos-fedora
```

The devcontainer includes QEMU, OVMF, Docker, and SSH client tooling, so the test runs directly in the current environment. It requires `/dev/kvm` to be present and readable/writable by the container user.

The harness validates the same path a bare-metal install uses:

1. Build or reuse the Kairos Fedora OCI image.
2. Generate an installer ISO from that OCI image with AuroraBoot.
3. Boot the installer ISO in QEMU.
4. Submit the install through the Kairos WebUI on port 8080.
5. Power off, detach the ISO, boot from the installed disk, and verify the OS over SSH.

By default, `just e2e-kairos-fedora` builds `images/kairos-fedora/Containerfile` locally as `kairos-fedora:0.0.0-e2e`. Set `KAIROS_IMAGE` to test a specific image ref that already exists in Docker or can be pulled by AuroraBoot:

```sh
KAIROS_IMAGE=ghcr.io/marinatedconcrete/kairos-fedora:0.8.1 just e2e-kairos-fedora
```

Useful overrides:

- `KAIROS_IMAGE`: OCI image ref to convert into an installer ISO.
- `KAIROS_ISO`: existing ISO path for debugging the boot/install path without regenerating media.
- `E2E_WORKDIR`: artifact and log directory, default `build/e2e/kairos-fedora`.
- `E2E_INSTALL_TIMEOUT`, `E2E_BOOT_TIMEOUT`, `E2E_K3S_TIMEOUT`: timeout overrides.

The CI workflow runs the same script after building the image into the local Docker daemon. On release tags, the workflow pushes the image only after the e2e test passes.
