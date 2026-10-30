#!/usr/bin/env sh

set -e

sudo /usr/local/share/docker-init.sh

# Install the package manager and dependencies.
npm install --global --force "$(node -p 'require("./package.json").packageManager')"
pnpm install --frozen-lockfile

ansible-galaxy collection install --no-cache ansible
