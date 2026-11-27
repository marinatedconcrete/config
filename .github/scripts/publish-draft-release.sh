#!/usr/bin/env bash
set -euo pipefail

# Publish the draft release at tag $1 in the repository GH_REPO. Do nothing
# when the release is already published, so that a retry of the job passes.

tag="${1:?usage: publish-draft-release.sh <name-YYYY.M.N>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

is_draft=$(gh release view "${tag}" --json isDraft --jq .isDraft)
if [[ "${is_draft}" != true ]]; then
    exit 0
fi

latest=$(
    gh api --paginate "repos/${GH_REPO}/releases" --jq '.[] | select(.draft | not) | .tag_name' |
        "${here}/release-latest.sh" "${tag}"
)
gh release edit "${tag}" --draft=false --latest="${latest}"
