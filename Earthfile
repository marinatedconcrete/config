VERSION 0.7
FROM alpine

renovate-validate:
    # renovate: datasource=docker depName=renovate/renovate versioning=docker
    ARG RENOVATE_VERSION=37
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

shellcheck-lint:
    # renovate: datasource=docker depName=koalaman/shellcheck-alpine versioning=docker
    ARG SHELLCHECK_VERSION=v0.9.0
    FROM koalaman/shellcheck-alpine:$SHELLCHECK_VERSION
    WORKDIR /mnt
    COPY . .
    RUN find . -name "*.sh" -print | xargs -r -n1 shellcheck

lint:
    BUILD +prettier-lint
    BUILD +shellcheck-lint

images:
    BUILD ./images+all
