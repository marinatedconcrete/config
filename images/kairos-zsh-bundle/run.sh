#!/bin/bash

set -ex

DEST="/home/kairos"

# Copy the zsh configs to the kairos user homedir with the appropriate permissions.
# User writable is helpful for local experimentation/debugging
install -m u+rw-x,o-rwx,g-rwx -o kairos -g kairos -t "${DEST}" assets/*
