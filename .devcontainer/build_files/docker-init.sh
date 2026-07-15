#!/bin/bash

set -euo pipefail

fix_socket_permissions() {
    if [[ -S /var/run/docker.sock ]]; then
        chgrp docker /var/run/docker.sock
        chmod 0660 /var/run/docker.sock
    fi
}

set_cgroup_nesting() {
    if [[ ! -f /sys/fs/cgroup/cgroup.controllers ]]; then
        return 0
    fi

    mkdir -p /sys/fs/cgroup/init
    xargs -rn1 < /sys/fs/cgroup/cgroup.procs > /sys/fs/cgroup/init/cgroup.procs || :
    sed -e 's/ / +/g' -e 's/^/+/' < /sys/fs/cgroup/cgroup.controllers \
        > /sys/fs/cgroup/cgroup.subtree_control
}

prepare_dind() {
    export container=docker

    find /run /var/run -iname 'docker*.pid' -delete || :
    find /run /var/run -iname 'container*.pid' -delete || :

    if [[ -d /sys/kernel/security ]] && ! mountpoint -q /sys/kernel/security; then
        mount -t securityfs none /sys/kernel/security || {
            echo >&2 'Could not mount /sys/kernel/security.'
            echo >&2 'AppArmor detection and --privileged mode might break.'
        }
    fi

    if ! mountpoint -q /tmp; then
        mount -t tmpfs none /tmp
    fi

    for _ in {1..5}; do
        if set_cgroup_nesting; then
            return 0
        fi
        echo >&2 'cgroup v2: failed to enable nesting, retrying...'
        sleep 1
    done
}

containerd_arg() {
    local containerd_bin=""
    local containerd_sock="/run/containerd/containerd.sock"

    for candidate in /usr/local/bin/containerd /usr/bin/containerd /usr/sbin/containerd; do
        if [[ -x "$candidate" ]]; then
            containerd_bin="$candidate"
            break
        fi
    done

    if [[ -z "$containerd_bin" ]]; then
        return 0
    fi

    mkdir -p /run/containerd
    if ! pgrep -x containerd >/dev/null 2>&1; then
        "$containerd_bin" > /tmp/containerd.log 2>&1 &
    fi

    for _ in {1..50}; do
        if [[ -S "$containerd_sock" ]]; then
            printf -- '--containerd %s\n' "$containerd_sock"
            return 0
        fi
        sleep 0.1
    done
}

if docker info >/dev/null 2>&1; then
    fix_socket_permissions
    exit 0
fi

if ! pgrep -x dockerd >/dev/null 2>&1; then
    prepare_dind
    mkdir -p /run /var/lib/containerd /var/lib/docker
    read -r -a dockerd_containerd_arg <<< "$(containerd_arg)"
    dockerd "${dockerd_containerd_arg[@]}" > /tmp/dockerd.log 2>&1 &
fi

for _ in {1..30}; do
    if docker info >/dev/null 2>&1; then
        fix_socket_permissions
        exit 0
    fi
    sleep 1
done

cat /tmp/dockerd.log >&2
exit 1
