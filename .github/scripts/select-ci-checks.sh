#!/usr/bin/env bash
set -euo pipefail

if [[ "$GITHUB_REF" == "refs/heads/$DEFAULT_BRANCH" ]]; then
  base="$BEFORE"
else
  base=$(git merge-base HEAD "refs/remotes/origin/$DEFAULT_BRANCH") || base=
fi
if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  base=
fi

# Select all checks if Git cannot compare the two revisions.
changed() {
  [[ -z "$base" ]] || ! git diff --quiet --no-renames "$base" HEAD -- "$@"
}

build=false
if changed .devcontainer ansible/requirements.txt .github/workflows/ci.yml .github/scripts/select-ci-checks.sh; then
  build=true
fi

matrix=()
components=()
while IFS= read -r test; do
  matrix+=("$test")
  paths=("kustomization/tests/$test")
  case "$test" in
    pod-security-*)
      # These tests check combinations of Pod Security components.
      paths+=(kustomization/components/pod-security kustomization/tests/pod_security.py renovate.json)
      ;;
    *) paths+=("kustomization/components/$test" kustomization/components/priorityclass) ;;
  esac
  case "$test" in
    paperless) paths+=(kustomization/components/redis) ;;
    kube-vip-wireguard) paths+=(kustomization/components/kube-vip) ;;
  esac
  if [[ "$build" == true ]] || changed "${paths[@]}" ansible justfile \
    pnpm-lock.yaml pnpm-workspace.yaml package.json ':(exclude,glob)**/*.md'; then
    components+=("$test")
  fi
done <<< "${KUSTOMIZATION_TESTS%$'\n'}"

printf 'build=%s\n' "$build" >> "$GITHUB_OUTPUT"
jq -cn '$ARGS.positional' --args "${components[@]}" | sed 's/^/components=/' >> "$GITHUB_OUTPUT"
jq -cn '$ARGS.positional' --args "${matrix[@]}" | sed 's/^/matrix=/' >> "$GITHUB_OUTPUT"
