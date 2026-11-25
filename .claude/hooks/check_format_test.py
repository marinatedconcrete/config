"""Tests for the format hook. They run check-format.sh as Claude Code does.

Run: python3 -m unittest discover -s .claude/hooks -p '*_test.py'
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check-format.sh")
HOST_TOOLS = ("bash", "env", "dirname", "grep", "git", "python3")

JUST_STUB = """#!/bin/sh
pwd > "$JUST_LOG"
echo "$JUST_OUTPUT"
exit "${JUST_EXIT:-0}"
"""


def write_executable(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as file:
        file.write(text)
    os.chmod(path, 0o755)


def make_repo(path):
    os.makedirs(os.path.join(path, "sub"))
    os.makedirs(os.path.join(path, "a"))
    subprocess.run(["git", "init", "-q", path], check=True)
    write_executable(os.path.join(path, "node_modules", ".bin", "prettier"), "")


class HookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.repo = os.path.join(self.tmp, "repo")
        self.other_repo = os.path.join(self.tmp, "other")
        self.outside = os.path.join(self.tmp, "outside")
        os.makedirs(self.outside)
        make_repo(self.repo)
        make_repo(self.other_repo)
        self.tools = os.path.join(self.tmp, "tools")
        os.makedirs(self.tools)
        for tool in HOST_TOOLS:
            os.symlink(shutil.which(tool), os.path.join(self.tools, tool))
        self.stubs = os.path.join(self.tmp, "stubs")
        write_executable(os.path.join(self.stubs, "just"), JUST_STUB)
        write_executable(os.path.join(self.stubs, "pnpm"), "#!/bin/sh\n")
        self.just_log = os.path.join(self.tmp, "just.log")

    def run_hook(self, command_line, cwd=None, just_exit=1, stdin=None):
        if os.path.exists(self.just_log):
            os.remove(self.just_log)
        env = {
            "PATH": self.stubs + os.pathsep + self.tools,
            "HOME": self.tmp,
            "CLAUDE_PROJECT_DIR": self.other_repo,
            "JUST_LOG": self.just_log,
            "JUST_EXIT": str(just_exit),
            "JUST_OUTPUT": "Code style issues found in README.md.",
        }
        if stdin is None:
            stdin = json.dumps(
                {
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Bash",
                    "tool_input": {"command": command_line},
                    "cwd": cwd or self.repo,
                }
            )
        return subprocess.run(
            [HOOK], input=stdin, capture_output=True, text=True, env=env, timeout=60
        )

    def test_blocks_commit_and_push_forms(self):
        commands = [
            "git commit -m x",
            f"git -C {self.repo} commit",
            "cd a && git push",
            "git push;",
            "(cd sub && git push)",
            "git push|tee log",
            'bash -c "git commit -m x"',
            "FOO=1 git commit",
            "/usr/bin/git commit",
            "jj commit",
            "jj ci",
            "jj git push",
            "git \\\ncommit",
            "git status\ngit push",
            "echo $(git commit -m x)",
        ]
        for command_line in commands:
            with self.subTest(command_line):
                cwd = self.outside if "-C" in command_line else self.repo
                result = self.run_hook(command_line, cwd=cwd)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("`just check-format` failed", result.stderr)
                self.assertIn("Code style issues found in README.md.", result.stderr)
                self.assertIn("run `just format`, then try again", result.stderr)

    def test_allows_other_commands(self):
        commands = [
            "git stash push",
            "git log --grep commit",
            "git commit-tree HEAD^{tree}",
            "git show -- ci",
            "echo git commit",
            "jj log -r push",
            "jj describe",
            "jj new",
            "git status",
            "ls",
            "just format && git commit -m x",
        ]
        for command_line in commands:
            with self.subTest(command_line):
                result = self.run_hook(command_line)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, "")
                self.assertFalse(os.path.exists(self.just_log))

    def test_passing_check_is_silent(self):
        result = self.run_hook("git commit -m x", just_exit=0)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_missing_pnpm_shows_notice(self):
        os.remove(os.path.join(self.stubs, "pnpm"))
        result = self.run_hook("git commit -m x")
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        context = output["hookSpecificOutput"]["additionalContext"]
        self.assertEqual(output["hookSpecificOutput"]["hookEventName"], "PreToolUse")
        self.assertIn("did not run", context)
        self.assertIn("`pnpm` is missing", context)
        self.assertIn("just check-format", context)
        self.assertEqual(output["systemMessage"], context)

    def test_missing_python_does_not_block(self):
        os.remove(os.path.join(self.tools, "python3"))
        result = self.run_hook("git commit -m x")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            "python3 is missing",
            json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"],
        )
        result = self.run_hook("ls")
        self.assertEqual((result.returncode, result.stdout), (0, ""))

    def test_bad_input_does_not_block(self):
        result = self.run_hook(None, stdin="not json")
        self.assertEqual((result.returncode, result.stdout), (0, ""))

    def test_internal_error_after_match_blocks(self):
        write_executable(os.path.join(self.stubs, "just"), "#!/nonexistent/sh\n")
        result = self.run_hook("git commit -m x", just_exit=0)
        self.assertEqual(result.returncode, 2)
        self.assertIn("The format hook failed", result.stderr)

    def test_heredocs(self):
        cases = [
            ("cat <<'EOF'\ngit commit -m x\nEOF\n", 0),
            ("cat <<'EOF'\ngit commit -m x\nEOF\ngit commit -m y", 2),
            ("git commit -m \"$(cat <<'EOF'\nIt's a \"message\".\nEOF\n)\"", 2),
            ("cat <<EOF\n$(git commit -m x)\nEOF\n", 2),
            ("cat <<-\"EOF\"\n\tgit commit -m x\n\tEOF\ngit push", 2),
            ("cat <<-\"EOF\"\n\tgit commit -m x\n\tEOF\n", 0),
            ("cat <<A <<\\B\ngit push\nA\ngit push\nB\n", 0),
            ("cat <<'EOF'\ngit commit -m x", 0),
        ]
        for command_line, status in cases:
            with self.subTest(command_line):
                result = self.run_hook(command_line)
                self.assertEqual(result.returncode, status, result.stderr)
                self.assertEqual(os.path.exists(self.just_log), status == 2)
                if status == 0:
                    self.assertEqual((result.stdout, result.stderr), ("", ""))

    def test_checks_repository_from_cwd(self):
        result = self.run_hook("git commit -m x", cwd=os.path.join(self.repo, "sub"))
        self.assertEqual(result.returncode, 2, result.stderr)
        with open(self.just_log) as log:
            self.assertEqual(log.read().strip(), os.path.realpath(self.repo))


if __name__ == "__main__":
    unittest.main()
