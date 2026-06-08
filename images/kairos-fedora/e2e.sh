#!/usr/bin/env bash
set -euo pipefail

log() {
    printf '==> %s\n' "$*" >&2
}

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

duration_to_seconds() {
    local value="$1"

    if [[ "$value" =~ ^([0-9]+)$ ]]; then
        printf '%s\n' "${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^([0-9]+)s$ ]]; then
        printf '%s\n' "${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^([0-9]+)m$ ]]; then
        printf '%s\n' "$((BASH_REMATCH[1] * 60))"
    elif [[ "$value" =~ ^([0-9]+)h$ ]]; then
        printf '%s\n' "$((BASH_REMATCH[1] * 3600))"
    else
        die "unsupported duration '${value}', use Ns, Nm, Nh, or plain seconds"
    fi
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

E2E_WORKDIR="${E2E_WORKDIR:-${repo_root}/build/e2e/kairos-fedora}"
E2E_MEMORY="${E2E_MEMORY:-8192}"
E2E_CPUS="${E2E_CPUS:-2}"
E2E_DISK_SIZE="${E2E_DISK_SIZE:-30G}"
E2E_INSTALL_TIMEOUT="${E2E_INSTALL_TIMEOUT:-25m}"
E2E_BOOT_TIMEOUT="${E2E_BOOT_TIMEOUT:-15m}"
E2E_K3S_TIMEOUT="${E2E_K3S_TIMEOUT:-10m}"
E2E_WEBUI_PORT="${E2E_WEBUI_PORT:-18080}"
E2E_SSH_PORT="${E2E_SSH_PORT:-10022}"
KAIROS_E2E_VERSION="${KAIROS_E2E_VERSION:-0.0.0-e2e}"
# renovate: datasource=docker depName=quay.io/kairos/auroraboot
AURORABOOT_IMAGE="${AURORABOOT_IMAGE:-quay.io/kairos/auroraboot:v0.20.1}"

logs_dir="${E2E_WORKDIR}/logs"
disk_path="${E2E_WORKDIR}/kairos-fedora.qcow2"
ssh_key="${E2E_WORKDIR}/id_ed25519"
cloud_config="${E2E_WORKDIR}/install-cloud-config.yaml"
qemu_pid=""
ssh_ready=0
phase="host"

normalize_image_ref() {
    local image="$1"

    image="${image#oci:}"
    image="${image#docker://}"
    printf '%s\n' "$image"
}

build_default_image() {
    local image="$1"

    log "KAIROS_IMAGE is unset; building ${image} from images/kairos-fedora/Containerfile"
    DOCKER_BUILDKIT=1 docker build \
        --build-arg "VERSION=${KAIROS_E2E_VERSION}" \
        -f "${script_dir}/Containerfile" \
        -t "$image" \
        "$script_dir"
}

find_latest_iso() {
    find "$E2E_WORKDIR" -maxdepth 1 -type f -name '*.iso' -print | sort | tail -n 1
}

build_installer_iso() {
    local image="$1"
    local docker_image
    local iso_path
    local override_iso

    if [[ -n "${KAIROS_ISO:-}" ]]; then
        override_iso="$KAIROS_ISO"
        if [[ "$override_iso" != /* ]]; then
            override_iso="${repo_root}/${override_iso}"
        fi
        [[ -f "$override_iso" ]] || die "KAIROS_ISO does not exist: ${KAIROS_ISO}"
        printf '%s\n' "$override_iso"
        return
    fi

    docker_image="$(normalize_image_ref "$image")"
    mkdir -p "$E2E_WORKDIR"

    log "Building installer ISO from oci:${docker_image}"
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "${E2E_WORKDIR}:/tmp/auroraboot" \
        "$AURORABOOT_IMAGE" \
        build-iso \
        --output /tmp/auroraboot \
        "oci:${docker_image}"

    iso_path="$(find_latest_iso)"
    [[ -n "$iso_path" ]] || die "AuroraBoot did not produce an ISO in ${E2E_WORKDIR}"
    printf '%s\n' "$iso_path"
}

find_ovmf_pair() {
    local code_path
    local vars_path

    for code_path in \
        /usr/share/OVMF/OVMF_CODE_4M.fd \
        /usr/share/OVMF/OVMF_CODE.fd \
        /usr/share/edk2/ovmf/OVMF_CODE.fd; do
        [[ -f "$code_path" ]] || continue

        vars_path="${code_path/CODE/VARS}"
        [[ -f "$vars_path" ]] || continue

        printf '%s\n%s\n' "$code_path" "$vars_path"
        return
    done

    die "could not find OVMF_CODE/OVMF_VARS firmware files"
}

generate_cloud_config() {
    local public_key

    if [[ ! -f "$ssh_key" ]]; then
        ssh-keygen -t ed25519 -N '' -f "$ssh_key" -C kairos-fedora-e2e >/dev/null
    fi

    public_key="$(<"${ssh_key}.pub")"
    cat >"$cloud_config" <<EOF
#cloud-config
hostname: kairos-fedora-e2e
users:
  - name: kairos
    groups:
      - admin
    ssh_authorized_keys:
      - ${public_key}
k3s:
  enabled: true
EOF
}

start_qemu() {
    local mode="$1"
    local iso_path="$2"
    local firmware_code="$3"
    local firmware_vars_template="$4"
    local firmware_vars="${E2E_WORKDIR}/OVMF_VARS-${mode}.fd"
    local serial_log="${logs_dir}/qemu-${mode}.serial.log"
    local stdout_log="${logs_dir}/qemu-${mode}.stdout.log"
    local stderr_log="${logs_dir}/qemu-${mode}.stderr.log"
    local -a qemu_args

    cp "$firmware_vars_template" "$firmware_vars"

    qemu_args=(
        -machine q35,accel=kvm
        -cpu host
        -m "$E2E_MEMORY"
        -smp "$E2E_CPUS"
        -display none
        -monitor none
        -serial "file:${serial_log}"
        -device virtio-rng-pci
        -drive "if=pflash,format=raw,readonly=on,file=${firmware_code}"
        -drive "if=pflash,format=raw,file=${firmware_vars}"
        -drive "if=virtio,format=qcow2,file=${disk_path}"
    )

    if [[ "$mode" == "install" ]]; then
        qemu_args+=(
            -drive "file=${iso_path},media=cdrom,readonly=on,if=ide"
            -boot order=d,menu=off
            -no-reboot
            -netdev "user,id=net0,hostfwd=tcp:127.0.0.1:${E2E_WEBUI_PORT}-:8080"
            -device virtio-net-pci,netdev=net0
        )
    else
        qemu_args+=(
            -boot order=c,menu=off
            -netdev "user,id=net0,hostfwd=tcp:127.0.0.1:${E2E_SSH_PORT}-:22"
            -device virtio-net-pci,netdev=net0
        )
    fi

    {
        printf 'qemu-system-x86_64'
        printf ' %q' "${qemu_args[@]}"
        printf '\n'
    } >"${logs_dir}/qemu-${mode}.cmd"

    log "Starting QEMU ${mode} VM"
    qemu-system-x86_64 "${qemu_args[@]}" >"$stdout_log" 2>"$stderr_log" &
    qemu_pid="$!"
}

wait_for_qemu_exit() {
    local timeout_seconds
    local marker="${logs_dir}/qemu-timeout-${qemu_pid}"
    local watchdog_pid
    local status

    timeout_seconds="$(duration_to_seconds "$1")"
    rm -f "$marker"

    (
        sleep "$timeout_seconds"
        touch "$marker"
        kill "$qemu_pid" >/dev/null 2>&1 || true
    ) &
    watchdog_pid="$!"

    set +e
    wait "$qemu_pid"
    status="$?"
    set -e

    kill "$watchdog_pid" >/dev/null 2>&1 || true
    wait "$watchdog_pid" >/dev/null 2>&1 || true

    if [[ -f "$marker" ]]; then
        rm -f "$marker"
        return 124
    fi

    return "$status"
}

wait_for_webui() {
    local deadline
    local timeout_seconds
    local url="http://127.0.0.1:${E2E_WEBUI_PORT}/"

    timeout_seconds="$(duration_to_seconds "$E2E_BOOT_TIMEOUT")"
    deadline=$((SECONDS + timeout_seconds))

    log "Waiting for Kairos WebUI at ${url}"
    while ((SECONDS < deadline)); do
        if curl --fail --silent --show-error --max-time 5 "$url" >"${logs_dir}/webui-index.html"; then
            grep -q 'install-form' "${logs_dir}/webui-index.html" || die "WebUI responded but install form was not found"
            return
        fi
        sleep 5
    done

    die "WebUI did not become reachable before ${E2E_BOOT_TIMEOUT}"
}

submit_install() {
    local base_url="http://127.0.0.1:${E2E_WEBUI_PORT}"

    log "Validating generated cloud-config through the WebUI"
    curl --fail --silent --show-error \
        -X POST \
        -F "cloud-config=<${cloud_config};type=text/plain" \
        "${base_url}/validate" \
        >"${logs_dir}/webui-validate.txt"

    if [[ -s "${logs_dir}/webui-validate.txt" ]]; then
        die "Kairos rejected generated cloud-config: $(<"${logs_dir}/webui-validate.txt")"
    fi

    log "Submitting WebUI install to /dev/vda"
    if ! curl --fail --silent --show-error --location \
        -X POST \
        -F "cloud-config=<${cloud_config};type=text/plain" \
        -F "installation-device=/dev/vda" \
        -F "power-off=on" \
        "${base_url}/install" \
        >"${logs_dir}/webui-install-response.html"; then
        log "Install submission connection ended early; continuing to wait for VM poweroff"
    fi
}

ssh_cmd() {
    ssh \
        -i "$ssh_key" \
        -p "$E2E_SSH_PORT" \
        -o BatchMode=yes \
        -o ConnectTimeout=5 \
        -o LogLevel=ERROR \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        "kairos@127.0.0.1" \
        "$@"
}

wait_for_ssh() {
    local deadline
    local timeout_seconds

    timeout_seconds="$(duration_to_seconds "$E2E_BOOT_TIMEOUT")"
    deadline=$((SECONDS + timeout_seconds))

    log "Waiting for SSH on localhost:${E2E_SSH_PORT}"
    while ((SECONDS < deadline)); do
        if ssh_cmd true >/dev/null 2>&1; then
            ssh_ready=1
            return
        fi
        sleep 5
    done

    die "SSH did not become reachable before ${E2E_BOOT_TIMEOUT}"
}

collect_ssh_diagnostics() {
    [[ "$ssh_ready" == 1 ]] || return 0

    log "Collecting guest diagnostics"
    ssh_cmd 'cat /etc/os-release' >"${logs_dir}/guest-os-release.txt" 2>&1 || true
    ssh_cmd 'sudo -n systemctl --failed --no-pager' >"${logs_dir}/guest-systemctl-failed.txt" 2>&1 || true
    ssh_cmd 'sudo -n journalctl -b --no-pager' >"${logs_dir}/guest-journalctl-b.log" 2>&1 || true
    ssh_cmd 'sudo -n k3s kubectl get nodes -o wide' >"${logs_dir}/guest-k3s-nodes.txt" 2>&1 || true
    ssh_cmd 'sudo -n k3s kubectl get pods -A -o wide' >"${logs_dir}/guest-k3s-pods.txt" 2>&1 || true
}

cleanup_qemu() {
    if [[ -n "$qemu_pid" ]] && kill "$qemu_pid" >/dev/null 2>&1; then
        kill "$qemu_pid" >/dev/null 2>&1 || true
        wait "$qemu_pid" >/dev/null 2>&1 || true
    fi
}

on_exit() {
    local status="$?"

    if ((status != 0)); then
        printf 'E2E failed during phase: %s\n' "$phase" >&2
        collect_ssh_diagnostics || true
        printf 'Logs are in %s\n' "$logs_dir" >&2
    fi

    cleanup_qemu
    exit "$status"
}

run_guest_checks() {
    log "Checking Fedora identity"
    ssh_cmd 'grep -E "^(ID|ID_LIKE)=" /etc/os-release | grep -q fedora'

    log "Checking Kairos active boot state"
    ssh_cmd 'kairos-agent state get boot | tee /tmp/kairos-boot-state.txt && grep -q active_boot /tmp/kairos-boot-state.txt'

    log "Waiting for K3s node readiness"
    ssh_cmd "sudo -n k3s kubectl wait --for=condition=Ready nodes --all --timeout=${E2E_K3S_TIMEOUT}"
    ssh_cmd 'sudo -n k3s kubectl get pods -A -o wide'

    log "Checking failed systemd units"
    ssh_cmd 'test -z "$(sudo -n systemctl --failed --no-legend)"'
}

main() {
    local kairos_image="${KAIROS_IMAGE:-kairos-fedora:${KAIROS_E2E_VERSION}}"
    local iso_path
    local ovmf_code
    local ovmf_vars
    local ovmf_pair

    trap on_exit EXIT

    require_cmd docker
    require_cmd qemu-system-x86_64
    require_cmd qemu-img
    require_cmd curl
    require_cmd ssh
    require_cmd ssh-keygen

    [[ -e /dev/kvm ]] || die "/dev/kvm is unavailable; enable KVM before running this test"
    [[ -r /dev/kvm && -w /dev/kvm ]] || die "/dev/kvm exists but is not readable and writable by this user"

    mkdir -p "$logs_dir"
    if [[ -z "${KAIROS_IMAGE:-}" ]]; then
        build_default_image "$kairos_image"
    fi

    phase="iso-build"
    iso_path="$(build_installer_iso "$kairos_image")"

    ovmf_pair="$(find_ovmf_pair)"
    ovmf_code="$(printf '%s\n' "$ovmf_pair" | sed -n '1p')"
    ovmf_vars="$(printf '%s\n' "$ovmf_pair" | sed -n '2p')"

    generate_cloud_config

    phase="disk-create"
    log "Creating ${E2E_DISK_SIZE} test disk at ${disk_path}"
    rm -f -- "$disk_path"
    qemu-img create -f qcow2 "$disk_path" "$E2E_DISK_SIZE" >"${logs_dir}/qemu-img.log"

    phase="install"
    start_qemu install "$iso_path" "$ovmf_code" "$ovmf_vars"
    wait_for_webui
    submit_install
    if ! wait_for_qemu_exit "$E2E_INSTALL_TIMEOUT"; then
        die "installer VM did not power off cleanly before ${E2E_INSTALL_TIMEOUT}"
    fi
    qemu_pid=""

    phase="validate"
    start_qemu validate "" "$ovmf_code" "$ovmf_vars"
    wait_for_ssh
    run_guest_checks

    phase="complete"
    log "Kairos Fedora e2e completed successfully"
}

main "$@"
