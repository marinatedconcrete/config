#!/bin/bash

set -ex

DEST="/home/kairos"

echo $PATH
pwd
whoami
find .

# Copy the zsh configs to the kairos user homedir with the appropriate permissions.
# User writable is helpful for local experimentation/debugging
for config in `ls -A ./assets`; do
  install -m u+rw-x,o-rwx,g-rwx -o kairos -g kairos -t "${DEST}" "${config}"
done
