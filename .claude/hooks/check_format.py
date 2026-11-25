"""Block a git or jj commit or push when `just check-format` fails.

check-format.sh starts this script. Claude Code sends the hook input as JSON on stdin.

The check reads the working tree. It does not read the index or the revisions that a push sends.
The hook does not find these command forms: `git merge`, `git rebase`, `git cherry-pick`,
`gh pr merge`, git and jj aliases, commands that a variable or `eval` builds,
backtick substitution, and a substitution inside double quotes.
"""

import json
import os
import re
import shlex
import shutil
import subprocess
import sys

SEPARATORS = set(";&|()\n")
ASSIGNMENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")
PREFIX_WORDS = {"command", "env", "exec", "sudo"}
SHELLS = {"bash", "sh", "zsh"}
GIT_FLAGS = {"--no-pager", "-P", "--no-optional-locks"}
GIT_OPTIONS_WITH_VALUE = {"-c", "--git-dir", "--work-tree"}
JJ_FLAGS = {"--no-pager", "--ignore-working-copy"}
JJ_OPTIONS_WITH_VALUE = {"--color", "--config", "--at-op", "--at-operation"}
CHECK_TIMEOUT_SECONDS = 100
ADVICE = "To check the format, run `just check-format` in the devcontainer."


def segments(command_line):
    """Split a shell command line into simple commands, as lists of words."""
    lexer = shlex.shlex(
        command_line.replace("\\\n", " "), posix=True, punctuation_chars=";&|()\n"
    )
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = ""
    words = []
    for token in lexer:
        if set(token) <= SEPARATORS:
            if words:
                yield words
            words = []
        else:
            words.append(token)
    if words:
        yield words


def strip_prefix(words):
    i = 0
    while i < len(words) and (
        ASSIGNMENT.match(words[i]) or words[i] in PREFIX_WORDS
    ):
        i += 1
    if i == len(words):
        return None, []
    return os.path.basename(words[i]), words[i + 1 :]


def option_value(args, i, name):
    """Return the value of option `args[i]` and the index after it."""
    if args[i] == name:
        return (args[i + 1] if i + 1 < len(args) else ""), i + 2
    return args[i][len(name) + 1 :], i + 1


def git_target(args, directory):
    i = 0
    while i < len(args) and args[i].startswith("-"):
        if args[i] == "-C":
            path, i = option_value(args, i, "-C")
            directory = os.path.join(directory, os.path.expanduser(path))
        elif args[i] in GIT_OPTIONS_WITH_VALUE:
            i += 2
        else:
            i += 1
    if i < len(args) and args[i] in ("commit", "push"):
        return directory
    return None


def jj_target(args, directory):
    i = 0
    while i < len(args) and args[i].startswith("-"):
        name = args[i].split("=", 1)[0]
        if name in ("-R", "--repository"):
            path, i = option_value(args, i, name)
            directory = os.path.join(directory, os.path.expanduser(path))
        elif name in JJ_OPTIONS_WITH_VALUE and "=" not in args[i]:
            i += 2
        else:
            i += 1
    rest = args[i:]
    if rest[:1] in (["commit"], ["ci"]) or rest[:2] == ["git", "push"]:
        return directory
    return None


def shell_script(args):
    for i, arg in enumerate(args):
        if not arg.startswith("-"):
            return None
        if not arg.startswith("--") and "c" in arg:
            return args[i + 1] if i + 1 < len(args) else None
    return None


def find_targets(command_line, directory):
    """Return the directories where the command line commits or pushes.

    A `cd` changes the directory for the segments after it.
    A `cd` inside parentheses also stays in effect after the closing parenthesis.
    After a `just format` segment, the function stops: the agent formats before it commits.
    """
    targets = []
    for words in segments(command_line):
        program, args = strip_prefix(words)
        if program == "cd" and args and args[0] != "-":
            directory = os.path.join(directory, os.path.expanduser(args[0]))
        elif program == "just" and args[:1] == ["format"]:
            break
        elif program == "git":
            targets.append(git_target(args, directory))
        elif program == "jj":
            targets.append(jj_target(args, directory))
        elif program in SHELLS:
            script = shell_script(args)
            if script is not None:
                targets.extend(find_targets(script, directory))
    return [target for target in targets if target is not None]


def repository_root(directory):
    for root_command in (["git", "rev-parse", "--show-toplevel"], ["jj", "root"]):
        try:
            result = subprocess.run(
                root_command, cwd=directory, capture_output=True, text=True
            )
        except OSError:
            continue
        if result.returncode == 0:
            return result.stdout.strip()
    return None


def skip_reason(root):
    if root is None:
        return "no git or jj repository was found"
    for tool in ("just", "pnpm"):
        if shutil.which(tool) is None:
            return f"`{tool}` is missing"
    if not os.path.exists(os.path.join(root, "node_modules", ".bin", "prettier")):
        return f"`node_modules/.bin/prettier` is missing in {root}"
    return None


def check(root):
    """Return a block message, or None when the format check passes."""
    result = subprocess.run(
        ["just", "check-format"],
        cwd=root,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        errors="replace",
        timeout=CHECK_TIMEOUT_SECONDS,
    )
    if result.returncode == 0:
        return None
    tail = "\n".join(result.stdout.splitlines()[-20:])
    return (
        f"`just check-format` failed in {root} with exit status {result.returncode}.\n"
        f"The last 20 lines of its output follow.\n{tail}\n"
        "If the output shows a format error, run `just format`, then try again."
    )


def notice(reason):
    text = f"The format check did not run because {reason}. {ADVICE}"
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "additionalContext": text,
                },
                "systemMessage": text,
            }
        )
    )


def main():
    try:
        hook_input = json.load(sys.stdin)
        command_line = hook_input.get("tool_input", {}).get("command", "")
        targets = find_targets(command_line, hook_input.get("cwd") or os.getcwd())
    except Exception:
        # Before a match, an error must not block an unrelated command.
        return 0
    try:
        roots = []
        for target in targets:
            root = repository_root(target)
            if root not in roots:
                roots.append(root)
        reasons = []
        for root in roots:
            reason = skip_reason(root)
            if reason is not None:
                reasons.append(reason)
                continue
            message = check(root)
            if message is not None:
                print(message, file=sys.stderr)
                return 2
        if reasons:
            # Claude Code reads stdout as JSON only when it holds one object.
            notice(" and ".join(reasons))
        return 0
    except Exception as error:
        print(
            f"The format hook failed before the format check finished: {error!r}. {ADVICE}",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
