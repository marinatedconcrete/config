#!/bin/bash

set -eoux pipefail

/ctx/packages.sh

usermod -aG docker vscode
install -m 0755 /ctx/docker-init.sh /usr/local/share/docker-init.sh

pip3 install --no-cache-dir -r /ctx/requirements.txt

dnf clean all
rm -rf /var/lib/dnf
