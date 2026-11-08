#!/usr/bin/env bash
set -euo pipefail

# Read the existing tag names on standard input. Print the next CalVer version
# for the tag prefix in $1. The prefix is the image name, a hyphen, and the
# month. For example, the prefix `devcontainer-base-2026.11` gives `2026.11.0`
# when no tag exists, and `2026.11.10` after the tag `...-2026.11.9`.

prefix="${1:?usage: <tag names> | next-calver-version.sh <name-YYYY.M>}"

max=-1
while IFS= read -r tag || [[ -n "$tag" ]]; do
    if [[ "$tag" =~ ^${prefix//./\\.}\.([0-9]+)$ ]]; then
        number=$((10#${BASH_REMATCH[1]}))
        if ((number > max)); then
            max=$number
        fi
    fi
done

printf '%s.%d\n' "${prefix##*-}" $((max + 1))
