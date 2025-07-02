# Changelog

## [1.0.3](https://github.com/marinatedconcrete/config/compare/ansible-collection@v1.0.2...ansible-collection@v1.0.3) (2025-07-02)


### Other Changes

* **package:** update dependency ansible to v11.6.0 ([#395](https://github.com/marinatedconcrete/config/issues/395)) ([42ebe81](https://github.com/marinatedconcrete/config/commit/42ebe814890a44a4681b2b96b98c0f68fa1893bc))
* **package:** update dependency ansible-core to v2.18.6 ([39afeb3](https://github.com/marinatedconcrete/config/commit/39afeb3040199f19ba0abf7f0866c342a5579770))
* **package:** update dependency ansible-lint to v25.5.0 ([#397](https://github.com/marinatedconcrete/config/issues/397)) ([b696697](https://github.com/marinatedconcrete/config/commit/b696697d5b2284b19fa62678c89700fcadf035da))
* **package:** update dependency kubernetes/kubernetes to v1.33.1 ([6fdc7e2](https://github.com/marinatedconcrete/config/commit/6fdc7e286fec718bc44855daabd4fb1e6b06cf70))
* **package:** update dependency kubernetes/kubernetes to v1.33.2 ([11d0742](https://github.com/marinatedconcrete/config/commit/11d07426658211e77eacdb5970fa35bf5435637b))

## [1.0.2](https://github.com/marinatedconcrete/config/compare/ansible-collection@v1.0.1...ansible-collection@v1.0.2) (2025-05-07)


### Other Changes

* **package:** update dependency ansible to v11.5.0 ([#345](https://github.com/marinatedconcrete/config/issues/345)) ([3c4189b](https://github.com/marinatedconcrete/config/commit/3c4189b6e08ee6944123aa60be883be79287c6e5))

## [1.0.1](https://github.com/marinatedconcrete/config/compare/ansible-collection@v1.0.0...ansible-collection@v1.0.1) (2025-04-30)


### Bug Fixes

* Make sure ansible test runner picks up k8s updates ([#316](https://github.com/marinatedconcrete/config/issues/316)) ([87327cf](https://github.com/marinatedconcrete/config/commit/87327cfc32b75674d1abd4c925232084c4c43cc1))


### Other Changes

* **package:** update dependency ansible to v11.4.0 ([#305](https://github.com/marinatedconcrete/config/issues/305)) ([0824b6b](https://github.com/marinatedconcrete/config/commit/0824b6b088ade4ef99cb8e22c3c671d99bf2af17))
* **package:** update dependency ansible-core to v2.18.4 ([6f6ed35](https://github.com/marinatedconcrete/config/commit/6f6ed355ff585387cfc1086df013c47e89b64f11))
* **package:** update dependency ansible-core to v2.18.5 ([29d5a38](https://github.com/marinatedconcrete/config/commit/29d5a3854e74366305feda8316b17c7deefc9165))
* **package:** update dependency ansible-lint to v25.2.0 ([#308](https://github.com/marinatedconcrete/config/issues/308)) ([dbdef00](https://github.com/marinatedconcrete/config/commit/dbdef00aaf09647be2a2d2e4a58674d613228e64))
* **package:** update dependency ansible-lint to v25.2.1 ([a06a7f7](https://github.com/marinatedconcrete/config/commit/a06a7f702480dadacc04ca596f697ec913300559))
* **package:** update dependency ansible-lint to v25.4.0 ([#359](https://github.com/marinatedconcrete/config/issues/359)) ([9c9ff51](https://github.com/marinatedconcrete/config/commit/9c9ff51abab5f2bf06c8d54d0e9da99fe666c0aa))
* **package:** update dependency kubernetes/kubernetes to v1.33.0 ([#349](https://github.com/marinatedconcrete/config/issues/349)) ([b114364](https://github.com/marinatedconcrete/config/commit/b1143645c052fb7280af35152836e8bfd81d2d49))

## [1.0.0](https://github.com/marinatedconcrete/config/compare/ansible-collection@v0.1.0...ansible-collection@v1.0.0) (2025-03-03)


### ⚠ BREAKING CHANGES

* remove dead zsh role/bundle code
* remove `kustomization_test` play

### Features

* add the ability to have local storage provisioning in tests ([8b1f0af](https://github.com/marinatedconcrete/config/commit/8b1f0af12afb544e5d824d52f14a623239833bbe))
* remove `kustomization_test` play ([cf4b285](https://github.com/marinatedconcrete/config/commit/cf4b285433f67936e3997cbeee03dd2d4077a284))
* remove dead zsh role/bundle code ([f52a15a](https://github.com/marinatedconcrete/config/commit/f52a15af2c5cfa37c1a912485a5cb1a2cc46bebb)), closes [#251](https://github.com/marinatedconcrete/config/issues/251)


### Other Changes

* **deps:** pin all used containers for unifi component ([8b1f0af](https://github.com/marinatedconcrete/config/commit/8b1f0af12afb544e5d824d52f14a623239833bbe))
* **format:** cleanup `galaxy.yml` so less gets changed by Release Please ([36cd881](https://github.com/marinatedconcrete/config/commit/36cd881654e2ccd22dacf4e103df56ff24022bee))
* **package:** update dependency ansible to v11.2.0 ([#246](https://github.com/marinatedconcrete/config/issues/246)) ([ee8d8fd](https://github.com/marinatedconcrete/config/commit/ee8d8fd02046696a1db28c7022cef3b9a5e53840))
* **package:** update dependency ansible to v11.3.0 ([#286](https://github.com/marinatedconcrete/config/issues/286)) ([572deac](https://github.com/marinatedconcrete/config/commit/572deac856a00824877bbf95bd25e0c1a4d0e4bb))
* **package:** update dependency ansible-core to v2.18.2 ([#239](https://github.com/marinatedconcrete/config/issues/239)) ([358ce52](https://github.com/marinatedconcrete/config/commit/358ce5253a59268b08415a6d8d7996b539b8e5f1))
* **package:** update dependency ansible-core to v2.18.3 ([d864de5](https://github.com/marinatedconcrete/config/commit/d864de54d58f4c1b66d391eb84375031696f50a4))
* **package:** update dependency ansible-lint to v25.1.3 ([97c2c0c](https://github.com/marinatedconcrete/config/commit/97c2c0ce642773e7db18858791b0b1cab7a45125))
* **package:** update dependency kubernetes to v32 ([#245](https://github.com/marinatedconcrete/config/issues/245)) ([925509c](https://github.com/marinatedconcrete/config/commit/925509c34e35832f60da83f8ee6e7643a699c76f))
* **package:** update dependency kubernetes to v32.0.1 ([a1b66a5](https://github.com/marinatedconcrete/config/commit/a1b66a587afed10485fee9359bf03f27cc411a0c))
* **package:** update python docker tag to v3.13.2 ([f6f9430](https://github.com/marinatedconcrete/config/commit/f6f94303519f34b35a8fa61af234715effc0482c))
