#!/bin/sh
set -e

if [ -f requirements.txt ]; then
    # Install pip to install ansible & kubernetes modules
    if ! command -v pip; then
        sudo apt update
        sudo apt install -y --no-install-recommends python3-pip
    else
        echo "Pip already installed"
    fi
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

# sshpass for initial node provisioning
if ! command -v sshpass; then
    sudo apt update
    sudo apt install -y --no-install-recommends sshpass
fi

# Actually run the playbook
PLAYBOOK=${PLAYBOOK:-undefined}
ansible-playbook "$PLAYBOOK"