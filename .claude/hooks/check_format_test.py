"""Tests for the format hook. They run check-format.sh as Claude Code does.

Run: python3 -m unittest discover -s .claude/hooks -p '*_test.py'
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import check_format

HOOK_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
HOOK_FILES = ("check-format.sh", "check_format.py")
HOST_TOOLS = ("bash", "env", "dirname", "grep", "git", "python3")

JUST_STUB = """#!/bin/sh
pwd > "$JUST_LOG"
echo "$JUST_OUTPUT"
exit "${JUST_EXIT:-0}"
"""


# The real devcontainer CLI 0.91.0 writes this text to stderr and exits with status 1.
NOT_FOUND = """[2026-11-25T06:42:56.055Z] Error: Dev container not found.
    at pg (/cli/dist/spec-node/devContainersSpecCLI.js:479:1484)
    at async cZ (/cli/dist/spec-node/devContainersSpecCLI.js:678:4001)
"""

# For a stopped container, the real CLI writes this text to stderr and exits with status 1.
STOPPED = """Shell server terminated (code: 1, signal: null)

Error response from daemon: container 13770ca8025c is not running

[2026-11-25T06:47:54.351Z] Shell server terminated (code: 1, signal: null)

Error response from daemon: container 13770ca8025c is not running
"""

DEVCONTAINER_STUB = f"""#!/usr/bin/env python3
import json, os, sys, time
args = sys.argv[1:]
with open(os.environ["DEVCONTAINER_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
mode = os.environ["DEVCONTAINER_MODE"]
if mode in ("missing", "stopped"):
    sys.stderr.write({NOT_FOUND!r} if mode == "missing" else {STOPPED!r})
    sys.exit(1)
if args[-1:] == ["true"]:
    sys.exit(0)
if mode == "hang":
    time.sleep(30)
print(os.environ["JUST_OUTPUT"])
sys.exit(0 if mode == "pass" else 1)
"""


def write_executable(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as file:
        file.write(text)
    os.chmod(path, 0o755)


def git(*args):
    subprocess.run(
        ["git", "-c", "user.name=test", "-c", "user.email=test@example.com", *args],
        check=True,
        capture_output=True,
    )


def make_repo(path):
    os.makedirs(os.path.join(path, "sub"))
    os.makedirs(os.path.join(path, "a"))
    git("init", "-q", path)
    git("-C", path, "commit", "-q", "--allow-empty", "-m", "init")
    add_prettier(path)


def add_prettier(path):
    write_executable(os.path.join(path, "node_modules", ".bin", "prettier"), "")


def install_hook(repo):
    """Copy the hook into a repository. That repository is then the project of the hook."""
    hooks = os.path.join(repo, ".claude", "hooks")
    os.makedirs(hooks)
    for name in HOOK_FILES:
        shutil.copy2(os.path.join(HOOK_DIRECTORY, name), hooks)
    return os.path.join(hooks, "check-format.sh")


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
        self.hook = install_hook(self.repo)
        self.tools = os.path.join(self.tmp, "tools")
        os.makedirs(self.tools)
        for tool in HOST_TOOLS:
            os.symlink(shutil.which(tool), os.path.join(self.tools, tool))
        self.stubs = os.path.join(self.tmp, "stubs")
        write_executable(os.path.join(self.stubs, "just"), JUST_STUB)
        write_executable(os.path.join(self.stubs, "pnpm"), "#!/bin/sh\n")
        self.just_log = os.path.join(self.tmp, "just.log")
        self.devcontainer_log = os.path.join(self.tmp, "devcontainer.log")

    def run_hook(self, command_line, cwd=None, just_exit=1, stdin=None, mode="fail"):
        for log in (self.just_log, self.devcontainer_log):
            if os.path.exists(log):
                os.remove(log)
        env = {
            "PATH": self.stubs + os.pathsep + self.tools,
            "HOME": self.tmp,
            "CLAUDE_PROJECT_DIR": self.other_repo,
            "JUST_LOG": self.just_log,
            "JUST_EXIT": str(just_exit),
            "JUST_OUTPUT": "Code style issues found in README.md.",
            "DEVCONTAINER_LOG": self.devcontainer_log,
            "DEVCONTAINER_MODE": mode,
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
            [self.hook], input=stdin, capture_output=True, text=True, env=env, timeout=60
        )

    def use_devcontainer(self):
        """Remove `pnpm` from the host and add a stub `devcontainer` CLI."""
        os.remove(os.path.join(self.stubs, "pnpm"))
        write_executable(os.path.join(self.stubs, "devcontainer"), DEVCONTAINER_STUB)

    def devcontainer_calls(self):
        if not os.path.exists(self.devcontainer_log):
            return []
        with open(self.devcontainer_log) as log:
            return [json.loads(line) for line in log]

    def notice_text(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        context = output["hookSpecificOutput"]["additionalContext"]
        self.assertEqual(output["systemMessage"], context)
        self.assertIn("did not run", context)
        return context

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

    def assert_outside_notice(self, result, root):
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(os.path.exists(self.just_log))
        output = json.loads(result.stdout)
        context = output["hookSpecificOutput"]["additionalContext"]
        self.assertIn("did not run", context)
        self.assertIn(f"repository in {os.path.realpath(root)}, which is outside", context)
        self.assertEqual(output["systemMessage"], context)

    def test_skips_repository_outside_project(self):
        for command_line, cwd in [
            ("git commit -m x", self.other_repo),
            (f"git -C {self.other_repo} commit -m x", self.repo),
            (f"cd {self.other_repo} && git push", self.repo),
            (f"jj -R {self.other_repo} commit", self.repo),
        ]:
            with self.subTest(command_line):
                self.assert_outside_notice(
                    self.run_hook(command_line, cwd=cwd), self.other_repo
                )

    def test_skips_clone_of_project(self):
        clone = os.path.join(self.tmp, "clone")
        git("clone", "-q", self.repo, clone)
        add_prettier(clone)
        self.assert_outside_notice(self.run_hook("git commit -m x", cwd=clone), clone)

    def test_checks_linked_worktree(self):
        worktree = os.path.join(self.tmp, "elsewhere", "worktree")
        git("-C", self.repo, "worktree", "add", "-q", worktree)
        add_prettier(worktree)
        result = self.run_hook("git commit -m x", cwd=worktree)
        self.assertEqual(result.returncode, 2, result.stderr)
        with open(self.just_log) as log:
            self.assertEqual(log.read().strip(), os.path.realpath(worktree))

    @unittest.skipUnless(shutil.which("jj"), "jj is missing")
    def test_checks_jj_workspace(self):
        os.symlink(shutil.which("jj"), os.path.join(self.tools, "jj"))
        repo = os.path.join(self.tmp, "jj-repo")
        workspace = os.path.join(self.tmp, "jj-workspace")
        jj_commands = [
            ["jj", "git", "init", "--no-colocate", repo],
            ["jj", "-R", repo, "workspace", "add", workspace],
        ]
        for command in jj_commands:
            subprocess.run(command, check=True, capture_output=True)
        self.hook = install_hook(repo)
        add_prettier(workspace)
        result = self.run_hook("jj commit", cwd=workspace)
        self.assertEqual(result.returncode, 2, result.stderr)
        with open(self.just_log) as log:
            self.assertEqual(log.read().strip(), os.path.realpath(workspace))
        self.assert_outside_notice(
            self.run_hook("jj commit", cwd=self.other_repo), self.other_repo
        )

    def test_devcontainer_runs_check_when_host_has_no_pnpm(self):
        self.use_devcontainer()
        result = self.run_hook("git commit -m x", mode="pass")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        root = os.path.realpath(self.repo)
        probe, run = self.devcontainer_calls()
        self.assertEqual(probe, ["exec", "--workspace-folder", root, "true"])
        self.assertEqual(run[:3], ["exec", "--workspace-folder", root])
        self.assertEqual(run[-1], ".")
        self.assertFalse(os.path.exists(self.just_log))

    def test_devcontainer_check_failure_blocks(self):
        self.use_devcontainer()
        result = self.run_hook("git push", mode="fail")
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn(
            f"`just check-format` failed in {os.path.realpath(self.repo)} in the devcontainer",
            result.stderr,
        )
        self.assertIn("Code style issues found in README.md.", result.stderr)

    def test_host_failure_names_the_host(self):
        result = self.run_hook("git push")
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("on the host with exit status 1", result.stderr)

    def test_no_running_devcontainer_shows_notice(self):
        self.use_devcontainer()
        context = self.notice_text(self.run_hook("git commit -m x", mode="missing"))
        root = os.path.realpath(self.repo)
        self.assertIn("`pnpm` is missing on the host", context)
        self.assertIn("reported: Dev container not found.", context)
        self.assertIn(f"run `devcontainer up --workspace-folder {root}`", context)
        self.assertEqual(len(self.devcontainer_calls()), 1)
        context = self.notice_text(self.run_hook("git commit -m x", mode="stopped"))
        self.assertIn(
            "reported: Error response from daemon: container 13770ca8025c is not running",
            context,
        )
        self.assertIn(f"run `devcontainer up --workspace-folder {root}`", context)

    def test_missing_devcontainer_cli_shows_notice(self):
        os.remove(os.path.join(self.stubs, "just"))
        context = self.notice_text(self.run_hook("git commit -m x"))
        self.assertIn("`just` is missing on the host and the `devcontainer` CLI is missing", context)

    def test_host_tools_skip_devcontainer(self):
        write_executable(os.path.join(self.stubs, "devcontainer"), DEVCONTAINER_STUB)
        result = self.run_hook("git commit -m x", just_exit=0, mode="pass")
        self.assertEqual((result.returncode, result.stdout), (0, ""))
        self.assertTrue(os.path.exists(self.just_log))
        self.assertEqual(self.devcontainer_calls(), [])

    def test_devcontainer_checks_worktree_inside_root(self):
        self.use_devcontainer()
        base = os.path.join(self.tmp, "with space")
        self.repo = os.path.join(base, "repo")
        make_repo(self.repo)
        self.hook = install_hook(self.repo)
        worktree = os.path.join(self.repo, ".claude", "worktrees", "a b")
        git("-C", self.repo, "worktree", "add", "-q", "--detach", worktree)
        add_prettier(worktree)
        result = self.run_hook("git commit -m x", cwd=worktree, mode="pass")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        run = self.devcontainer_calls()[-1]
        self.assertEqual(run[:3], ["exec", "--workspace-folder", os.path.realpath(self.repo)])
        self.assertEqual(run[-1], os.path.join(".claude", "worktrees", "a b"))

    def test_devcontainer_skips_worktree_outside_root(self):
        self.use_devcontainer()
        worktree = os.path.join(self.tmp, "elsewhere", "worktree")
        git("-C", self.repo, "worktree", "add", "-q", worktree)
        add_prettier(worktree)
        context = self.notice_text(self.run_hook("git commit -m x", cwd=worktree, mode="pass"))
        self.assertIn(f"does not mount {os.path.realpath(worktree)}", context)
        self.assertEqual(self.devcontainer_calls(), [])

    def test_devcontainer_skips_repository_outside_project(self):
        self.use_devcontainer()
        self.assert_outside_notice(
            self.run_hook("git commit -m x", cwd=self.other_repo, mode="pass"),
            self.other_repo,
        )
        self.assertEqual(self.devcontainer_calls(), [])

    def test_devcontainer_timeout_blocks(self):
        self.use_devcontainer()
        env = {
            "PATH": self.stubs + os.pathsep + self.tools,
            "DEVCONTAINER_LOG": self.devcontainer_log,
            "DEVCONTAINER_MODE": "hang",
            "JUST_OUTPUT": "",
        }
        job = check_format.Check(
            self.repo, "in the devcontainer", ["devcontainer", "exec", "sh"]
        )
        with mock.patch.dict(os.environ, env), mock.patch.object(
            check_format, "CHECK_TIMEOUT_SECONDS", 1
        ):
            message = check_format.check(job)
        self.assertIn("did not finish", message)
        self.assertIn("in the devcontainer in 1 seconds", message)


if __name__ == "__main__":
    unittest.main()
