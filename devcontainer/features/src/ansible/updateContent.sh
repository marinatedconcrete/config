#!/bin/sh

set -ex

# Run any ansible galaxy modules that the downstream repo has
if [ -f requirements.yml ]; then
    ansible-galaxy install -r requirements.yml
else
    echo "No requirements.yml found"
fi

# Actually run the playbook from the downstream repo
PLAYBOOK=${PLAYBOOK:-undefined}
if [ -f "$PLAYBOOK" ]; then
    ansible-playbook "$PLAYBOOK"
else
    echo "Could not find playbook - cowardly doing nothing"
fi