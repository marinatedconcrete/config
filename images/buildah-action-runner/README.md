# Marinated Concrete's Buildah Action Runner Image

This image extends the upstream `quay.io/containers/buildah` image with the tools needed
for a minimal buildah environment in CI: `jq`, `curl`, and Node.js, for jobs that build
containers with `buildah` and also need common scripting tools.

The base is pinned to a full version tag with the `-immutable` suffix and a digest.
According to the [upstream retention policy](https://github.com/podman-container-tools/image_build#overview),
these tags use the same source as the stable images, are never overwritten, and
are only removed for an extreme security problem. This avoids relying on digests
of the daily rebuilt stable tags, which can disappear.

Renovate's Docker versioning preserves the `-immutable` suffix when updating the
base version. The pinned base does not receive daily security rebuilds; those
updates require moving to a newer base. We install the additional tools without
running `dnf upgrade`.

We publish semantically-versioned releases via release-please.
