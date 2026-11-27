#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

total=0
failed=0

expect_equal() {
  total=$((total + 1))
  if [[ "$3" == "$2" ]]; then
    printf 'ok   %s\n' "$1"
  else
    failed=$((failed + 1))
    printf "FAIL %s\n     expected '%s', found '%s'\n" "$1" "$2" "$3"
  fi
}

latest() {
  printf '%s' "$1" | bash "${HERE}/release-latest.sh" "$2"
}

published=$'devcontainer-base-2026.11.2\nkustomize-paperless@v2.2.1\ndevcontainer-base-2026.10.9'

expect_equal 'the newest draft becomes Latest' true "$(latest "${published}" devcontainer-base-2026.11.3)"
expect_equal 'the first draft becomes Latest' true "$(latest '' devcontainer-base-2026.11.0)"
expect_equal 'a draft older than a published release does not become Latest' false "$(latest "${published}" devcontainer-base-2026.11.1)"
expect_equal 'a version number above 9 is newer than 9' true "$(latest 'devcontainer-base-2026.11.9' devcontainer-base-2026.11.10)"
expect_equal 'a number 9 is older than 10' false "$(latest 'devcontainer-base-2026.11.10' devcontainer-base-2026.11.9)"
expect_equal 'a month 9 is older than 10' false "$(latest 'devcontainer-base-2026.10.0' devcontainer-base-2026.9.5)"
expect_equal 'a later year is newer' true "$(latest 'devcontainer-base-2026.12.4' devcontainer-base-2027.1.0)"
expect_equal 'a tag of a different image does not count' true "$(latest 'devcontainer-base-extra-2026.12.0' devcontainer-base-2026.11.0)"

status=0
latest '' devcontainer-base-latest > /dev/null 2>&1 || status=$?
expect_equal 'a tag with no CalVer version is rejected' 2 "${status}"

printf '%d of %d checks failed\n' "${failed}" "${total}"
((failed == 0))
