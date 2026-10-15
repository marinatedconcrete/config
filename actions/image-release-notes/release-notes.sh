#!/usr/bin/env bash
set -euo pipefail

# Generate the release notes and the SBOM for a container image.
# Syft reads the packages from the image and writes a CycloneDX SBOM.
# The CycloneDX CLI compares the SBOM with the SBOM of the previous release.
# The script does not contact GitHub.

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

# Stop with a message when an option has no value. Without this check, `shift 2`
# fails and `set -e` stops the script with no message.
need_value() {
    (($# >= 2)) || die "the $1 option needs a value"
}

usage() {
    cat <<'EOF'
Usage: release-notes.sh --image REF [options]

Options:
  --components-script PATH  A script that runs in the image. The script prints
                            one `label<TAB>version` line for each component.
  --cyclonedx-image REF     The CycloneDX CLI image.
  --help                    Show this message.
  --highlights NAMES        Show these packages in the component table. Separate
                            the names with spaces.
  --image REF               The OCI image reference to examine. Required.
  --notes PATH              The output path for the Markdown release notes.
  --package-type TYPE       The package type for the tables. The default is
                            `rpm`. The SBOM keeps all package types.
  --previous-sbom PATH      The SBOM of the previous release. The script omits
                            the change table when this file is absent or empty.
  --previous-tag TAG        The tag name of the previous release.
  --sbom PATH               The output path for the CycloneDX SBOM.
  --syft-image REF          The Syft image.
EOF
}

components_script=""
highlights=()
image=""
notes_path=""
package_type="rpm"
previous_sbom=""
previous_tag=""
sbom_path=""

# The text that shows an empty list of added or removed packages.
none_text=" _none_"

# renovate: datasource=docker depName=anchore/syft
SYFT_IMAGE="${SYFT_IMAGE:-anchore/syft:v1.51.1@sha256:95fe0835e5bebc6f8b1f8acef68d47d63d594ef4c0f25c097ff853b23cbac74c}"
# renovate: datasource=docker depName=cyclonedx/cyclonedx-cli
CYCLONEDX_IMAGE="${CYCLONEDX_IMAGE:-cyclonedx/cyclonedx-cli:0.33.1@sha256:252c2e26f468c25fea1e63ecde1bc3198ad6e9dbb57f5ed3236bddcb2281b3a7}"

# The cleanup trap removes these temporary files.
current_packages=""
previous_packages=""
image_tar=""
installed=""
components=""
diff_json=""

remove_temp_files() {
    rm -f -- \
        "$current_packages" "$previous_packages" "$installed" \
        "$components" "$diff_json" "$image_tar" 2>/dev/null || true
}

# Run Syft on the image. Write the image to a tar file first. Syft then needs
# no access to the Docker socket and no network. Access to the Docker socket
# gives a container the same control as the root user on the host.
#
# Syft writes the SBOM to standard output, so the output file belongs to the
# user that starts the script.
extract_sbom() {
    local dest="$1"

    image_tar="$(mktemp --tmpdir image-XXXXXX.tar)"

    log "Writing ${image} to a tar file"
    docker save --output "$image_tar" "$image" ||
        die "could not write ${image} to a tar file"

    log "Reading the packages with Syft"
    docker run \
        --env SYFT_CHECK_FOR_APP_UPDATE=false \
        --env SYFT_FILE_METADATA_SELECTION=none \
        --network none \
        --rm \
        --volume "${image_tar}:/image.tar:ro" \
        "$SYFT_IMAGE" scan "docker-archive:/image.tar" \
        --output cyclonedx-json \
        --quiet \
        --source-name "${image%%:*}" \
        --source-version "${image##*:}" >"$dest" ||
        die "Syft could not read ${image}"

    rm -f -- "$image_tar"
    image_tar=""

    [[ -s "$dest" ]] || die "Syft wrote an empty SBOM"
}

# Keep only the packages of the selected type. The tables use this subset. The
# CycloneDX CLI also compares these packages. A full SBOM contains thousands of
# language components that make the change table too long.
filter_packages() {
    local source="$1"
    local dest="$2"

    jq -c --arg type "pkg:${package_type}/" '
        {
            bomFormat,
            specVersion,
            version,
            metadata,
            components: [
                (.components // [])[]
                | select(.purl != null and (.purl | startswith($type)))
            ]
        }
    ' "$source" >"$dest" || die "could not filter the SBOM"
}

# Print the versions of one package from the filtered SBOM. One name can match
# more than one component, because an image can contain more than one
# architecture of a package. Print each version one time. Separate the
# versions with a comma.
package_version() {
    local packages="$1"
    local name="$2"

    jq -r --arg name "$name" '
        [(.components // [])[] | select(.name == $name) | .version]
        | unique
        | join(",")
    ' "$packages"
}

# Read the packages that the image build installs by name. This list does not
# include the packages that the package manager installs as dependencies. Syft does not
# record this difference, so the script asks `dnf`. The
# `--cacheonly` option stops the query from using the network.
extract_installed() {
    local dest="$1"
    local status=0

    log "Reading the requested packages"
    # Sort on the host. The container status is then the status of dnf. A shell
    # in the image can be dash or ash, which have no pipefail option.
    docker run \
        --entrypoint /bin/sh \
        --network none \
        --rm \
        "$image" -c \
        'command -v dnf >/dev/null 2>&1 || exit 3
         dnf repoquery --cacheonly --userinstalled --qf "%{name}\n"' |
        LC_ALL=C sort >"$dest" || status="${PIPESTATUS[0]}"

    # Docker reports 125, 126, or 127 when it cannot start the command. An
    # image without a shell gives one of those values.
    if ((status == 3)) || ((status >= 125 && status <= 127)); then
        log "The image has no shell or no dnf command. The notes omit that section."
        : >"$dest"
    elif ((status != 0)); then
        die "could not read the requested packages from ${image}"
    elif [[ ! -s "$dest" ]]; then
        log "The image reports no requested packages. The notes omit that section."
    fi
}

# Run the image-specific script in the image. The script prints the extra rows
# for the component table.
extract_components() {
    local dest="$1"
    local script_dir
    local script_name

    [[ -n "$components_script" ]] || return 0
    [[ -f "$components_script" ]] || die "components script not found: ${components_script}"

    script_dir="$(cd "$(dirname "$components_script")" && pwd)"
    script_name="$(basename "$components_script")"

    log "Running ${script_name} in the image"
    docker run \
        --entrypoint /bin/sh \
        --network none \
        --rm \
        --volume "${script_dir}/${script_name}:/tmp/components.sh:ro" \
        "$image" /tmp/components.sh >"$dest" ||
        die "the components script failed"
}

write_component_table() {
    local notes="$1"
    local sbom="$2"
    local packages="$3"
    local name
    local version

    {
        printf '## Image Components\n\n'
        printf '| Component | Version |\n'
        printf '| --- | --- |\n'

        # Syft records the operating system as a component of its own. Syft
        # writes the name in lower case, so make the first letter upper case.
        jq -r '
            (.components // [])[]
            | select(.type == "operating-system")
            | "| \(.name[0:1] | ascii_upcase)\(.name[1:]) | \(.version) |"
        ' "$sbom"

        for name in ${highlights[@]+"${highlights[@]}"}; do
            version="$(package_version "$packages" "$name")"
            [[ -n "$version" ]] || version="not installed"
            printf '| %s | %s |\n' "$name" "$version"
        done

        if [[ -s "$components" ]]; then
            awk -F '\t' 'NF >= 2 { printf "| %s | %s |\n", $1, $2 }' "$components"
        fi

        printf '\n'
    } >>"$notes"
}

write_package_table() {
    local notes="$1"
    local packages="$2"
    local count
    local name
    local version

    if [[ ! -s "$installed" ]]; then
        return 0
    fi

    count="$(wc -l <"$installed" | tr -d ' ')"

    {
        printf '## Requested Packages\n\n'
        printf 'The image build installs these %s packages by name.\n' "$count"
        printf 'The package manager installs the other packages as dependencies.\n\n'
        printf '| Package | Version |\n'
        printf '| --- | --- |\n'

        while IFS= read -r name; do
            version="$(package_version "$packages" "$name")"
            # Show a row for each name. The count above must agree with the rows.
            [[ -n "$version" ]] || version="not installed"
            printf '| %s | %s |\n' "$name" "$version"
        done <"$installed"

        printf '\n'
    } >>"$notes"
}

# Compare the two SBOMs with the CycloneDX CLI. The CLI groups each component
# name into added, removed, and unchanged versions.
write_change_table() {
    local notes="$1"
    local current="$2"
    local previous="$3"
    local tag="$4"
    local added
    local changed
    local label
    local removed
    local work

    # Name the previous release in the heading when the caller supplies the tag.
    label="## Package Changes"
    [[ -n "$tag" ]] && label="## Package Changes Since ${tag}"

    work="$(cd "$(dirname "$current")" && pwd)"
    diff_json="$(mktemp --tmpdir image-diff-XXXXXX.json)"

    docker run \
        --network none \
        --rm \
        --volume "${work}:/bom:ro" \
        "$CYCLONEDX_IMAGE" diff \
        "/bom/$(basename "$previous")" \
        "/bom/$(basename "$current")" \
        --component-versions \
        --output-format json >"$diff_json" ||
        die "the CycloneDX CLI could not compare the two SBOMs"

    # The CycloneDX CLI groups the versions of each name into added, removed,
    # and unchanged. The previous release therefore has the removed versions
    # and the unchanged versions. This release has the added versions and the
    # unchanged versions. Compare those two sets.
    changed="$(jq -r '
        .componentVersions
        | to_entries
        | sort_by(.key)[]
        | (.value.removed + .value.unchanged | map(.version) | unique) as $old
        | (.value.added + .value.unchanged | map(.version) | unique) as $new
        | select(($old | length) > 0 and ($new | length) > 0 and $old != $new)
        | "| \(.key) | \($old | join(", ")) | \($new | join(", ")) |"
    ' "$diff_json")"

    # A package counts as added or removed only when no version of it stays.
    # A package that keeps one version and loses another version is a changed
    # package.
    added="$(format_change "$diff_json" added removed)"
    removed="$(format_change "$diff_json" removed added)"

    {
        printf '%s\n\n' "$label"

        if [[ -z "$changed" && "$added" == "$none_text" && "$removed" == "$none_text" ]]; then
            printf 'No packages changed.\n\n'
        else
            if [[ -n "$changed" ]]; then
                printf '| Package | Old | New |\n'
                printf '| --- | --- | --- |\n'
                printf '%s\n\n' "$changed"
            fi

            printf '**Added:**%s\n\n' "$added"
            printf '**Removed:**%s\n\n' "$removed"
        fi
    } >>"$notes"
}

# Print the components that are in only one of the two SBOMs. A component that
# keeps a version in both SBOMs is not added and not removed. That component
# goes in the change table.
format_change() {
    local file="$1"
    local present="$2"
    local other="$3"
    local value

    value="$(jq -r --arg present "$present" --arg other "$other" '
        [.componentVersions | to_entries[]
         | select(
               (.value[$present] | length) > 0
               and (.value[$other] + .value.unchanged | length) == 0
           )
         | "\(.key) \([.value[$present][].version] | unique | join(", "))"]
        | sort
        | join(", ")
    ' "$file")"

    if [[ -z "$value" ]]; then
        printf '%s' "$none_text"
    else
        printf ' %s' "$value"
    fi
}

write_sbom_note() {
    local notes="$1"
    local sbom="$2"
    local total
    local typed

    total="$(jq '[(.components // [])[] | select(.purl != null)] | length' "$sbom")"
    typed="$(jq --arg type "pkg:${package_type}/" '
        [(.components // [])[] | select(.purl != null and (.purl | startswith($type)))] | length
    ' "$sbom")"

    {
        # The backticks below are Markdown code marks, not a command.
        # shellcheck disable=SC2016
        printf 'The `%s` file is a CycloneDX SBOM for this image.\n' "$(basename "$sbom")"
        printf 'The SBOM contains %s packages.\n' "$total"
        printf 'The SBOM contains %s %s packages.\n' "$typed" "$package_type"
    } >>"$notes"
}

main() {
    while (($# > 0)); do
        case "$1" in
        --components-script)
            need_value "$@"
            components_script="$2"
            shift 2
            ;;
        --cyclonedx-image)
            need_value "$@"
            CYCLONEDX_IMAGE="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        --highlights)
            need_value "$@"
            # Split the names on the spaces. Stop the shell from expanding a
            # name that contains a wildcard character.
            set -f
            # shellcheck disable=SC2206
            highlights=($2)
            set +f
            shift 2
            ;;
        --image)
            need_value "$@"
            image="$2"
            shift 2
            ;;
        --notes)
            need_value "$@"
            notes_path="$2"
            shift 2
            ;;
        --package-type)
            need_value "$@"
            package_type="$2"
            shift 2
            ;;
        --previous-sbom)
            need_value "$@"
            previous_sbom="$2"
            shift 2
            ;;
        --previous-tag)
            need_value "$@"
            previous_tag="$2"
            shift 2
            ;;
        --sbom)
            need_value "$@"
            sbom_path="$2"
            shift 2
            ;;
        --syft-image)
            need_value "$@"
            SYFT_IMAGE="$2"
            shift 2
            ;;
        *)
            usage >&2
            die "unknown option: $1"
            ;;
        esac
    done

    [[ -n "$image" ]] || {
        usage >&2
        die "--image is required"
    }

    require_cmd awk
    require_cmd docker
    require_cmd jq

    sbom_path="${sbom_path:-build/release/sbom.cdx.json}"
    notes_path="${notes_path:-build/release/notes.md}"

    mkdir -p "$(dirname "$sbom_path")" "$(dirname "$notes_path")"

    installed="$(mktemp --tmpdir image-installed-XXXXXX)"
    components="$(mktemp --tmpdir image-components-XXXXXX)"
    trap remove_temp_files EXIT

    extract_sbom "$sbom_path"

    # Keep the filtered SBOMs next to the SBOM. The CycloneDX CLI reads them
    # from one bind mount.
    current_packages="$(dirname "$sbom_path")/.current-packages.cdx.json"
    filter_packages "$sbom_path" "$current_packages"

    extract_installed "$installed"
    extract_components "$components"

    : >"$notes_path"
    write_component_table "$notes_path" "$sbom_path" "$current_packages"
    write_package_table "$notes_path" "$current_packages"

    if [[ -n "$previous_sbom" && -s "$previous_sbom" ]]; then
        previous_packages="$(dirname "$sbom_path")/.previous-packages.cdx.json"
        filter_packages "$previous_sbom" "$previous_packages"
        write_change_table "$notes_path" "$current_packages" "$previous_packages" "$previous_tag"
    else
        log "The caller supplied no previous SBOM. The notes omit the package changes."
    fi

    write_sbom_note "$notes_path" "$sbom_path"

    log "Wrote the SBOM to ${sbom_path}"
    log "Wrote the release notes to ${notes_path}"
}

main "$@"
