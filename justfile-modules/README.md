# Justfile modules

Use these modules in a repository that uses Just.

## Format module

The format module can format a justfile or check its format.
Add this example to your justfile.
Set `modules_ref` to a published package tag or a commit SHA.

```just
mod? justfmt 'format.just'

modules_ref := 'justfile-modules@v1.0.0'

fetch-just-modules:
    curl --fail --silent --show-error --location --output format.just "https://raw.githubusercontent.com/marinatedconcrete/config/{{ modules_ref }}/justfile-modules/format.just"
```

Run `just fetch-just-modules` to download the module.
Run `just justfmt::check` to check the format of your justfile.
Run `just justfmt::format` to format it.
Give a file path as an argument to select a different justfile.

See the [Just manual](https://just.systems/man/en/remote-justfiles.html) for remote modules.
