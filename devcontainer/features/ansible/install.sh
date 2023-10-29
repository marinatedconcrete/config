#!/bin/sh
set -e

if [ -f requirements.txt ]; then
    # Install pip to install ansible & kubernetes modules
    if ! command -v pip; then
        sudo apt update
        sudo apt install -y --no-install-recommends python3-pip
    fi
    pip install -r requirements.txt
fi

# Now that pip is setup, install Ansible Galaxy modules
if [ -f requirements.yml ]; then
    ansible-galaxy install -r requirements.yml
fi

# sshpass for initial node provisioning
if ! command -v sshpass; then
    sudo apt update
    sudo apt install -y --no-install-recommends sshpass
fi

PLAYBOOK=${PLAYBOOK:-undefined}
ansible-playbook "$PLAYBOOK"