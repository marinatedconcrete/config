# Lists all targets
[private]
default:
    @just --list

# Check if files were auto-formated properly
[group('format')]
check-format:
    #!/usr/bin/env bash
    set -euo pipefail
    just --unstable --fmt --check -f justfile
    yarn prettier --no-error-on-unmatched-pattern --check **/*.yml **/*.json **/*.md

# Auto-format files
[group('format')]
format:
    #!/usr/bin/env bash
    set -euo pipefail
    just --unstable --fmt -f justfile
    yarn prettier --no-error-on-unmatched-pattern --log-level warn --write **/*.yml **/*.json **/*.md

# Lint ansible plays, roles, and configuration
[group('lint')]
ansible-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    cd ansible && ansible-lint

# Lint Dockerfiles with hado
[group('lint')]
hado-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find . -name "Dockerfile*" -print | while read -r file; do 
        echo -n "Running \`hadolint\` on ${file}..."
        hadolint ${file}
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Lint all Kustomize files to make sure they're well formed
[group('lint')]
kustomize-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find kustomization/components -mindepth 1 -maxdepth 1 -type d -print | while read -r file; do 
        echo -n "Running \`kustomize build\` on ${file}..."
        kustomize build ${file} > /dev/null
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Lint renovate configuration
[group('lint')]
renovate-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    renovate-config-validator

# Lint shell scripts with shell check
[group('lint')]
shellcheck-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find . -name "*.sh" -print | while read -r file; do 
        echo -n "Running \`shellcheck\` on ${file}..."
        shellcheck ${file}
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Runs all linters
[group('lint')]
lint: ansible-lint hado-lint kustomize-lint renovate-lint shellcheck-lint

# Run a single test
[group('test')]
kustomization-test component:
    ansible-playbook kustomization/tests/{{ component }}/test.yml

# Run all the tests for the kustomize files
[group('test')]
kustomization-tests:
    #!/usr/bin/env bash
    set -euo pipefail
    find kustomization/tests/*/test.yml -print | while read -r file; do
        echo -n "Running tests in ${file}..."
        ansible-playbook ${file}
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Run all tests
[group('test')]
test: kustomization-tests

# Regenerate Yarn integrations with other tools, like VSCode
regen-yarn-sdks:
    #!/usr/bin/env bash
    set -euo pipefail
    yarn dlx @yarnpkg/sdks
