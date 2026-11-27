---
title: kcov drops script lines after a quoted string inside "$(...)"
type: gotcha
layer: project
state: approved
tags: [repo:marinatedconcrete/config, kcov, coverage, shell, jq]
source: SimonKagstrom/kcov#519, marinatedconcrete/config#1176
scope:
  paths: [actions/**, .github/scripts/**, scripts/**, .coverage-thresholds.json]
  labels: [area/dev-tooling, area/actions, area/release-tooling]
  lanes: []
---

The coverage gate uses kcov to measure the line coverage of shell scripts. The kcov bash parser has a defect (SimonKagstrom/kcov#519, open). For the parser, a `"` in an inner string closes the outer `"$(...)"` string, and a later quote opens a new string. kcov then drops the lines after it from the report, but bash runs those lines.

A `jq` program of more than one line in single quotes inside `"$(...)"` caused the defect in `actions/image-release-notes/release-notes.sh`. kcov found 162 lines with the program inline and 281 lines after the move to a file (#1176).

- Put a `jq` program of more than one line in its own `.jq` file, and read it with `jq -f`. For an example, see `actions/image-release-notes/changed-components.jq` and the `jq -r -f` call in `release-notes.sh`.
- The gate fails when kcov finds fewer lines in a script than `shell.minFoundLines` in `.coverage-thresholds.json` gives. After a script change, this defect can cause that failure.

For the coverage gate and the floors, see [release tooling](../qa/release-tooling.md).
