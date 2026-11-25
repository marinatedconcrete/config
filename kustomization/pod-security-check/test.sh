#!/usr/bin/env bash
# Usage: test.sh <kube-context>
# Prove that the check measures each Pod Security rule and reports a failure.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${HERE}/check.sh"

total=0
failed=0

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
  local index="$1" rule level token edit result measured
  rule="$(yq ".[${index}].rule" "${HERE}/fixtures/cases.yml")"
  level="$(yq ".[${index}].level" "${HERE}/fixtures/cases.yml")"
  token="$(yq ".[${index}].token // \"\"" "${HERE}/fixtures/cases.yml")"
  edit="$(yq ".[${index}].edit" "${HERE}/fixtures/cases.yml")"
  result="$(yq "${edit}" "${HERE}/fixtures/base.yml" | measure "${context}")"
  measured="${result%%$'\n'*}"
  if [[ "${measured}" != "${level}" ]]; then
    report "${rule}" "expected level ${level}, found ${measured}: ${result#"${measured}"}"
  elif [[ -n "${token}" && "${result#"${measured}"}" != *"${token}"* ]]; then
    report "${rule}" "expected the text '${token}' in:${result#"${measured}"}"
  else
    report "${rule}" ok
  fi
}

test_verdict() {
  expect_equal 'verdict: equal levels pass' '' "$(verdict a restricted restricted)"
  expect_equal 'verdict: no workload passes' '' "$(verdict a restricted none)"
  expect_contains 'verdict: an entry for no workload is stale' 'no workload' "$(verdict a baseline none)"
  expect_contains 'verdict: stricter than declared is stale' stale "$(verdict a baseline restricted)"
  expect_contains 'verdict: weaker than declared fails' 'Fix the manifest' "$(verdict a restricted baseline)"
  expect_contains 'verdict: privileged above baseline fails' 'Fix the manifest' "$(verdict a baseline privileged)"
}

test_validate_levels() {
  local dir status
  dir="$(mktemp -d)"
  printf 'kube-vip:\n  level: privileged\n  reason: A reason.\n' > "${dir}/good.yml"
  printf 'no-such-component:\n  level: baseline\n  reason: A reason.\n' > "${dir}/path.yml"
  printf 'paperless:\n  level: restricted\n  reason: A reason.\n' > "${dir}/level.yml"
  printf 'paperless:\n  level: baseline\n  reason: ""\n' > "${dir}/reason.yml"
  printf 'paperless: baseline\n' > "${dir}/scalar.yml"
  for file in good path level reason scalar; do
    status=0
    (validate_levels "${dir}/${file}.yml") > /dev/null 2>&1 || status=$?
    if [[ "${file}" == good ]]; then
      expect_equal 'levels.yml: a valid file passes' 0 "${status}"
    else
      expect_equal "levels.yml: ${file} is rejected" 2 "${status}"
    fi
  done
  rm -rf "${dir}"
}

main_test() {
  context="${1:?usage: test.sh <kube-context>}"
  prepare "${context}"
  test_verdict
  test_validate_levels
  local count index
  count="$(yq 'length' "${HERE}/fixtures/cases.yml")"
  for ((index = 0; index < count; index++)); do
    run_case "${index}"
  done
  printf '%d cases, %d failed\n' "${total}" "${failed}"
  ((failed == 0))
}

main_test "$@"
