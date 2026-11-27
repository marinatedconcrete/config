#!/usr/bin/env bash
set -euo pipefail

image="${1:?Pass the vscode-ssh-server image reference.}"
workdir="$(mktemp -d)"
container=""
trap '
    if [[ -n "$container" ]]; then
        docker rm -f "$container" >/dev/null || true
    fi
    rm -rf "$workdir"
' EXIT

ssh-keygen -q -t ed25519 -N '' -f "$workdir/client"
container="$(docker create --network none --tmpfs /config:uid=1000,gid=1000,mode=0700 "$image")"
docker cp "$workdir/client.pub" "$container:/home/dev/.ssh/authorized_keys"
docker start "$container" >/dev/null

for ((attempt = 0; attempt < 10; attempt++)); do
    if docker exec "$container" ssh-keyscan -T 1 -t ed25519 -p 2222 127.0.0.1; then
        exit 0
    fi
    sleep 1
done

docker logs "$container" >&2
exit 1
