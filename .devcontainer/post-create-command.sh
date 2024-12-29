#!/usr/bin/env sh

set -e

yarn

ansible-galaxy collection install --no-cache ansible
