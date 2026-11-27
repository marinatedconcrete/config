#!/usr/bin/env sh
set -eu

# Print the Devcontainer Base components for the release notes. This script runs
# in the image. Each line contains a label, a tab, and a version.

row() {
    [ -n "$2" ] || return 0
    printf '%s\t%s\n' "$1" "$2"
}

row "just" "$(just --version 2>/dev/null | sed -n 's/^just //p' | head -n 1)"
