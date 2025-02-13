#!/bin/sh

set -e pipefail

if [ -z "${OUTPUTS}" ]; then
    echo "OUTPUTS must be set!"
    exit 1
fi

printf '%s' "$OUTPUTS" > /tmp/release-please-output.json

# Kustomization Components
jq -r '.paths_released | fromjson | map(select(startswith("kustomization")))[]' /tmp/release-please-output.json | while read -r p; do
    package_name=$(echo "$p" | sed -e 's/kustomization\/components\//kustomize-/' -)
    echo "Computing outputs for '$p' ($package_name)..."
    release_created=$(jq -r --arg key "$p"--release_created '.[$key]' /tmp/release-please-output.json)
    tag_name=$(jq -r --arg key "$p"--tag_name '.[$key]' /tmp/release-please-output.json)
    if [ "$release_created" = true ]; then
        echo "$package_name""--release_created=true" >> "$GITHUB_OUTPUT"
        echo "$package_name""--tag_name=""$tag_name" >> "$GITHUB_OUTPUT"
    fi
    echo "Done!"
done
