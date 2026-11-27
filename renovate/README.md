# Shared Renovate Configurations

This directory contains [Renovate](https://docs.renovatebot.com/) configurations for use as [shared presets](https://docs.renovatebot.com/config-presets/).

Add `github>marinatedconcrete/config//renovate/{file}` to your `extends` list.
Replace `{file}` with the configuration name.
Add `#renovate-config-{version}` to select a specified version.
Replace `{version}` with a version from the [GitHub releases](https://github.com/marinatedconcrete/config/releases?q=%22renovate-config%22).

The examples below use the `{version}` placeholder. Replace it before you use an example.
If you use the `renovate/marinatedconcrete` preset, Renovate updates the version tag in a root `renovate.json` or `renovate.json5` file.

## `renovate/devcontainer`

This preset includes [custom managers](https://docs.renovatebot.com/modules/manager/regex/) that let Renovate update versions in devcontainer features.
See the [devcontainer configuration](https://github.com/marinatedconcrete/config/blob/main/.devcontainer/devcontainer.json) for an example.

Add this preset to your `extends` list:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/devcontainer#renovate-config-{version}"
  ]
}
```

## `renovate/marinatedconcrete`

This preset includes [custom managers](https://docs.renovatebot.com/modules/manager/regex/) and [package rules](https://docs.renovatebot.com/configuration-options/#packagerules).
These rules identify components released from this repository.
Use this preset if you use components from this repository.

Add this preset to your `extends` list:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/marinatedconcrete#renovate-config-{version}"
  ]
}
```

## `renovate/recommended`

Use this preset as the initial configuration for your project.

Renovate pins GitHub Actions and reusable workflows to commit SHAs.
For supported release tags, Renovate uses the full version in the comment next to the SHA.
For example, an update can change a `v5` comment to `v5.1.0` and pin the commit for `v5.1.0`.

The [Renovate helper](https://docs.renovatebot.com/presets-helpers/#helperspingithubactiondigeststosemver) selects release tags in `vX.Y.Z` or `X.Y.Z` form.
Branch names and tags such as `v5.1.0-rc.1` are outside this format.
Renovate can still pin these references to commit SHAs and keep their names in the comments.
To select versions from other tag formats, add a package rule for that dependency after the preset.
Set `extractVersion` and `versioning` for the tag format that the dependency uses.

Add this preset to your `extends` list:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/recommended#renovate-config-{version}"
  ]
}
```
