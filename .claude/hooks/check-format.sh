#!/usr/bin/env bash
# Claude Code runs this hook before each Bash command.
# check_format.py blocks a commit or a push when the format check fails.
# settings.json sets "onFailure": "block", so a hook that cannot start blocks every Bash command.
# This wrapper prevents that block when python3 is missing.
set -uo pipefail

if command -v python3 >/dev/null; then
    exec python3 -I "$(dirname "${BASH_SOURCE[0]}")/check_format.py"
fi

# Without python3, the hook cannot parse the command.
# Show the notice only when the input contains a word that can start a commit or a push.
if grep -Eqw 'commit|ci|push'; then
    reason='The format check did not run because python3 is missing.'
    # shellcheck disable=SC2016 # The backticks are Markdown, not command substitution.
    advice='To check the format, run `just check-format` in the devcontainer.'
    printf '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": "%s %s"}, "systemMessage": "%s %s"}\n' \
        "${reason}" "${advice}" "${reason}" "${advice}"
fi
exit 0
