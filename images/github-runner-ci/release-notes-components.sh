#!/usr/bin/env sh
set -eu

row() {
    [ -n "$2" ] || return 0
    printf '%s\t%s\n' "$1" "$2"
}

row "Homebrew" "$(brew --version 2>/dev/null | sed -n 's/^Homebrew //p' | head -n 1)"
row "just" "$(just --version 2>/dev/null | sed -n 's/^just //p' | head -n 1)"
