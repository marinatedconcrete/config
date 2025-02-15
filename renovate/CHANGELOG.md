# Changelog

## [2.0.0](https://github.com/marinatedconcrete/config/compare/renovate-config-1.1.1...renovate-config-2.0.0) (2025-02-15)


### ⚠ BREAKING CHANGES

* do not extend any existing config or set a timezone
* rename `default.json` to `marinatedconcrete.json` to support more configs

### Features

* add a new devcontainer shared config ([08dc5bd](https://github.com/marinatedconcrete/config/commit/08dc5bd3a13b11d1d3beda936df406e1b1fc0724))
* add support for devcontainer versioned-debs ([5b91bf7](https://github.com/marinatedconcrete/config/commit/5b91bf79a9b88c77127d685307a3b859e94f464d))
* rename `default.json` to `marinatedconcrete.json` to support more configs ([4f7eabb](https://github.com/marinatedconcrete/config/commit/4f7eabb0d1bcde2ac54c901809510c6d197c5cd7))


### Bug Fixes

* do not extend any existing config or set a timezone ([b787e5b](https://github.com/marinatedconcrete/config/commit/b787e5b3cee3c1f3d1f9f3c7e97acf24f3a5bade))

## [1.1.1](https://github.com/marinatedconcrete/config/compare/renovate-config-1.1.0...renovate-config-1.1.1) (2025-02-15)


### Bug Fixes

* be more flexible on where to find `kustomization.yml` files ([2abbd3d](https://github.com/marinatedconcrete/config/commit/2abbd3d744dd71e9de433c61b59a441813c834c4))
* run `just format` ([5a0e7d1](https://github.com/marinatedconcrete/config/commit/5a0e7d1372928716cb04c60bd4201122a7027ab0))

## [1.1.0](https://github.com/marinatedconcrete/config/compare/renovate-config-1.0.1...renovate-config-1.1.0) (2025-02-12)


### Features

* Detect versioning of this library in a Renovate config ([0ac244a](https://github.com/marinatedconcrete/config/commit/0ac244adb24d1cbde68f27fe9bea584f805c5ccc))


### Documentation Updates

* reference a version that will actually update itself ([bd2ec3c](https://github.com/marinatedconcrete/config/commit/bd2ec3cf206bdd438a6bbd0339f0811e3c2855f9))


### Other Changes

* run prettier on `default.json` ([94cb7d0](https://github.com/marinatedconcrete/config/commit/94cb7d0cc988322d036e38239c4c64ea8e75647d))

## [1.0.1](https://github.com/marinatedconcrete/config/compare/renovate-config@v1.0.0...renovate-config-1.0.1) (2025-02-12)


### Bug Fixes

* use a tag that is hopefully more friendly for renovate ([436ec50](https://github.com/marinatedconcrete/config/commit/436ec50e2170e995dd7a6a141780f5ff2706fa72))

## 1.0.0 (2025-02-12)


### Features

* Create a new shareable Renovate config ([#254](https://github.com/marinatedconcrete/config/issues/254)) ([c2af8bf](https://github.com/marinatedconcrete/config/commit/c2af8bf12f414ec008849126ac124fd15c657ebf))


### Documentation Updates

* update syntax that actually works ([2fbc40c](https://github.com/marinatedconcrete/config/commit/2fbc40c56e352559491129b9f1d2b4ef8d45c57e))
