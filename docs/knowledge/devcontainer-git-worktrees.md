---
title: Git does not work in a devcontainer that you open on a git worktree
type: gotcha
layer: project
state: approved
tags: [repo:marinatedconcrete/config, devcontainer, git, lint]
source: Reproduced with devcontainer exec on a git worktree of main (2026-11-27)
scope:
  paths: [.devcontainer/**, justfile, scripts/path-policy.mjs]
  labels: [area/dev-tooling]
  lanes: []
---

A git worktree has a `.git` file, not a `.git` directory. The file holds the absolute host path of the main repository. The devcontainer mounts only the worktree, at `/workspaces/<name>`. Thus git in the container cannot find the repository:

```text
fatal: gitfile does not point to a valid repository: /workspaces/<name>/.git
```

These recipes call git, so they fail in that container:

- `just path-policy-lint`. `scripts/path-policy.mjs` runs `git ls-files`.
- `just renovate-lint`. `scripts/renovate-checks.mjs` runs `git ls-files`.
- `just lint`, because it runs the two recipes above.

Recipes that do not call git work, for example `just check-format`.

To run the checks for a worktree, do one of these steps:

- Run the Node scripts on the host, for example `node scripts/path-policy.mjs check`.
- Open the devcontainer on the main checkout, not on the worktree.
