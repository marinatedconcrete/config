# Changelog

## [3.0.1](https://github.com/marinatedconcrete/config/compare/kustomize-kube-vip@v3.0.0...kustomize-kube-vip@v3.0.1) (2025-05-12)


### Bug Fixes

* update RBAC from incorrect `endpoints` ([e31b9b9](https://github.com/marinatedconcrete/config/commit/e31b9b9705dcfc58df5ece80a6b3ebdad4be9f6b))

## [3.0.0](https://github.com/marinatedconcrete/config/compare/kustomize-kube-vip@v2.0.1...kustomize-kube-vip@v3.0.0) (2025-05-04)


### ⚠ BREAKING CHANGES

* split kube-vip service and control plane VIP DaemonSets ([#376](https://github.com/marinatedconcrete/config/issues/376))

### Features

* codegen kube-vip RBAC ([#355](https://github.com/marinatedconcrete/config/issues/355)) ([be3a291](https://github.com/marinatedconcrete/config/commit/be3a29150d9ed2b24c7f89c6ed805afd1aa8e9a0))
* split kube-vip service and control plane VIP DaemonSets ([#376](https://github.com/marinatedconcrete/config/issues/376)) ([cb7a9d0](https://github.com/marinatedconcrete/config/commit/cb7a9d09c1736d0e9fb7c858183a17208ceb3430))


### Bug Fixes

* make it easier to override the namespace ([#352](https://github.com/marinatedconcrete/config/issues/352)) ([2a01510](https://github.com/marinatedconcrete/config/commit/2a015103aaabdb88ffa80580a43b873e04f91a3c))


### Other Changes

* **package:** update ghcr.io/kube-vip/kube-vip docker tag to v0.9.0 ([#315](https://github.com/marinatedconcrete/config/issues/315)) ([704dcf0](https://github.com/marinatedconcrete/config/commit/704dcf02e312d27fd733f46d3ba681aa14f9bab7))
* **package:** update ghcr.io/kube-vip/kube-vip docker tag to v0.9.1 ([587b908](https://github.com/marinatedconcrete/config/commit/587b908463c70125587df1ef7d80d1b19e1223cb))

## [2.0.1](https://github.com/marinatedconcrete/config/compare/kustomize-kube-vip@v2.0.0...kustomize-kube-vip@v2.0.1) (2025-04-20)


### Bug Fixes

* update RBAC for kube-vip ([#321](https://github.com/marinatedconcrete/config/issues/321)) ([f5d2645](https://github.com/marinatedconcrete/config/commit/f5d2645328d2c1b2c5091ee38b1a790070d53943))


### Documentation Updates

* fix kube-vip priorityclass ([01de083](https://github.com/marinatedconcrete/config/commit/01de083f5fd404f823abd7079e33363c1de85e19))

## [2.0.0](https://github.com/marinatedconcrete/config/compare/kustomize-kube-vip@v1.0.1...kustomize-kube-vip@v2.0.0) (2025-04-15)


### ⚠ BREAKING CHANGES

* require `priorityclass` component, and add appropriate `priorityClass` ([#285](https://github.com/marinatedconcrete/config/issues/285))

### Features

* require `priorityclass` component, and add appropriate `priorityClass` ([#285](https://github.com/marinatedconcrete/config/issues/285)) ([a148a93](https://github.com/marinatedconcrete/config/commit/a148a93e5638ad7b0822a1c23f58154e8642f5f5))


### Documentation Updates

* Add and Standardize Badging ([#278](https://github.com/marinatedconcrete/config/issues/278)) ([9f21755](https://github.com/marinatedconcrete/config/commit/9f21755bdeaa287887215ca76586aa070d17656e))


### Other Changes

* **package:** update ghcr.io/kube-vip/kube-vip docker tag to v0.8.10 ([06a7858](https://github.com/marinatedconcrete/config/commit/06a7858dca7bf6075ef091562b0206b2cf23c38b))

## [1.0.1](https://github.com/marinatedconcrete/config/compare/kustomize-kube-vip@v1.0.0...kustomize-kube-vip@v1.0.1) (2025-02-15)


### Other Changes

* **deps:** pin kube-vip container ([6d0f68c](https://github.com/marinatedconcrete/config/commit/6d0f68c1e105d5660077ad496fd2b8eff7938410))

## [1.0.0](https://github.com/marinatedconcrete/config/compare/kustomize-kube-vip-v0.1.0...kustomize-kube-vip@v1.0.0) (2025-02-14)


### Documentation Updates

* add correct example usage for new packaging of kube-vip ([01f358e](https://github.com/marinatedconcrete/config/commit/01f358e733be91690ba2ab4ba02bc4fa4c4b217c))
