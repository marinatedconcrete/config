#!/bin/bash

set -ex

DEST="/home/kairos"

install -m u+rw-x,o-rwx,g-rwx -o kairos -g kairos -t "${DEST}" assets/
