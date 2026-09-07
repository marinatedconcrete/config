#!/usr/bin/env bash

set -ouex pipefail

/ctx/packages.sh

# Remove package caches.
dnf clean all
rm -rf /var/lib/dnf
