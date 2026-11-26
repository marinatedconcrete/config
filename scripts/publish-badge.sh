#!/usr/bin/env bash
# Publish badge files on the "badges" branch in one commit. The name of each file on the branch is its base name.
# The script uses the GitHub API only. It makes no commit on the default branch.
# A commit that the workflow token makes does not start another workflow run.
# The script writes only when EXPECTED_SHA is the head of the default branch.
# A run for an older commit leaves the badges as they are.
# The ref update must be a fast-forward. If a different process changes the branch first, the update fails.
# Usage: GH_REPO=owner/name EXPECTED_SHA=sha publish-badge.sh BADGE_FILE...
set -euo pipefail

(($# > 0)) || {
    echo "Usage: publish-badge.sh BADGE_FILE..." >&2
    exit 2
}
repo=${GH_REPO:?Set GH_REPO to owner/name.}
expected=${EXPECTED_SHA:?Set EXPECTED_SHA to the commit of this run.}
default_branch=${DEFAULT_BRANCH:-main}
branch=badges

for file in "$@"; do
    name=$(basename "${file}")
    if [[ ! "${name}" =~ ^[a-z0-9-]+\.json$ ]]; then
        echo "The name \"${name}\" must have only lowercase letters, digits, and hyphens, and end in .json." >&2
        exit 2
    fi
done

# Read the badges ref before the head check. A newer run that writes after the check then makes the ref update fail.
parent=$(gh api "repos/${repo}/git/ref/heads/${branch}" --jq .object.sha 2>/dev/null || true)
head=$(gh api "repos/${repo}/git/ref/heads/${default_branch}" --jq .object.sha)
if [[ "${head}" != "${expected}" ]]; then
    echo "The head of ${default_branch} is ${head}. This run is for ${expected}. No write."
    exit 0
fi

changed=()
for file in "$@"; do
    if [[ -n "${parent}" ]]; then
        current=$(gh api -H "Accept: application/vnd.github.raw+json" "repos/${repo}/contents/$(basename "${file}")?ref=${parent}" 2>/dev/null || true)
        [[ "${current}" == "$(cat "${file}")" ]] && continue
    fi
    changed+=("${file}")
done
if ((${#changed[@]} == 0)); then
    echo "The badges are the same. No commit."
    exit 0
fi

base_tree=""
if [[ -n "${parent}" ]]; then
    base_tree=$(gh api "repos/${repo}/git/commits/${parent}" --jq .tree.sha)
fi
tree=$(for file in "${changed[@]}"; do
    jq -n --arg path "$(basename "${file}")" --rawfile content "${file}" '{path: $path, mode: "100644", type: "blob", content: $content}'
done | jq -s --arg base "${base_tree}" '{tree: .} + if $base == "" then {} else {base_tree: $base} end' |
    gh api -X POST "repos/${repo}/git/trees" --input - --jq .sha)
commit=$(jq -n --arg tree "${tree}" --arg parent "${parent}" \
    '{message: "chore: update the coverage badges", tree: $tree} + if $parent == "" then {} else {parents: [$parent]} end' |
    gh api -X POST "repos/${repo}/git/commits" --input - --jq .sha)

if [[ -n "${parent}" ]]; then
    gh api -X PATCH "repos/${repo}/git/refs/heads/${branch}" -f "sha=${commit}" -F force=false >/dev/null
    echo "Updated ${#changed[@]} badge files on ${branch}."
else
    gh api -X POST "repos/${repo}/git/refs" -f "ref=refs/heads/${branch}" -f "sha=${commit}" >/dev/null
    echo "Created ${branch} with ${#changed[@]} badge files."
fi
