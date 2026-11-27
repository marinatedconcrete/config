#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${HERE}/check.sh"

total=0
failed=0
measured=''
details=''

report() {
  total=$((total + 1))
  if [[ "$2" == ok ]]; then
    printf 'ok   %s\n' "$1"
  else
    failed=$((failed + 1))
    printf 'FAIL %s\n     %s\n' "$1" "$2"
  fi
}

expect_equal() {
  if [[ "$3" == "$2" ]]; then report "$1" ok; else report "$1" "expected '$2', found '$3'"; fi
}

expect_contains() {
  if [[ "$3" == *"$2"* ]]; then report "$1" ok; else report "$1" "expected the text '$2' in '$3'"; fi
}

run_case() {
  local index="$1" rule level token edit
  rule="$(yq ".[${index}].rule" "${HERE}/fixtures/cases.yml")"
  level="$(yq ".[${index}].expected_level" "${HERE}/fixtures/cases.yml")"
  token="$(yq ".[${index}].expected_text // \"\"" "${HERE}/fixtures/cases.yml")"
  edit="$(yq ".[${index}].edit" "${HERE}/fixtures/cases.yml")"
  measure "${context}" <<< "$(yq "${edit}" "${HERE}/fixtures/base.yml")"
  if [[ "${measured}" != "${level}" ]]; then
    report "${rule}" "expected level ${level}, found ${measured}: ${details}"
  elif [[ -n "${token}" && "${details}" != *"${token}"* ]]; then
    report "${rule}" "expected the text '${token}' in: ${details}"
  else
    report "${rule}" ok
  fi
}

test_verdict() {
  expect_equal 'verdict: equal levels pass' '' "$(verdict a restricted restricted)"
  expect_equal 'verdict: no workload passes' '' "$(verdict a restricted none)"
  expect_contains 'verdict: an entry for no workload is stale' 'no workload' "$(verdict a baseline none)"
  expect_contains 'verdict: stricter than declared is stale' stale "$(verdict a baseline restricted)"
  expect_equal 'verdict: restricted measured says remove the entry' 'The entry for a in exceptions.yml is stale. Remove it.' "$(verdict a baseline restricted)"
  expect_equal 'verdict: baseline measured says set the level' 'The entry for a in exceptions.yml is stale. Set its level to baseline.' "$(verdict a privileged baseline)"
  expect_contains 'verdict: weaker than declared fails' 'Fix the manifest' "$(verdict a restricted baseline)"
  expect_contains 'verdict: privileged above baseline fails' 'Fix the manifest of a, or set its level and reason in exceptions.yml.' "$(verdict a baseline privileged)"
}

test_validate_exceptions() {
  local dir status file
  dir="$(mktemp -d)"
  printf 'kube-vip:\n  level: privileged\n  reason: A reason.\n' > "${dir}/good.yml"
  printf 'no-such-component:\n  level: baseline\n  reason: A reason.\n' > "${dir}/path.yml"
  printf 'paperless:\n  level: restricted\n  reason: A reason.\n' > "${dir}/level.yml"
  printf 'paperless:\n  level: baseline\n  reason: ""\n' > "${dir}/reason.yml"
  printf 'paperless: baseline\n' > "${dir}/scalar.yml"
  for file in good path level reason scalar; do
    status=0
    (validate_exceptions "${dir}/${file}.yml") > /dev/null 2>&1 || status=$?
    if [[ "${file}" == good ]]; then
      expect_equal 'exceptions.yml: a valid file passes' 0 "${status}"
    else
      expect_equal "exceptions.yml: ${file} is rejected" 2 "${status}"
    fi
  done
  rm -rf "${dir}"
}

test_documented_levels() {
  local dir
  dir="$(mktemp -d)"
  mkdir -p "${dir}/kustomization/components/a" "${dir}/kustomization/tests/a"
  printf '![Pod Security](https://img.shields.io/badge/pod_security_standard-baseline-blue)\n' > "${dir}/kustomization/components/a/README.md"
  printf 'metadata:\n  labels:\n    pod-security.kubernetes.io/enforce: baseline\n' > "${dir}/kustomization/tests/a/namespace.yml"
  expect_equal 'badge and label: equal levels pass' '' "$(ROOT="${dir}" COMPONENTS="${dir}/kustomization/components" documented_level_problems a baseline)"
  expect_contains 'badge: a different level fails' 'README badge of a shows baseline' "$(ROOT="${dir}" COMPONENTS="${dir}/kustomization/components" documented_level_problems a restricted)"
  expect_contains 'label: a different enforce label fails' 'enforce label in kustomization/tests/a/namespace.yml is baseline. Set it to restricted.' "$(ROOT="${dir}" COMPONENTS="${dir}/kustomization/components" documented_level_problems a restricted)"
  printf 'metadata:\n  labels: {}\n' > "${dir}/kustomization/tests/a/namespace.yml"
  expect_contains 'label: a missing enforce label fails' 'enforce label in kustomization/tests/a/namespace.yml is missing. Set it to baseline.' "$(ROOT="${dir}" COMPONENTS="${dir}/kustomization/components" documented_level_problems a baseline)"
  printf '# A\n' > "${dir}/kustomization/components/a/README.md"
  rm "${dir}/kustomization/tests/a/namespace.yml"
  expect_equal 'badge: a missing badge fails for a workload' 'The README of a has no Pod Security badge. Add the badge for baseline.' "$(ROOT="${dir}" COMPONENTS="${dir}/kustomization/components" documented_level_problems a baseline baseline | head -n 1)"
  expect_equal 'badge: a missing badge passes for a component with no workload' '' "$(ROOT="${dir}" COMPONENTS="${dir}/kustomization/components" documented_level_problems a restricted none)"
  rm -rf "${dir}"
}

main_test() {
  context="${1:?usage: test.sh <kube-context>}"
  prepare "${context}"
  test_verdict
  test_validate_exceptions
  test_documented_levels
  measure "${context}" <<< 'kind: [unclosed' 2> /dev/null
  expect_equal 'measure: YAML that yq cannot read is a check error' error "${measured}"
  local count index
  count="$(yq 'length' "${HERE}/fixtures/cases.yml")"
  for ((index = 0; index < count; index++)); do
    run_case "${index}"
  done
  printf '%d cases, %d failed\n' "${total}" "${failed}"
  ((failed == 0))
}

main_test "$@"
