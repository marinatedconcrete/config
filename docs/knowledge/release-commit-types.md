---
title: Only some commit types make a Release Please release
type: reference
layer: project
state: approved
tags: [repo:marinatedconcrete/config, release-please, commits, pr-convention]
source: release-please-config.json, Release Please 17.6.0 changelog code, marinatedconcrete/config#1108, marinatedconcrete/config#1176
scope:
  paths: [actions/**, ansible/**, images/**, kustomization/**, renovate/**]
  labels: [area/release-tooling]
  lanes: []
---

A commit makes a release of a package when both of these conditions are true:

- The commit changes a file in the package path. `packages` in `release-please-config.json` lists the paths.
- The commit type is in `changelog-sections` in `release-please-config.json`.

The types in `changelog-sections` are `feat`, `fix`, `docs`, `build`, and `chore`. The title check also accepts `test`, `refactor`, `ci`, `style`, `perf`, and `revert`. These six types do not make a release. Their change goes out with the next release of the package. Two exceptions make a release with any type: a breaking change (`!` or a `BREAKING CHANGE:` footer), and a `Release-As:` footer.

Thus a `docs` change to a component `README.md` makes a release of that component.

One squash commit makes a release of each package that it touches. The `chore` commit of #1108 touched five packages, and Release Please opened five release pull requests (#1109 to #1113).

If one part of a change must not make a release, put that part in its own pull request with a type that makes no release. #1176 is a `refactor` that was split out of a `feat(ci)` pull request. Without the split, the `feat` commit would have made a minor release of `image-release-notes` with a wrong note.

For the rules about type, scope, and the squash commit body, see [the review prompt](../../.github/prompts/review.md). For release pull requests, see [the Release Please skill](../../skills/release-please-pr.md).
