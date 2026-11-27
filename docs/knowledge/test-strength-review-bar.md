---
title: Reviewers reject a test that still passes when the code under test is broken
type: pattern
layer: project
state: approved
tags: [repo:marinatedconcrete/config, testing, review]
source: Reviews on marinatedconcrete/config#1141, marinatedconcrete/config#1142, marinatedconcrete/config#1146, marinatedconcrete/config#1164, marinatedconcrete/config#1173
scope:
  paths: [scripts/**, .github/release/**, .github/scripts/**, actions/**]
  labels: [area/dev-tooling, area/release-tooling, area/actions]
  lanes: []
---

Reviewers often break the code under test in a temporary copy and run the tests again. If the tests still pass, the review asks for a stronger test. Do the same check before you push.

Reviewers asked for these patterns:

- A stub records its arguments, and the test asserts them. A stub that returns the next page for each request let a page step of two pass (#1142).
- A callback that must not run calls `assert.fail`, for example `promote: () => assert.fail("unexpected image promotion")`. An empty callback let an early write pass (#1146).
- A command-line entry point has a test that starts it in a subprocess, as the workflow does. A test that imports `run()` passes when the entry check skips `run()` (#1141).
- A test value shows the defect. In bash, `.007` gives the same result with or without the `10#` prefix, but `.008` does not (#1164).
- A tool deletes only what it created. Make a new directory with `mkdtemp` under the directory that the user gives. Do not delete files in the user's directory (#1173).
