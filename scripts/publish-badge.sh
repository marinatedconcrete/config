#!/usr/bin/env bash
# Publish a badge file as coverage.json on the "badges" branch.
# The script uses the GitHub API only. It makes no commit on the default branch.
# A commit that the workflow token makes does not start another workflow run.
# The script writes only when EXPECTED_SHA is the head of the default branch.
# A run for an older commit leaves the badge as it is.
# Usage: GH_REPO=owner/name EXPECTED_SHA=sha publish-badge.sh BADGE_FILE
set -euo pipefail

file=${1:?Usage: publish-badge.sh BADGE_FILE}
repo=${GH_REPO:?Set GH_REPO to owner/name.}
expected=${EXPECTED_SHA:?Set EXPECTED_SHA to the commit of this run.}
default_branch=${DEFAULT_BRANCH:-main}
branch=badges
path=coverage.json

head=$(gh api "repos/${repo}/git/ref/heads/${default_branch}" --jq .object.sha)
if [[ "${head}" != "${expected}" ]]; then
    echo "The head of ${default_branch} is ${head}. This run is for ${expected}. No write."
    exit 0
fi

if gh api "repos/${repo}/git/ref/heads/${branch}" >/dev/null 2>&1; then
    current=$(gh api -H "Accept: application/vnd.github.raw+json" "repos/${repo}/contents/${path}?ref=${branch}" 2>/dev/null || true)
    if [[ "${current}" == "$(cat "${file}")" ]]; then
        echo "The badge is the same. No commit."
        exit 0
    fi
    sha=$(gh api "repos/${repo}/contents/${path}?ref=${branch}" --jq .sha 2>/dev/null || true)
    args=(-f "message=chore: update the coverage badge" -f "branch=${branch}" -f "content=$(base64 -w0 "${file}")")
    if [[ -n "${sha}" ]]; then
        args+=(-f "sha=${sha}")
    fi
    gh api -X PUT "repos/${repo}/contents/${path}" "${args[@]}" >/dev/null
    echo "Updated ${path} on ${branch}."
    exit 0
fi

# The branch does not exist. Make a commit with no parent, then the branch.
blob=$(gh api -X POST "repos/${repo}/git/blobs" -f "content=$(cat "${file}")" -f encoding=utf-8 --jq .sha)
tree=$(jq -n --arg sha "${blob}" --arg path "${path}" '{tree: [{path: $path, mode: "100644", type: "blob", sha: $sha}]}' |
    gh api -X POST "repos/${repo}/git/trees" --input - --jq .sha)
commit=$(gh api -X POST "repos/${repo}/git/commits" -f "message=chore: create the badges branch" -f "tree=${tree}" --jq .sha)
gh api -X POST "repos/${repo}/git/refs" -f "ref=refs/heads/${branch}" -f "sha=${commit}" >/dev/null
echo "Created ${branch} with ${path}."
