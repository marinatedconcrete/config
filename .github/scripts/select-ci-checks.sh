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
if changed .devcontainer ansible/requirements.txt ':(glob).github/workflows/ci*.yml' .github/scripts/select-ci-checks.sh; then
  build=true
fi

components=()
for suite in kustomization/tests/*/test.yml; do
  test_dir=${suite%/test.yml}
  test=${test_dir##*/}
  paths=("kustomization/tests/$test")
  case "$test" in
    pod-security-*)
      # These tests check combinations of Pod Security components.
      paths+=(kustomization/components/pod-security kustomization/tests/pod_security.py renovate.json)
      ;;
    factorio|kube-vip|kube-vip-wireguard|mosquitto|paperless|priorityclass|unifi-network-application)
      paths+=("kustomization/components/$test" kustomization/components/priorityclass)
      ;;
    *)
      # A new test can use several components or shared test files.
      paths+=(kustomization/components kustomization/tests kustomization/examples)
      ;;
  esac
  case "$test" in
    paperless) paths+=(kustomization/components/redis) ;;
    kube-vip-wireguard) paths+=(kustomization/components/kube-vip) ;;
  esac
  if [[ "$build" == true ]] || changed "${paths[@]}" ansible justfile \
    pnpm-lock.yaml pnpm-workspace.yaml package.json ':(exclude,glob)**/*.md'; then
    components+=("$test")
  fi
done

printf 'build=%s\n' "$build" >> "$GITHUB_OUTPUT"
jq -cn '$ARGS.positional' --args "${components[@]}" | sed 's/^/components=/' >> "$GITHUB_OUTPUT"
