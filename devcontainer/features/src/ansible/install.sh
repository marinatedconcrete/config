#!/bin/sh
set -e

#
# Gather & Install Required Packages
#

# This will contain all the packages we need to install; space seperated.
packages="gnupg2"

if [ -f requirements.txt ]; then
    # Install pip to install ansible & kubernetes modules
    if ! command -v pip; then
        packages="$packages python3-pip"
    fi
fi

# sshpass for initial node provisioning
if ! command -v sshpass; then
    packages="$packages sshpass"
fi

sudo apt update
sudo apt install -y --no-install-recommends "$packages"

#
# Non-Package Requirements
#

if [ -f requirements.txt ]; then
    pip install -r requirements.txt
else
    echo "No requirements.txt found"
fi

# Now that pip is setup, install Ansible Galaxy modules
if [ -f requirements.yml ]; then
    ansible-galaxy install -r requirements.yml
else
    echo "No requirements.yml found"
fi
