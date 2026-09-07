# Shared Renovate Configurations

This directory contains [Renovate](https://docs.renovatebot.com/) configurations for use as [shared presets](https://docs.renovatebot.com/config-presets/).

Add `github>marinatedconcrete/config//renovate/{file}` to your `extends` list.
Replace `{file}` with the configuration name.
Add `#renovate-config-{version}` to select a specified version.
Replace `{version}` with a version from the [GitHub releases](https://github.com/marinatedconcrete/config/releases?q=%22renovate-config%22).

The examples below include a version tag.

## `renovate/devcontainer`

This preset includes [custom managers](https://docs.renovatebot.com/modules/manager/regex/) that let Renovate update versions in devcontainer features.
See the [devcontainer configuration](https://github.com/marinatedconcrete/config/blob/main/.devcontainer/devcontainer.json) for an example.

Add this preset to your `extends` list:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/devcontainer#renovate-config-2.0.0"
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
    "github>marinatedconcrete/config//renovate/marinatedconcrete#renovate-config-2.0.0"
  ]
}
```

## `renovate/recommended`

Use this preset as the initial configuration for your project.

Add this preset to your `extends` list:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/recommended#renovate-config-2.0.0"
  ]
}
```
