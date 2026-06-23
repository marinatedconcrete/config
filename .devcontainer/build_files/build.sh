#!/bin/bash

set -eoux pipefail

/ctx/packages.sh

pip3 install --no-cache-dir -r /ctx/requirements.txt

dnf clean all
rm -rf /var/lib/dnf
