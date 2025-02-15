# Shareable Renovate Configs

This is a set of [Renovate](https://docs.renovatebot.com/) configurations that can be extended. To use, take advantage
of the [shareable config presets](https://docs.renovatebot.com/config-presets/) feature! Simply add
`github>marinatedconcrete/config//renovate/{file}` to your `extends` list. You can, and probably should, tag it with
an appropriate version if you would like by added `#renovate-config-{version}` to the end, and all examples below show
how to do that.

[Here is a full list of GitHub releases](https://github.com/marinatedconcrete/config/releases?q=%22renovate-config%22)
that you can use as a version tag.

## `renovate/devcontainer`

This contains a set of [custom managers](https://docs.renovatebot.com/modules/manager/regex/) to allow renovate to
update versions in a devcontainer feature. You can see an example in
[this repository's own config](https://github.com/marinatedconcrete/config/blob/main/.devcontainer/devcontainer.json).

To use this, simply add it to your `extends`:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/devcontainer#renovate-config-2.0.0"
  ]
}
```

## `renovate/marinatedconcrete`

This contains a set of [custom managers](https://docs.renovatebot.com/modules/manager/regex/) and
[package rules](https://docs.renovatebot.com/configuration-options/#packagerules) to identify components released from
this repository. If you use anything from this repository, you should probably extend this!

To use this, simply add it to your `extends`:

```json
{
  "extends": [
    "github>marinatedconcrete/config//renovate/marinatedconcrete#renovate-config-2.0.0"
  ]
}
```
