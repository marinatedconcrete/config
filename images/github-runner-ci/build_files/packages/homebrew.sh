#!/usr/bin/env bash

set -euo pipefail

RUNNER_USER="${RUNNER_USER:-runner}"
HOMEBREW_PREFIX="${HOMEBREW_PREFIX:-/home/linuxbrew/.linuxbrew}"
# Pin the installer to one commit of Homebrew/install and check its hash.
# To update, read the new install.sh at the new commit, then change both values.
HOMEBREW_INSTALL_COMMIT="e09ddecb4d4f4a3e776c00c62e010276133d1eed"
HOMEBREW_INSTALL_SHA256="34090c61925f5d5c4caca7f1f7089efac33056b1603b4d62b4671d8d22f28fb3"
HOMEBREW_INSTALL_URL="https://raw.githubusercontent.com/Homebrew/install/${HOMEBREW_INSTALL_COMMIT}/install.sh"

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
echo "${HOMEBREW_INSTALL_SHA256}  ${installer}" | sha256sum --check
chmod 0755 "${installer}"

CI=1 NONINTERACTIVE=1 /bin/bash "${installer}"

cd "${HOME}"

"${HOMEBREW_PREFIX}/bin/brew" analytics off
"${HOMEBREW_PREFIX}/bin/brew" --version
