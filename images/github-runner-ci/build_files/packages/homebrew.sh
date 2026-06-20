#!/usr/bin/env bash

set -euo pipefail

RUNNER_USER="${RUNNER_USER:-runner}"
HOMEBREW_PREFIX="${HOMEBREW_PREFIX:-/home/linuxbrew/.linuxbrew}"
HOMEBREW_INSTALL_URL="https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"

if [[ "$(id -u)" -eq 0 ]]; then
    exec runuser -u "${RUNNER_USER}" -- env \
        HOME="/home/${RUNNER_USER}" \
        HOMEBREW_CELLAR="${HOMEBREW_PREFIX}/Cellar" \
        HOMEBREW_NO_ANALYTICS="1" \
        HOMEBREW_NO_AUTO_UPDATE="1" \
        HOMEBREW_NO_ENV_HINTS="1" \
        HOMEBREW_PREFIX="${HOMEBREW_PREFIX}" \
        HOMEBREW_REPOSITORY="${HOMEBREW_PREFIX}/Homebrew" \
        LOGNAME="${RUNNER_USER}" \
        PATH="${HOMEBREW_PREFIX}/bin:${HOMEBREW_PREFIX}/sbin:${PATH}" \
        USER="${RUNNER_USER}" \
        "$0"
fi

installer="$(mktemp --tmpdir homebrew-install.XXXXXX.sh)"

curl \
    --fail \
    --location \
    --show-error \
    --silent \
    "${HOMEBREW_INSTALL_URL}" \
    --output "${installer}"
chmod 0755 "${installer}"

CI=1 NONINTERACTIVE=1 /bin/bash "${installer}"

cd "${HOME}"

"${HOMEBREW_PREFIX}/bin/brew" analytics off
"${HOMEBREW_PREFIX}/bin/brew" --version
