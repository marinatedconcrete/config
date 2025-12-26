#!/bin/sh

set -e pipefail

if [ -z "${OUTPUTS}" ]; then
    echo "OUTPUTS must be set!"
    exit 1
fi

printf '%s' "$OUTPUTS" > /tmp/release-please-output.json

# Build a JSON array describing released kustomization components for matrix consumption.
components='[]'
released_paths=$(jq -r '.paths_released | fromjson | map(select(startswith("kustomization")))[]' /tmp/release-please-output.json)
if [ -n "$released_paths" ]; then
    while IFS= read -r p; do
        package_name=$(echo "$p" | sed -e 's/kustomization\/components\//kustomize-/' -)
        echo "Computing outputs for '$p' ($package_name)..."
        release_created=$(jq -r --arg key "$p"--release_created '.[$key]' /tmp/release-please-output.json)
        tag_name=$(jq -r --arg key "$p"--tag_name '.[$key]' /tmp/release-please-output.json)

        if [ "$release_created" = true ]; then
            components=$(printf '%s' "$components" | jq -c --arg project "$package_name" --arg tag "$tag_name" '. + [{project: $project, tag: $tag}]')
        fi
        echo "Done!"
    done <<EOF
$released_paths
EOF
fi

echo "components_json=$components" >> "$GITHUB_OUTPUT"
