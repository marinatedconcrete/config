---
title: Index of the knowledge entries for marinatedconcrete/config
type: reference
layer: project
state: draft
tags: [repo:marinatedconcrete/config, index]
source: docs/knowledge/
scope:
  paths: [docs/knowledge/**]
  labels: [area/docs]
  lanes: []
---

# Knowledge entries

Each file in this directory is one knowledge entry for agents. The format is the [Hive knowledge entry format](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-entries.md). This index has `state: draft`, so Hive does not put it in the primer.

- [component-tests-on-github-runners.md](component-tests-on-github-runners.md): Remove the host Mosquitto AppArmor profile in each job that runs component tests on a GitHub runner.
- [devcontainer-git-worktrees.md](devcontainer-git-worktrees.md): Git and the recipes that use git fail in a devcontainer that you open on a git worktree.
- [kcov-shell-coverage.md](kcov-shell-coverage.md): kcov drops script lines after a quoted string inside `"$(...)"`. Put a `jq` program in a `.jq` file.
- [minikube-pinned-kubernetes-version.md](minikube-pinned-kubernetes-version.md): Each `minikube start` with the pinned Kubernetes version needs `--force`.
- [release-commit-types.md](release-commit-types.md): The commit types that make a Release Please release, and when to split a pull request.
- [test-strength-review-bar.md](test-strength-review-bar.md): Reviewers reject a test that still passes when the code under test is broken.
- [workflow-concurrency-for-writers.md](workflow-concurrency-for-writers.md): A job that writes shared state queues its runs and writes only for the head of `main`.
