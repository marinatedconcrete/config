[group('format')]
check-format:
    #!/usr/bin/env bash
    set -euo pipefail
    just --unstable --fmt --check -f justfile
    yarn prettier --no-error-on-unmatched-pattern --check **/*.yml **/*.json **/*.md

[group('format')]
format:
    #!/usr/bin/env bash
    set -euo pipefail
    just --unstable --fmt -f justfile
    yarn prettier --no-error-on-unmatched-pattern --log-level warn --write **/*.yml **/*.json **/*.md

[group('lint')]
ansible-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    cd ansible && ansible-lint

[group('lint')]
kustomize-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find kustomization/components -mindepth 1 -maxdepth 1 -type d -print | grep -v components | xargs -r -n1 kustomize build > /dev/null

[group('lint')]
hado-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find . -name "Dockerfile*" -print | xargs -r -n1 hadolint

[group('lint')]
renovate-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    renovate-config-validator

[group('lint')]
shellcheck-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find . -name "*.sh" -print | xargs -r -n1 shellcheck

[group('lint')]
lint: hado-lint ansible-lint kustomize-lint renovate-lint shellcheck-lint

[group('test')]
kustomization-tests:
    #!/usr/bin/env bash
    set -euo pipefail
    find kustomization/tests -mindepth 1 -maxdepth 1 -type d -print | \
        awk '{print "minikube_test__test_dir="$1}' | \
        xargs -r -n1 ansible-playbook marinatedconcrete.config.kustomization_test -e

[group('test')]
test: kustomization-tests

regen-yarn-sdks:
    #!/usr/bin/env bash
    set -euo pipefail
    yarn
    yarn dlx @yarnpkg/sdks
