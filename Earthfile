VERSION 0.7
FROM alpine

renovate-validate:
    # renovate: datasource=docker depName=renovate/renovate versioning=docker
    ARG RENOVATE_VERSION=36
    FROM renovate/renovate:$RENOVATE_VERSION
    WORKDIR /usr/src/app
    COPY renovate.json .
    RUN renovate-config-validator

validate:
    BUILD +renovate-validate

prettier-lint:
    # renovate: datasource=docker depName=node versioning=docker
    ARG NODE_VERSION=20
    FROM node:$NODE_VERSION
    RUN corepack enable
    WORKDIR /config
    COPY --dir .pnp.cjs .yarnrc.yml package.json yarn.lock .yarn .
    RUN yarn
    COPY --dir .prettierignore .prettierrc.yml .github .
    RUN yarn check-format
  
lint:
    BUILD +prettier-lint

usb-image:
    ARG tag='latest'
    FROM alpine

    RUN mkdir -p /usr/lib/extension-release.d/
    RUN echo ID=_any > /usr/lib/extension-release.d/extension-release.kubo
    SAVE ARTIFACT /usr/lib/extension-release.d
    SAVE ARTIFACT /usr/bin/lsusb
    SAVE ARTIFACT /usr/bin/less
    SAVE IMAGE --push marinatedconcrete/usb-image:$tag

images:
    BUILD +usb-image
