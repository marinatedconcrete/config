#!/usr/bin/env bash
set -euo pipefail

image="${1:?Pass the buildah-action-runner image reference.}"
docker run --rm --network none --privileged --entrypoint bash "$image" -euc '
    context="$(mktemp -d)"
    printf "smoke test\n" > "$context/marker"
    printf "FROM scratch\nCOPY marker /marker\n" > "$context/Containerfile"
    buildah --storage-driver vfs build --isolation chroot -t localhost/buildah-smoke "$context"
    buildah --storage-driver vfs inspect --type image localhost/buildah-smoke >/dev/null
'
