#!/usr/bin/env bash
set -euo pipefail

# Read the tag names of the published releases on standard input. Print the
# `--latest` value of `gh release edit` for the draft release at tag $1.
# Print `false` when a published release of the same image has a newer CalVer
# version. A retry of an older draft then does not become the Latest release.

tag="${1:?usage: <tag names> | release-latest.sh <name-YYYY.M.N>}"

name="${tag%-*}"
pattern="^${name//./\\.}-([0-9]+)\.([0-9]+)\.([0-9]+)$"

order() {
    printf '%d\n' $((10#${BASH_REMATCH[1]} * 100000000 + 10#${BASH_REMATCH[2]} * 1000000 + 10#${BASH_REMATCH[3]}))
}

if [[ ! "${tag}" =~ ${pattern} ]]; then
    echo "The tag ${tag} has no CalVer version." >&2
    exit 2
fi
version=$(order)

latest=true
while IFS= read -r published || [[ -n "${published}" ]]; do
    if [[ "${published}" =~ ${pattern} ]] && (($(order) > version)); then
        latest=false
    fi
done

echo "${latest}"
