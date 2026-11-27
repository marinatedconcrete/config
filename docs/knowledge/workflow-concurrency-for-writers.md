---
title: A workflow job that writes shared state queues its runs and writes only for the head of main
type: pattern
layer: project
state: approved
tags: [repo:marinatedconcrete/config, github-actions, concurrency, release]
source: GitHub workflow syntax for concurrency, reviews on marinatedconcrete/config#1004 and marinatedconcrete/config#1160
scope:
  paths: [.github/workflows/**, scripts/publish-badge.sh, .github/release/**]
  labels: [area/ci, area/release-tooling]
  lanes: []
---

A job that writes shared state, such as a tag, a release, a label, or a branch, must not lose a run. Give it this concurrency block:

```yaml
concurrency:
  group: <a name that is the same for each trigger>
  cancel-in-progress: false
  queue: max
```

- `cancel-in-progress: false` stops a new run from canceling an active write.
- `queue: max` keeps up to 100 pending runs. The default, `queue: single`, keeps one pending run and cancels the other pending runs. GitHub rejects `queue: max` together with `cancel-in-progress: true`.
- Do not put `github.event_name` in the group. With the event name in the group, a scheduled run and a manual run on `main` can write at the same time (review on #1004).

The queue does not check the commit of a run. For example, a rerun of an old run can write old data. Thus a publisher also writes only while its run is for the head of `main`. `scripts/publish-badge.sh` shows the pattern:

1. Read the ref of the target branch.
2. Read the head of `main`. If the head is not the commit of the run, stop and write nothing.
3. Put all changes in one commit.
4. Move the branch ref with a fast-forward update (`force=false`). If a different process moved the ref after step 1, the update fails.

For the concurrency rule of the release runs, see [release tooling](../qa/release-tooling.md).
