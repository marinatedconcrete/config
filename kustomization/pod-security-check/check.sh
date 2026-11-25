#!/usr/bin/env bash
# Check that each rendered component meets its declared Pod Security level.
# Exit 0 when all components pass, 1 when a component fails, 2 when the check cannot run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPONENTS="${ROOT}/kustomization/components"
EXCEPTIONS_FILE="${EXCEPTIONS_FILE:-${ROOT}/kustomization/pod-security-check/exceptions.yml}"
POD_TEMPLATE_KINDS='^(Pod|PodTemplate|ReplicationController|ReplicaSet|Deployment|StatefulSet|DaemonSet|Job|CronJob)$'

rank() {
  case "$1" in
    restricted) echo 0 ;;
    baseline) echo 1 ;;
    privileged) echo 2 ;;
  esac
}

# A controller gets warnings only, never an enforce result, so each namespace uses the warn label.
prepare() {
  local level
  for level in restricted baseline; do
    kubectl --context "$1" apply -f - > /dev/null << EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ps-${level}
  labels:
    pod-security.kubernetes.io/warn: ${level}
    pod-security.kubernetes.io/warn-version: latest
EOF
  done
}

validate_exceptions() {
  local file="$1" key level bad=0
  if [[ "$(yq 'tag' "${file}")" != '!!map' && "$(yq 'tag' "${file}")" != '!!null' ]]; then
    echo "ERROR ${file}: the file must be a map." >&2
    exit 2
  fi
  while read -r key; do
    if [[ ! -f "${COMPONENTS}/${key}/kustomization.yml" ]]; then
      echo "ERROR ${file}: ${key} is not a component." >&2
      bad=1
    fi
    level="$(KEY="${key}" yq '.[strenv(KEY)] | select(tag == "!!map") | .level // ""' "${file}")"
    if [[ "${level}" != baseline && "${level}" != privileged ]]; then
      echo "ERROR ${file}: ${key} must have the level baseline or privileged." >&2
      bad=1
    fi
    if [[ -z "$(KEY="${key}" yq '.[strenv(KEY)] | select(tag == "!!map") | .reason // ""' "${file}")" ]]; then
      echo "ERROR ${file}: ${key} must have a reason." >&2
      bad=1
    fi
  done < <(yq '(. // {}) | keys | .[]' "${file}")
  if ((bad)); then exit 2; fi
}

violations() {
  local output
  output="$(kubectl --context "$1" apply --dry-run=server -n "ps-$2" -f - <<< "$3" 2>&1)" || {
    printf '%s\n' "${output}"
    return 2
  }
  grep 'would violate PodSecurity' <<< "${output}" || true
}

# Set measured to the weakest level of the rendered YAML on stdin: none, restricted, baseline,
# privileged, or error. Set details to the violations of the next stricter level.
measure() {
  local rendered unknown docs level lines previous=''
  measured=''
  details=''
  rendered="$(cat)"
  unknown="$(POD_TEMPLATE_KINDS="${POD_TEMPLATE_KINDS}" yq '
    select((.kind // "") | test(strenv(POD_TEMPLATE_KINDS)) | not)
    | select([.. | select(tag == "!!map" and has("containers"))] | length > 0)
    | .kind' <<< "${rendered}")" || {
    measured=error
    details='yq cannot read the rendered YAML.'
    return 0
  }
  if [[ -n "${unknown}" ]]; then
    measured=error
    details="${unknown} holds containers, and check.sh does not examine this kind. Add it to POD_TEMPLATE_KINDS."
    return 0
  fi
  docs="$(POD_TEMPLATE_KINDS="${POD_TEMPLATE_KINDS}" yq 'select((.kind // "") | test(strenv(POD_TEMPLATE_KINDS))) | del(.metadata.namespace)' <<< "${rendered}")" || {
    measured=error
    details='yq cannot read the rendered YAML.'
    return 0
  }
  if [[ -z "${docs}" ]]; then
    measured=none
    return 0
  fi
  for level in restricted baseline; do
    lines="$(violations "$1" "${level}" "${docs}")" || {
      measured=error
      details="${lines}"
      return 0
    }
    if [[ -z "${lines}" ]]; then
      measured="${level}"
      details="${previous}"
      return 0
    fi
    previous="${lines}"
  done
  measured=privileged
  details="${previous}"
}

verdict() {
  local name="$1" declared="$2" measured="$3"
  if [[ "${measured}" == none && "${declared}" != restricted ]]; then
    echo "${name} has no workload. Remove its entry from exceptions.yml."
  elif [[ "${measured}" == none || "${measured}" == "${declared}" ]]; then
    return 0
  elif (($(rank "${measured}") < $(rank "${declared}"))); then
    echo "The entry for ${name} in exceptions.yml is stale. Remove it, or set its level to ${measured}."
  else
    echo "Fix the manifest of ${name}, or add an entry with a level and a reason to exceptions.yml."
  fi
}

declared_level() {
  KEY="$1" yq -r '.[strenv(KEY)].level // "restricted"' "${EXCEPTIONS_FILE}"
}

documented_level_problems() {
  local name="$1" declared="$2" badge='' label='' namespace_file
  badge="$(grep -o 'pod_security_standard-[a-z]*' "${COMPONENTS}/${name}/README.md" 2> /dev/null | head -n 1 | cut -d- -f2 || true)"
  if [[ -n "${badge}" && "${badge}" != "${declared}" ]]; then
    echo "The README badge of ${name} shows ${badge}. Change it to ${declared}."
  fi
  namespace_file="${ROOT}/kustomization/tests/${name//\//-}/namespace.yml"
  if [[ -f "${namespace_file}" ]]; then
    label="$(yq -r '.metadata.labels["pod-security.kubernetes.io/enforce"] // ""' "${namespace_file}")"
  fi
  if [[ -f "${namespace_file}" && "${label}" != "${declared}" ]]; then
    echo "The enforce label in ${namespace_file#"${ROOT}/"} is ${label}. Change it to ${declared}."
  fi
}

check_component() {
  local context="$1" name="$2" declared rendered measured details problems
  declared="$(declared_level "${name}")"
  rendered="$(kustomize build "${COMPONENTS}/${name}")" || {
    printf 'ERROR %s: kustomize build failed.\n' "${name}"
    return 2
  }
  measure "${context}" <<< "${rendered}"
  if [[ "${measured}" == error ]]; then
    printf 'ERROR %s: the check cannot run.\n%s\n' "${name}" "${details}"
    return 2
  fi
  problems="$(
    verdict "${name}" "${declared}" "${measured}"
    documented_level_problems "${name}" "${declared}"
  )"
  if [[ -z "${problems}" ]]; then
    printf 'OK   %s: %s\n' "${name}" "${measured}"
    return 0
  fi
  printf 'FAIL %s: declared %s, measured %s.\n%s%s\n' "${name}" "${declared}" "${measured}" "${details:+${details}$'\n'}" "${problems}"
  return 1
}

main() {
  local context="${1:?usage: check.sh <kube-context>}" manifest name status failed=0 errored=0
  validate_exceptions "${EXCEPTIONS_FILE}"
  prepare "${context}"
  while read -r manifest; do
    name="${manifest#"${COMPONENTS}/"}"
    name="${name%/kustomization.yml}"
    status=0
    check_component "${context}" "${name}" || status=$?
    if ((status == 1)); then failed=1; fi
    if ((status == 2)); then errored=1; fi
  done < <(find "${COMPONENTS}" -name kustomization.yml | sort)
  if ((errored)); then return 2; fi
  return "${failed}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
