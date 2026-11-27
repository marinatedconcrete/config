#!/usr/bin/env bash
set -euo pipefail

# Find the release before this one and download its SBOM. The change table in
# the release notes compares the two SBOMs. The first release has no previous
# release. This script then writes an empty tag and downloads nothing.
#
# The script prints the tag of the previous release to standard output.
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
Usage: previous-sbom.sh --component NAME [options]

Options:
  --component NAME  The prefix of the output files and of the release tags.
                    Required.
  --current-tag TAG The tag of this release. The script then selects the
                    release with the highest version below this tag.
  --directory PATH  The directory for the SBOM of the previous release. The
                    default is `build/release`.
  --help            Show this message.
EOF
}

component=""
current_tag=""
directory="build/release"

# Stop with a message when an option has no value. Without this check, `shift 2`
# fails and `set -e` stops the script with no message.
need_value() {
    (($# >= 2)) || die "the $1 option needs a value"
}

# Print the release tag that comes before this release. Compare the versions,
# not the release dates. A release of an older version can have a later date.
# The caller can also run the job again for an earlier tag. Skip the draft
# releases.
find_previous_tag() {
    gh release list --json isDraft,tagName --limit 1000 |
        jq -r --arg current "$current_tag" --arg prefix "${component}-" '
            # Read the numbers after the prefix. A tag without the `X.Y.Z` form
            # gives an empty array, and the filter below removes that tag.
            def version($prefix):
                .[($prefix | length):]
                | if test("^[0-9]+\\.[0-9]+\\.[0-9]+$")
                  then split(".") | map(tonumber)
                  else []
                  end;

            [
                .[]
                | select(.isDraft | not)
                | .tagName
                | select(startswith($prefix))
                | { tag: ., version: version($prefix) }
                | select((.version | length) > 0)
            ] as $releases
            | (
                $current
                | if startswith($prefix) then version($prefix) else [] end
              ) as $current_version
            | $releases
            | if ($current_version | length) > 0
              then map(select(.version < $current_version))
              else .
              end
            | sort_by(.version)
            | last
            | if . == null then "" else .tag end
        '
}

main() {
    local asset
    local assets
    local download_dir
    local previous_tag
    local target

    while (($# > 0)); do
        case "$1" in
        --component)
            need_value "$@"
            component="$2"
            shift 2
            ;;
        --current-tag)
            need_value "$@"
            current_tag="$2"
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
        *)
            usage >&2
            die "unknown option: $1"
            ;;
        esac
    done

    require_cmd gh
    require_cmd jq

    [[ -n "$component" ]] || {
        usage >&2
        die "--component is required"
    }

    asset="${component}-sbom.cdx.json"
    target="${directory}/previous/${asset}"

    # Remove the SBOM of an earlier run. The notes would then compare with the
    # wrong release.
    mkdir -p "${directory}/previous"
    rm -f -- "$target"

    previous_tag="$(find_previous_tag)"
    printf '%s\n' "$previous_tag"

    if [[ -z "$previous_tag" ]]; then
        log "The script found no previous ${component} release."
        return 0
    fi

    log "Using ${previous_tag} as the previous release."
    assets="$(gh release view "$previous_tag" --json assets)" ||
        die "could not read the assets of ${previous_tag}"
    if ! jq -e --arg name "$asset" 'any(.assets[]; .name == $name)' \
        <<<"$assets" >/dev/null; then
        log "Release ${previous_tag} has no SBOM."
        return 0
    fi

    # Download to an empty directory. A failed download then leaves no file.
    download_dir="$(mktemp -d)"
    gh release download "$previous_tag" \
        --dir "$download_dir" \
        --pattern "$asset" ||
        die "could not download the SBOM of ${previous_tag}"
    mv -- "${download_dir}/${asset}" "$target"
    rmdir -- "$download_dir"
}

main "$@"
