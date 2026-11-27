#!/usr/bin/env bash
set -euo pipefail

# Attach the SBOM to a release. Add the notes to the end of the release body.
# Run this script on a draft release. Publish the release after the script ends.
# GitHub then locks the SBOM in an immutable release.
# This script reads two files and calls the GitHub API. This script runs no code
# from the image, so a job with write access to the release does not run the
# image.
#
# The GitHub CLI reads the token from the GH_TOKEN environment variable.

log() {
    printf '==> %s\n' "$*" >&2
}

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

usage() {
    cat <<'EOF'
Usage: publish.sh --component NAME --tag TAG [options]

Options:
  --component NAME  The prefix of the output files and of the release tags.
                    Required.
  --directory PATH  The directory that contains the notes and the SBOM.
  --help            Show this message.
  --tag TAG         The release tag. Required.
EOF
}

component=""
directory="build/release"
tag=""

# Stop with a message when an option has no value. Without this check, `shift 2`
# fails and `set -e` stops the script with no message.
need_value() {
    (($# >= 2)) || die "the $1 option needs a value"
}

# Print the release body without the section that an earlier run added. The
# marker must be alone on its line. A marker in a commit message is therefore
# not a match, and the text of the release stays complete. Use the last marker
# in the body. Ignore a carriage return, because the GitHub web editor writes
# one at the end of each line.
body_above_marker() {
    local marker="$1"

    gh release view "$tag" --json body --jq .body |
        MARKER="$marker" awk '
            { sub(/\r$/, "") }
            { lines[NR] = $0; if ($0 == ENVIRON["MARKER"]) found = NR }
            END {
                last = found ? found - 1 : NR
                for (i = 1; i <= last; i++) print lines[i]
            }
        '
}

main() {
    local assets
    local body
    local digest
    local file
    local immutable
    local local_digest
    local marker
    local notes
    local release_body
    local sbom

    while (($# > 0)); do
        case "$1" in
        --component)
            need_value "$@"
            component="$2"
            shift 2
            ;;
        --directory)
            need_value "$@"
            directory="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        --tag)
            need_value "$@"
            tag="$2"
            shift 2
            ;;
        *)
            usage >&2
            die "unknown option: $1"
            ;;
        esac
    done

    require_cmd awk
    require_cmd cut
    require_cmd gh
    require_cmd sha256sum

    [[ -n "$component" ]] || {
        usage >&2
        die "--component is required"
    }

    # An empty tag makes the GitHub CLI select the most recent release. This
    # script must never change a release that the caller did not name.
    [[ -n "$tag" ]] || {
        usage >&2
        die "--tag is required"
    }

    marker="<!-- ${component}-image-details -->"
    notes="${directory}/${component}-notes.md"
    release_body="${directory}/release-body.md"
    sbom="${directory}/${component}-sbom.cdx.json"

    for file in "$notes" "$sbom"; do
        [[ -s "$file" ]] || die "the ${file} file is missing or empty"
    done

    gh release view "$tag" >/dev/null 2>&1 ||
        die "release ${tag} does not exist; create the release first"

    # GitHub refuses asset changes on a published immutable release. For that
    # release, make sure that the attached SBOM is the same as the local SBOM.
    # Otherwise the notes and the SBOM can come from different builds.
    immutable="$(gh release view "$tag" --json isImmutable --jq .isImmutable)"
    if [[ "$immutable" != true ]]; then
        log "Attaching the SBOM to ${tag}"
        gh release upload "$tag" "$sbom" --clobber
    else
        # The GitHub REST API gives the SHA-256 digest of each asset. A direct
        # API call does not depend on the release fields of the GitHub CLI.
        assets="$(gh api "repos/{owner}/{repo}/releases/tags/${tag}" \
            --jq '.assets[] | [.name, (.digest // "")] | @tsv')"
        if ! digest="$(NAME="${sbom##*/}" awk -F '\t' '
            $1 == ENVIRON["NAME"] { print $2; found = 1 }
            END { exit !found }
        ' <<<"$assets")"; then
            die "release ${tag} is immutable and has no ${sbom##*/} asset; create the release as a draft and publish it after this action"
        fi
        [[ -n "$digest" ]] ||
            die "the ${sbom##*/} asset of release ${tag} has no digest; the script cannot compare it with the local SBOM"
        local_digest="sha256:$(sha256sum -- "$sbom" | cut -d ' ' -f 1)"
        [[ "$digest" == "$local_digest" ]] ||
            die "the ${sbom##*/} asset of release ${tag} (${digest}) is not the same as the local SBOM (${local_digest}); the notes must come from the build of the attached SBOM"
        log "Immutable release ${tag} already has the same SBOM"
    fi

    body="$(body_above_marker "$marker")"

    # Remove the space characters at the end. The spacing then stays the same
    # when the job runs again.
    shopt -s extglob
    body="${body%%*([[:space:]])}"

    {
        # The body is empty when the release has no text above the marker.
        if [[ -n "$body" ]]; then
            printf '%s\n\n' "$body"
        fi
        printf '%s\n\n' "$marker"
        cat "$notes"
    } >"$release_body"

    log "Writing the release body of ${tag}"
    gh release edit "$tag" --notes-file "$release_body"
}

main "$@"
