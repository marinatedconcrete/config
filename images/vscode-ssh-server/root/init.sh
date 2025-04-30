#!/usr/bin/env bash
set -ex

# Ensure per-machine keys
CONFIG_HOST_KEY_PATH=/config/ssh_host_ed25519_key
# If the config doesn't have keys, generate them
if [ ! -f $CONFIG_HOST_KEY_PATH ]; then
    echo "No ssh host key found. Generating new key into $CONFIG_HOST_KEY_PATH"
    ssh-keygen -t ed25519 -N '' -q -f $CONFIG_HOST_KEY_PATH
fi

# Grab authorized keys
AUTHORIZED_KEYS_PATH=/home/dev/.ssh/authorized_keys
if [ ! -f $AUTHORIZED_KEYS_PATH ]; then
    echo "No authorized keys found. Grabbing new keys from $AUTHORIZED_KEYS_URL"
    curl --location --fail "$AUTHORIZED_KEYS_URL" -o $AUTHORIZED_KEYS_PATH
    chmod 600 $AUTHORIZED_KEYS_PATH
else
    echo "Authorized keys already present. Skipping download."
fi

echo "Authorized keys:"
cat $AUTHORIZED_KEYS_PATH

# Run sshd using the host key in the config
/usr/sbin/sshd -D -h $CONFIG_HOST_KEY_PATH
