#!/usr/bin/env bash
# Test that each build script checks the hash of a download before it uses the file.
# A fake curl serves the files. Fake install, mv, dnf and brew commands record the calls.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

total=0
failed=0

expect_equal() {
  total=$((total + 1))
  if [[ "$3" == "$2" ]]; then
    printf 'ok   %s\n' "$1"
  else
    failed=$((failed + 1))
    printf "FAIL %s\n     expected '%s', found '%s'\n" "$1" "$2" "$3"
  fi
}

mkdir -p "${work}/bin" "${work}/fixtures" "${work}/prefix/bin"

cat > "${work}/bin/curl" <<'STUB'
#!/usr/bin/env bash
output=""
url=""
while (($# > 0)); do
  case "$1" in
    -o | --output) output="$2"; shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
printf '%s\n' "${url}" >> "${FAKE_LOG}/urls"
file="${FAKE_FIXTURES}/$(basename "${url}")"
[[ -f "${file}" ]] || exit 22
if [[ -n "${output}" ]]; then cp "${file}" "${output}"; else cat "${file}"; fi
STUB
for name in install mv dnf; do
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >> "${FAKE_LOG}/%s"\n' "${name}" > "${work}/bin/${name}"
done
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >> "${FAKE_LOG}/brew"\n' > "${work}/prefix/bin/brew"
chmod +x "${work}"/bin/* "${work}/prefix/bin/brew"

version_of() {
  sed -n "s/^$2=//p" "$1"
}

# Run a script with the fake commands. The first argument is the script path.
run_script() {
  rm -rf "${work}/log"
  mkdir -p "${work}/log"
  local status=0
  FAKE_LOG="${work}/log" FAKE_FIXTURES="${work}/fixtures" HOMEBREW_PREFIX="${work}/prefix" \
    PATH="${work}/bin:${PATH}" bash "$1" > "${work}/log/output" 2>&1 || status=$?
  printf '%s' "${status}"
}

installed() {
  if [[ -s "${work}/log/$1" ]]; then printf yes; else printf no; fi
}

# Make a tarball that holds one executable file in the directory $3.
make_tarball() {
  local dir="${work}/tar-src"
  rm -rf "${dir}"
  mkdir -p "${dir}/$3"
  printf '#!/bin/sh\n' > "${dir}/$3/$2"
  if [[ "$3" == . ]]; then
    tar -czf "$1" -C "${dir}" "$2"
  else
    tar -czf "$1" -C "${dir}" "$3/$2"
  fi
}

tamper() {
  printf 'tampered' >> "$1"
}

check_tool() {
  local name="$1" script="$2" status

  rm -f "${work}"/fixtures/*
  "setup_${name}" good
  status="$(run_script "${script}")"
  expect_equal "${name}: a download with a matching hash is installed" "0 yes" "${status} $(installed "${INSTALL_LOG}")"

  rm -f "${work}"/fixtures/*
  "setup_${name}" bad
  status="$(run_script "${script}")"
  if [[ "${status}" != 0 ]]; then status=nonzero; fi
  expect_equal "${name}: a download with a wrong hash is rejected" "nonzero no" "${status} $(installed "${INSTALL_LOG}")"

  rm -f "${work}"/fixtures/*
  "setup_${name}" none
  status="$(run_script "${script}")"
  if [[ "${status}" != 0 ]]; then status=nonzero; fi
  expect_equal "${name}: a missing hash file is rejected" "nonzero no" "${status} $(installed "${INSTALL_LOG}")"
}

# Each setup function writes the fixtures. The argument is good, bad, or none.
# The bad mode changes the artifact after the hash file is written.
# The none mode writes no hash file.

setup_helm() {
  local script="${ROOT}/.devcontainer/build_files/packages/helm.sh" v archive
  v="$(version_of "${script}" HELM_VERSION)"
  archive="${work}/fixtures/helm-${v}-linux-amd64.tar.gz"
  make_tarball "${archive}" helm linux-amd64
  if [[ "$1" != none ]]; then
    (cd "${work}/fixtures" && sha256sum "$(basename "${archive}")" > "$(basename "${archive}").sha256sum")
  fi
  if [[ "$1" == bad ]]; then tamper "${archive}"; fi
}

setup_actionlint() {
  local script="${ROOT}/.devcontainer/build_files/packages/actionlint.sh" v archive
  v="$(version_of "${script}" ACTIONLINT_VERSION)"
  archive="${work}/fixtures/actionlint_${v}_linux_amd64.tar.gz"
  make_tarball "${archive}" actionlint .
  if [[ "$1" != none ]]; then
    (cd "${work}/fixtures" && sha256sum "$(basename "${archive}")" > "actionlint_${v}_checksums.txt")
  fi
  if [[ "$1" == bad ]]; then tamper "${archive}"; fi
}

setup_just() {
  local script="${ROOT}/images/devcontainer-base/build_files/packages/just.sh" v archive
  v="$(version_of "${script}" JUST_VERSION)"
  archive="${work}/fixtures/just-${v}-x86_64-unknown-linux-musl.tar.gz"
  make_tarball "${archive}" just .
  if [[ "$1" != none ]]; then
    (cd "${work}/fixtures" && sha256sum "$(basename "${archive}")" > SHA256SUMS)
  fi
  if [[ "$1" == bad ]]; then tamper "${archive}"; fi
}

setup_kubectl() {
  local script="${ROOT}/.devcontainer/build_files/packages/kubectl.sh"
  printf 'kubectl binary' > "${work}/fixtures/kubectl"
  if [[ "$1" != none ]]; then
    sha256sum "${work}/fixtures/kubectl" | cut -d ' ' -f 1 > "${work}/fixtures/kubectl.sha256"
  fi
  if [[ "$1" == bad ]]; then tamper "${work}/fixtures/kubectl"; fi
  : "${script}"
}

setup_minikube() {
  printf 'minikube binary' > "${work}/fixtures/minikube-linux-amd64"
  if [[ "$1" != none ]]; then
    sha256sum "${work}/fixtures/minikube-linux-amd64" | cut -d ' ' -f 1 > "${work}/fixtures/minikube-linux-amd64.sha256"
  fi
  if [[ "$1" == bad ]]; then tamper "${work}/fixtures/minikube-linux-amd64"; fi
}

setup_github_cli() {
  local script="${ROOT}/.devcontainer/build_files/packages/github-cli.sh" v rpm
  v="$(version_of "${script}" GH_VERSION)"
  rpm="${work}/fixtures/gh_${v}_linux_amd64.rpm"
  printf 'rpm package' > "${rpm}"
  if [[ "$1" != none ]]; then
    (cd "${work}/fixtures" && sha256sum "$(basename "${rpm}")" > "gh_${v}_checksums.txt")
  fi
  if [[ "$1" == bad ]]; then tamper "${rpm}"; fi
}

INSTALL_LOG=install
check_tool helm "${ROOT}/.devcontainer/build_files/packages/helm.sh"
check_tool actionlint "${ROOT}/.devcontainer/build_files/packages/actionlint.sh"
check_tool kubectl "${ROOT}/.devcontainer/build_files/packages/kubectl.sh"
check_tool minikube "${ROOT}/.devcontainer/build_files/packages/minikube.sh"
INSTALL_LOG=mv
check_tool just "${ROOT}/images/devcontainer-base/build_files/packages/just.sh"
INSTALL_LOG=dnf
check_tool github_cli "${ROOT}/.devcontainer/build_files/packages/github-cli.sh"

# Homebrew: a copy of the script has the hash of the test installer.
brew_script="${ROOT}/images/github-runner-ci/build_files/packages/homebrew.sh"
rm -f "${work}"/fixtures/*
printf 'echo installer ran\n' > "${work}/fixtures/install.sh"
good_hash="$(sha256sum "${work}/fixtures/install.sh" | cut -d ' ' -f 1)"
sed "s/^HOMEBREW_INSTALL_SHA256=.*/HOMEBREW_INSTALL_SHA256=\"${good_hash}\"/" "${brew_script}" > "${work}/homebrew-good.sh"
INSTALL_LOG=brew
status="$(run_script "${work}/homebrew-good.sh")"
expect_equal 'homebrew: an installer with a matching hash runs' "0 yes" "${status} $(installed brew)"
printf 'echo changed installer\n' > "${work}/fixtures/install.sh"
status="$(run_script "${work}/homebrew-good.sh")"
if [[ "${status}" != 0 ]]; then status=nonzero; fi
expect_equal 'homebrew: an installer with a wrong hash is rejected' "nonzero no" "${status} $(installed brew)"
expect_equal 'homebrew: the installer URL is pinned to a commit' 0 "$(grep -c '/Homebrew/install/HEAD/' "${brew_script}" || true)"

printf '%d of %d checks failed\n' "${failed}" "${total}"
((failed == 0))
