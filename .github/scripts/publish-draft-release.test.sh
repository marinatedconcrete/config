#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "${FAKE_BIN}"' EXIT

# The fake gh writes each call to GH_CALLS. FAKE_IS_DRAFT sets the isDraft
# value. The fake fails when FAKE_VIEW_FAILS is set, or when the script edits
# or lists the releases of a published release.
cat > "${FAKE_BIN}/gh" << 'EOF'
#!/usr/bin/env bash
echo "$*" >> "${GH_CALLS}"
case "$1 $2" in
  "release view")
    [[ -z "${FAKE_VIEW_FAILS:-}" ]] || exit 1
    echo "${FAKE_IS_DRAFT}"
    ;;
  "api --paginate" | "release edit")
    [[ "${FAKE_IS_DRAFT}" == true ]] || exit 97
    [[ "$1" == release ]] || printf '%s\n' devcontainer-base-2026.11.2 kustomize-paperless@v2.2.1
    ;;
esac
EOF
chmod +x "${FAKE_BIN}/gh"

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

# Run the script for the tag $2 with isDraft $1. Print the exit status, then
# `api` for each gh api call and each gh release edit call.
publish() {
  local calls status=0
  calls="$(mktemp)"
  PATH="${FAKE_BIN}:${PATH}" GH_CALLS="${calls}" GH_REPO=owner/repo FAKE_IS_DRAFT="$1" \
    bash "${HERE}/publish-draft-release.sh" "$2" > /dev/null 2>&1 || status=$?
  echo "${status}"
  sed -n 's/^\(api\) .*/\1/p; /^release edit/p' "${calls}"
  rm -f "${calls}"
}

expect_equal 'a published release gets no gh api or gh release edit call' 0 \
  "$(publish false devcontainer-base-2026.11.1)"
expect_equal 'the newest draft becomes Latest' \
  $'0\napi\nrelease edit devcontainer-base-2026.11.3 --draft=false --latest=true' \
  "$(publish true devcontainer-base-2026.11.3)"
expect_equal 'a draft older than a published release does not become Latest' \
  $'0\napi\nrelease edit devcontainer-base-2026.11.1 --draft=false --latest=false' \
  "$(publish true devcontainer-base-2026.11.1)"
expect_equal 'a failed gh release view stops the script' 1 \
  "$(FAKE_VIEW_FAILS=1 publish true devcontainer-base-2026.11.3)"

printf '%d of %d checks failed\n' "${failed}" "${total}"
((failed == 0))
