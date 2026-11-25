#!/usr/bin/env bash
# Usage: check.sh <kube-context>
# Check that each rendered component meets its declared Pod Security level.
# Exit 0 when all components pass, 1 when a component fails, 2 when the check cannot run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPONENTS="${ROOT}/kustomization/components"
LEVELS_FILE="${LEVELS_FILE:-${ROOT}/kustomization/pod-security-check/levels.yml}"
# The kinds that Pod Security admission examines.
KINDS='^(Pod|PodTemplate|ReplicationController|ReplicaSet|Deployment|StatefulSet|DaemonSet|Job|CronJob)$'

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

validate_levels() {
  local file="$1" key level reason bad=0
  if [[ "$(yq 'tag' "${file}")" != '!!map' ]]; then
    echo "ERROR ${file}: the file must be a map." >&2
    exit 2
  fi
  while IFS='|' read -r key level reason; do
    if [[ ! -f "${COMPONENTS}/${key}/kustomization.yml" ]]; then
      echo "ERROR ${file}: ${key} is not a component." >&2
      bad=1
    fi
    if [[ "${level}" != baseline && "${level}" != privileged ]]; then
      echo "ERROR ${file}: ${key} must have the level baseline or privileged." >&2
      bad=1
    fi
    if [[ -z "${reason}" ]]; then
      echo "ERROR ${file}: ${key} must have a reason." >&2
      bad=1
    fi
  done < <(yq -r 'to_entries | .[] | [.key, (.value | select(tag == "!!map") | .level // ""), (.value | select(tag == "!!map") | .reason // "")] | join("|")' "${file}")
  if ((bad)); then exit 2; fi
}

# Print the PodSecurity warnings for the documents at one level. Return 2 when kubectl fails.
violations() {
  local output
  output="$(kubectl --context "$1" apply --dry-run=server -n "ps-$2" -f - <<< "$3" 2>&1)" || {
    printf '%s\n' "${output}"
    return 2
  }
  grep 'would violate PodSecurity' <<< "${output}" || true
}

# Read rendered YAML on stdin. Print the weakest measured level on line 1: none, restricted,
# baseline, privileged, or error. Print the violations of the next stricter level after it.
measure() {
  local rendered unknown docs level lines previous=''
  rendered="$(cat)"
  unknown="$(KINDS="${KINDS}" yq '
    select((.kind // "") | test(strenv(KINDS)) | not)
    | select([.. | select(tag == "!!map" and has("containers"))] | length > 0)
    | .kind' <<< "${rendered}")"
  if [[ -n "${unknown}" ]]; then
    printf 'error\n%s holds containers, and check.sh does not examine this kind. Add it to KINDS.\n' "${unknown}"
    return 0
  fi
  docs="$(KINDS="${KINDS}" yq 'select((.kind // "") | test(strenv(KINDS))) | del(.metadata.namespace)' <<< "${rendered}")"
  if [[ -z "${docs}" ]]; then
    echo none
    return 0
  fi
  for level in restricted baseline; do
    lines="$(violations "$1" "${level}" "${docs}")" || {
      printf 'error\n%s\n' "${lines}"
      return 0
    }
    if [[ -z "${lines}" ]]; then
      printf '%s\n' "${level}"
      [[ -z "${previous}" ]] || printf '%s\n' "${previous}"
      return 0
    fi
    previous="${lines}"
  done
  printf 'privileged\n%s\n' "${previous}"
}

# Print the problem, or nothing when the measured level is acceptable.
verdict() {
  local name="$1" declared="$2" measured="$3"
  if [[ "${measured}" == none && "${declared}" != restricted ]]; then
    echo "${name} has no workload. Remove its entry from levels.yml."
  elif [[ "${measured}" == none || "${measured}" == "${declared}" ]]; then
    return 0
  elif (($(rank "${measured}") < $(rank "${declared}"))); then
    echo "The entry for ${name} in levels.yml is stale. Remove it, or set its level to ${measured}."
  else
    echo "Fix the manifest of ${name}, or add an entry with a level and a reason to levels.yml."
  fi
}

declared_level() {
  KEY="$1" yq -r '.[strenv(KEY)].level // "restricted"' "${LEVELS_FILE}"
}

# Print one problem for each place that shows a level other than the declared level.
surface_problems() {
  local name="$1" declared="$2" badge='' label='' namespace_file
  badge="$(grep -o 'pod_security_standard-[a-z]*' "${COMPONENTS}/${name}/README.md" 2> /dev/null | head -n 1 | cut -d- -f2 || true)"
  if [[ -n "${badge}" && "${badge}" != "${declared}" ]]; then
    echo "The README badge of ${name} shows ${badge}. Change it to ${declared}."
  fi
  namespace_file="${ROOT}/kustomization/tests/${name//\//-}/namespace.yml"
  if [[ -f "${namespace_file}" ]]; then
    label="$(yq -r '.metadata.labels["pod-security.kubernetes.io/enforce"] // ""' "${namespace_file}")"
  fi
  if [[ -n "${label}" && "${label}" != "${declared}" ]]; then
    echo "The enforce label in ${namespace_file#"${ROOT}/"} is ${label}. Change it to ${declared}."
  fi
}

# Print the result of one component. Return 0 for a pass, 1 for a failure, 2 for a check error.
check_component() {
  local context="$1" name="$2" declared rendered result measured details problems
  declared="$(declared_level "${name}")"
  rendered="$(kustomize build "${COMPONENTS}/${name}" 2>&1)" || {
    printf 'ERROR %s: kustomize build failed.\n%s\n' "${name}" "${rendered}"
    return 2
  }
  result="$(measure "${context}" <<< "${rendered}")"
  measured="${result%%$'\n'*}"
  details="${result#"${measured}"}"
  if [[ "${measured}" == error ]]; then
    printf 'ERROR %s: the check cannot run.%s\n' "${name}" "${details}"
    return 2
  fi
  problems="$(
    verdict "${name}" "${declared}" "${measured}"
    surface_problems "${name}" "${declared}"
  )"
  if [[ -z "${problems}" ]]; then
    printf 'OK   %s: %s\n' "${name}" "${measured}"
    return 0
  fi
  printf 'FAIL %s: declared %s, measured %s.%s\n%s\n' "${name}" "${declared}" "${measured}" "${details}" "${problems}"
  return 1
}

main() {
  local context="${1:?usage: check.sh <kube-context>}" manifest name status failed=0 errored=0
  validate_levels "${LEVELS_FILE}"
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
