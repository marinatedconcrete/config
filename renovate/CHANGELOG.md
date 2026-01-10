# Changelog

## [2.3.1](https://github.com/marinatedconcrete/config/compare/renovate-config-2.3.0...renovate-config-2.3.1) (2026-01-10)


### Other Changes

* **main:** release renovate-config 2.3.0 ([#595](https://github.com/marinatedconcrete/config/issues/595)) ([72e5ae7](https://github.com/marinatedconcrete/config/commit/72e5ae726a0a26d2a0c85933a9793d599da54432))

## [2.3.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.2.0...renovate-config-2.3.0) (2025-12-26)


### Features

* let renovate properly manage the Microsoft devcontainer image ([#590](https://github.com/marinatedconcrete/config/issues/590)) ([fa9867f](https://github.com/marinatedconcrete/config/commit/fa9867f2d6505037238ecc055a8112e06a0ac8d7))

## [2.2.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.1.1...renovate-config-2.2.0) (2025-08-31)


### Features

* Ensure each thing we release is not grouped by renovate ([#481](https://github.com/marinatedconcrete/config/issues/481)) ([94d23b4](https://github.com/marinatedconcrete/config/commit/94d23b42473be3f4ed30449a98ab54199d8ae585))

## [2.1.1](https://github.com/marinatedconcrete/config/compare/renovate-config-2.1.0...renovate-config-2.1.1) (2025-05-28)


### Other Changes

* **config:** Migrate renovate configs to the new syntax ([#399](https://github.com/marinatedconcrete/config/issues/399)) ([163e2d6](https://github.com/marinatedconcrete/config/commit/163e2d68a1eeb1ac1b6f945ae373bf7cdfe4da80))

## [2.1.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.0.1...renovate-config-2.1.0) (2025-04-18)


### Features

* Create a recommended renovate settings to share ([#326](https://github.com/marinatedconcrete/config/issues/326)) ([e946095](https://github.com/marinatedconcrete/config/commit/e946095f53caab8fbb4c4148dfd35cc9d0fd809d))

## [2.0.1](https://github.com/marinatedconcrete/config/compare/renovate-config-2.0.0...renovate-config-2.0.1) (2025-04-18)


### Bug Fixes

* remove renovate deb matching ([#317](https://github.com/marinatedconcrete/config/issues/317)) ([15c5ba7](https://github.com/marinatedconcrete/config/commit/15c5ba76c34fd257d1f1ea404e0060bea3f43d6b))

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
