"""Block a git or jj commit or push when `just check-format` fails.

check-format.sh starts this script. Claude Code sends the hook input as JSON on stdin.

The check reads the working tree. It does not read the index or the revisions that a push sends.
The hook does not find these command forms: `git merge`, `git rebase`, `git cherry-pick`,
`gh pr merge`, git and jj aliases, commands that a variable or `eval` builds,
backtick substitution, and a substitution inside double quotes.

The hook ignores the text of here-document bodies (`<<` and `<<-`).
When the delimiter has no quotes, the hook keeps the `$(...)` and backtick substitutions of the body.
The hook does not find a command in the lines after a `<<` in arithmetic, such as `$((1 << 2))`,
because it reads that `<<` as a here-document. It ignores here-documents inside backticks.

The hook runs `just check-format` only in the repository that contains the hook,
and in its linked git worktrees and jj workspaces. Each target repository supplies its own justfile.
Thus, for a repository outside this project, the hook shows a notice and does not run the check.
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
HEREDOC_WORD_END = set(" \t\n;&|()<>")
CHECK_TIMEOUT_SECONDS = 100
ADVICE = "To check the format, run `just check-format` in the devcontainer."


def read_heredoc_operator(text, i):
    """Read the `<<` operator at `text[i]` and its delimiter word.

    Return the here-document as (delimiter, strip_tabs, quoted), or None, and the index after the word.
    """
    j = i + 2
    strip_tabs = text.startswith("-", j)
    j += strip_tabs
    while j < len(text) and text[j] in " \t":
        j += 1
    word, quoted = [], False
    while j < len(text) and text[j] not in HEREDOC_WORD_END:
        if text[j] == "\\":
            quoted = True
            word.append(text[j + 1 : j + 2])
            j += 2
        elif text[j] in "'\"":
            end = text.find(text[j], j + 1)
            end = len(text) if end < 0 else end
            quoted = True
            word.append(text[j + 1 : end])
            j = end + 1
        else:
            word.append(text[j])
            j += 1
    if not word:
        return None, j
    return ("".join(word), strip_tabs, quoted), j


def substitutions(body):
    """Return the `$(...)` and backtick spans in a body, each in the `$(...)` form."""
    spans = []
    i = 0
    while i < len(body):
        if body.startswith("$(", i):
            depth, j = 1, i + 2
            while j < len(body) and depth:
                depth += {"(": 1, ")": -1}.get(body[j], 0)
                j += 1
            spans.append(body[i:j])
            i = j
        elif body[i] == "`":
            end = body.find("`", i + 1)
            end = len(body) if end < 0 else end
            spans.append(f"$({body[i + 1 : end]})")
            i = end + 1
        else:
            i += 2 if body[i] == "\\" else 1
    return spans


def skip_bodies(text, i, heredocs, out):
    """Skip the here-document bodies that start at `text[i]`. Return the index after them.

    The shell expands substitutions in a body only when the delimiter has no quotes.
    """
    for delimiter, strip_tabs, quoted in heredocs:
        body = []
        while i < len(text):
            end = text.find("\n", i)
            end = len(text) if end < 0 else end
            line = text[i:end]
            i = end + 1
            if (line.lstrip("\t") if strip_tabs else line) == delimiter:
                break
            body.append(line)
        if not quoted:
            out.extend(f"{span}\n" for span in substitutions("\n".join(body)))
    return min(i, len(text))


def strip_heredocs(text):
    """Return the command line without the text of its here-document bodies."""
    out = []
    # Each item is "dq" (in double quotes), "sub" (in `$(`), or "paren" (in `(`).
    stack = []
    heredocs = []
    i = 0
    while i < len(text):
        c = text[i]
        step = 1
        if c == "\\":
            step = 2
        elif text.startswith("$(", i):
            stack.append("sub")
            step = 2
        elif stack[-1:] == ["dq"]:
            if c == '"':
                stack.pop()
        elif c == "'":
            end = text.find("'", i + 1)
            step = (len(text) if end < 0 else end + 1) - i
        elif c == '"':
            stack.append("dq")
        elif c == "(":
            stack.append("paren")
        elif c == ")" and stack:
            stack.pop()
        elif text.startswith("<<<", i):
            step = 3
        elif text.startswith("<<", i):
            heredoc, end = read_heredoc_operator(text, i)
            if heredoc is not None:
                heredocs.append(heredoc)
            step = end - i
        elif c == "\n" and heredocs:
            out.append(c)
            i = skip_bodies(text, i + 1, heredocs, out)
            heredocs = []
            continue
        out.append(text[i : i + step])
        i += step
    return "".join(out)


def segments(command_line):
    """Split a shell command line into simple commands, as lists of words."""
    lexer = shlex.shlex(
        strip_heredocs(command_line).replace("\\\n", " "),
        posix=True,
        punctuation_chars=";&|()\n",
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


def output(command, directory):
    """Return the stripped stdout of a command, or None when it fails."""
    try:
        result = subprocess.run(
            command, cwd=directory, capture_output=True, text=True
        )
    except OSError:
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def repository_root(directory):
    return output(["git", "rev-parse", "--show-toplevel"], directory) or output(
        ["jj", "root", "--ignore-working-copy"], directory
    )


def repository_identities(root):
    """Return the stores that the repository at `root` uses, as ("git" or "jj", real path).

    All linked git worktrees share one common directory.
    All jj workspaces share one store. The `.jj/repo` of a secondary workspace is a file.
    That file holds the path of the store, relative to the `.jj` directory.
    """
    identities = set()
    common_dir = output(["git", "rev-parse", "--git-common-dir"], root)
    if common_dir:
        identities.add(("git", os.path.realpath(os.path.join(root, common_dir))))
    if output(["jj", "root", "--ignore-working-copy"], root):
        jj_dir = os.path.join(root, ".jj")
        store = os.path.join(jj_dir, "repo")
        if os.path.isfile(store):
            with open(store) as file:
                store = os.path.join(jj_dir, file.read().strip())
        identities.add(("jj", os.path.realpath(store)))
    return identities


def skip_reason(root, project):
    if root is None:
        return "no git or jj repository was found"
    if not project:
        return "the hook could not find the repository that contains it"
    identities = repository_identities(root)
    if not identities:
        return f"the hook could not identify the repository in {root}"
    if not identities & project:
        return f"the command targets the repository in {root}, which is outside this project"
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
    if not targets:
        return 0
    try:
        roots = []
        for target in targets:
            root = repository_root(target)
            if root not in roots:
                roots.append(root)
        reasons = []
        project_root = repository_root(os.path.dirname(os.path.realpath(__file__)))
        project = repository_identities(project_root) if project_root else set()
        for root in roots:
            reason = skip_reason(root, project)
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
