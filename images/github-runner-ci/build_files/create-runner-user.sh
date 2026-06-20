#!/usr/bin/env bash

set -euo pipefail

RUNNER_USER="${RUNNER_USER:-runner}"
RUNNER_UID="${RUNNER_UID:-1001}"
RUNNER_GID="${RUNNER_GID:-1001}"

groupadd --gid "${RUNNER_GID}" "${RUNNER_USER}"
useradd \
    --create-home \
    --gid "${RUNNER_GID}" \
    --home-dir "/home/${RUNNER_USER}" \
    --shell /bin/bash \
    --uid "${RUNNER_UID}" \
    "${RUNNER_USER}"

install -d \
    --owner "${RUNNER_USER}" \
    --group "${RUNNER_USER}" \
    "/home/linuxbrew" \
    "/home/${RUNNER_USER}/.cache" \
    "/home/${RUNNER_USER}/.config" \
    "/home/${RUNNER_USER}/.local" \
    "/home/${RUNNER_USER}/.local/bin" \
    "/home/${RUNNER_USER}/.local/share"

git config --system init.defaultBranch main
