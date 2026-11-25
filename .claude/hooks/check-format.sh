#!/usr/bin/env bash
# Claude Code runs this hook before each Bash command.
# It blocks a commit or a push when the format check fails.
# It covers both git (Hive) and jj (people).
set -euo pipefail

command=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))')

# A match that is too wide only costs one format check.
# jj has no staging area. It records the working copy at each command, so the check reads the real files.
pattern='(^|[^[:alnum:]_-])(git|jj)[[:space:]]+(.*[[:space:]])?(commit|push|ci)([[:space:]]|$)'
if ! grep -Eq "${pattern}" <<<"${command}"; then
    exit 0
fi

if ! command -v just >/dev/null || ! command -v pnpm >/dev/null; then
    echo "Format check skipped: just or pnpm is missing. Run \`just check-format\` in the devcontainer." >&2
    exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
if ! output=$(just check-format 2>&1); then
    echo "The format check failed. Run \`just format\`, then try again." >&2
    tail -n 20 <<<"${output}" >&2
    exit 2
fi
