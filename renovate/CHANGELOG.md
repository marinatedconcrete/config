# Changelog

## [2.6.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.5.0...renovate-config-2.6.0) (2026-08-29)

### Features

- **buildah-action-runner:** create a buildah image to use in runners ([#842](https://github.com/marinatedconcrete/config/issues/842)) ([0912a80](https://github.com/marinatedconcrete/config/commit/0912a8021e20b2cce46dfd0f4881659fc5a1fad9))

## [2.5.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.4.2...renovate-config-2.5.0) (2026-07-03)

### Features

- Add the GitHub CI runner image. ([#778](https://github.com/marinatedconcrete/config/issues/778)) ([8b9456a](https://github.com/marinatedconcrete/config/commit/8b9456af937d1ed001104d9fc8896f179524edfb))

## [2.4.2](https://github.com/marinatedconcrete/config/compare/renovate-config-2.4.1...renovate-config-2.4.2) (2026-06-01)

### Bug Fixes

- **renovate:** Keep the dependency name to prevent branch creation failures. ([#754](https://github.com/marinatedconcrete/config/issues/754)) ([9170988](https://github.com/marinatedconcrete/config/commit/9170988a549dc806f03842f6cd8ddce5a55269b4))

## [2.4.1](https://github.com/marinatedconcrete/config/compare/renovate-config-2.4.0...renovate-config-2.4.1) (2026-05-31)

### Bug Fixes

- Let Renovate find the ansible-galaxy package. ([#753](https://github.com/marinatedconcrete/config/issues/753)) ([5a56ffd](https://github.com/marinatedconcrete/config/commit/5a56ffdaf612c826a51b0a9f4cb139af60d49170))
- **renovate:** Set the changelog location for the kairos-fedora image. ([#751](https://github.com/marinatedconcrete/config/issues/751)) ([1945f47](https://github.com/marinatedconcrete/config/commit/1945f47e8b80b013b21e415bffdeccc0562ef038))

### Other Changes

- Remove the kairos-ubuntu image. ([#750](https://github.com/marinatedconcrete/config/issues/750)) ([656e85c](https://github.com/marinatedconcrete/config/commit/656e85ce605da90ddfdfe08a831a287c7bd95d3b))

## [2.4.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.3.0...renovate-config-2.4.0) (2026-05-14)

### Features

- Add a kairos-fedora image. ([#694](https://github.com/marinatedconcrete/config/issues/694)) ([8a2fa2c](https://github.com/marinatedconcrete/config/commit/8a2fa2c980cb64ce70567ee14e5e653368975cef))

## [2.3.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.2.0...renovate-config-2.3.0) (2025-12-26)

### Features

- Let Renovate manage the Microsoft devcontainer image correctly. ([#590](https://github.com/marinatedconcrete/config/issues/590)) ([fa9867f](https://github.com/marinatedconcrete/config/commit/fa9867f2d6505037238ecc055a8112e06a0ac8d7))

## [2.2.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.1.1...renovate-config-2.2.0) (2025-08-31)

### Features

- Keep each released component in a separate Renovate group. ([#481](https://github.com/marinatedconcrete/config/issues/481)) ([94d23b4](https://github.com/marinatedconcrete/config/commit/94d23b42473be3f4ed30449a98ab54199d8ae585))

## [2.1.1](https://github.com/marinatedconcrete/config/compare/renovate-config-2.1.0...renovate-config-2.1.1) (2025-05-28)

### Other Changes

- **config:** Change Renovate configurations to the new syntax. ([#399](https://github.com/marinatedconcrete/config/issues/399)) ([163e2d6](https://github.com/marinatedconcrete/config/commit/163e2d68a1eeb1ac1b6f945ae373bf7cdfe4da80))

## [2.1.0](https://github.com/marinatedconcrete/config/compare/renovate-config-2.0.1...renovate-config-2.1.0) (2025-04-18)

### Features

- Add recommended Renovate settings for shared use. ([#326](https://github.com/marinatedconcrete/config/issues/326)) ([e946095](https://github.com/marinatedconcrete/config/commit/e946095f53caab8fbb4c4148dfd35cc9d0fd809d))

## [2.0.1](https://github.com/marinatedconcrete/config/compare/renovate-config-2.0.0...renovate-config-2.0.1) (2025-04-18)

### Bug Fixes

- Remove Renovate deb matching. ([#317](https://github.com/marinatedconcrete/config/issues/317)) ([15c5ba7](https://github.com/marinatedconcrete/config/commit/15c5ba76c34fd257d1f1ea404e0060bea3f43d6b))

## [2.0.0](https://github.com/marinatedconcrete/config/compare/renovate-config-1.1.1...renovate-config-2.0.0) (2025-02-15)

### ⚠ BREAKING CHANGES

- Do not extend an existing configuration. Do not set a timezone.
- Rename `default.json` to `marinatedconcrete.json` for more configurations.

### Features

- Add a shared devcontainer configuration. ([08dc5bd](https://github.com/marinatedconcrete/config/commit/08dc5bd3a13b11d1d3beda936df406e1b1fc0724))
- Add support for devcontainer versioned-debs. ([5b91bf7](https://github.com/marinatedconcrete/config/commit/5b91bf79a9b88c77127d685307a3b859e94f464d))
- Rename `default.json` to `marinatedconcrete.json` for more configurations. ([4f7eabb](https://github.com/marinatedconcrete/config/commit/4f7eabb0d1bcde2ac54c901809510c6d197c5cd7))

### Bug Fixes

- Do not extend an existing configuration. Do not set a timezone. ([b787e5b](https://github.com/marinatedconcrete/config/commit/b787e5b3cee3c1f3d1f9f3c7e97acf24f3a5bade))

## [1.1.1](https://github.com/marinatedconcrete/config/compare/renovate-config-1.1.0...renovate-config-1.1.1) (2025-02-15)

### Bug Fixes

- Find `kustomization.yml` files in more locations. ([2abbd3d](https://github.com/marinatedconcrete/config/commit/2abbd3d744dd71e9de433c61b59a441813c834c4))
- Run `just format`. ([5a0e7d1](https://github.com/marinatedconcrete/config/commit/5a0e7d1372928716cb04c60bd4201122a7027ab0))

## [1.1.0](https://github.com/marinatedconcrete/config/compare/renovate-config-1.0.1...renovate-config-1.1.0) (2025-02-12)

### Features

- Find the library version in a Renovate configuration. ([0ac244a](https://github.com/marinatedconcrete/config/commit/0ac244adb24d1cbde68f27fe9bea584f805c5ccc))

### Documentation Updates

- Use a version reference that lets automatic updates occur. ([bd2ec3c](https://github.com/marinatedconcrete/config/commit/bd2ec3cf206bdd438a6bbd0339f0811e3c2855f9))

### Other Changes

- Run Prettier on `default.json`. ([94cb7d0](https://github.com/marinatedconcrete/config/commit/94cb7d0cc988322d036e38239c4c64ea8e75647d))

## [1.0.1](https://github.com/marinatedconcrete/config/compare/renovate-config@v1.0.0...renovate-config-1.0.1) (2025-02-12)

### Bug Fixes

- Use a tag for Renovate compatibility. ([436ec50](https://github.com/marinatedconcrete/config/commit/436ec50e2170e995dd7a6a141780f5ff2706fa72))

## 1.0.0 (2025-02-12)

### Features

- Add a shared Renovate configuration. ([#254](https://github.com/marinatedconcrete/config/issues/254)) ([c2af8bf](https://github.com/marinatedconcrete/config/commit/c2af8bf12f414ec008849126ac124fd15c657ebf))

### Documentation Updates

- Correct the configuration syntax. ([2fbc40c](https://github.com/marinatedconcrete/config/commit/2fbc40c56e352559491129b9f1d2b4ef8d45c57e))
