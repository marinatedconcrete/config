#!/usr/bin/env bash

set -ouex pipefail

/ctx/packages.sh

# Not `dnf clean all`: /var/cache is a BuildKit cache mount, so its contents never
# land in the image layer regardless — clearing it here only evicts the cache used
# for faster local rebuilds. /var/lib/dnf is a real layer, so it's still worth trimming.
rm -rf /var/lib/dnf
