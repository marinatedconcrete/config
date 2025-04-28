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

# Generates the daemonset manifest for kube-vip.
[group('codegen')]
codegen-kube-vip-daemonset:
    #!/usr/bin/env bash
    set -euo pipefail

    # renovate: datasource=docker depName=ghcr.io/kube-vip/kube-vip
    KUBE_VIP_VERSION=v0.9.1
    DEST=kustomization/components/kube-vip/daemonset.yml
    SCRATCH=/tmp/daemonset.yml

    # First, generate the manifest with their tooling.
    docker run --network host --rm ghcr.io/kube-vip/kube-vip:${KUBE_VIP_VERSION} \
        manifest daemonset \
            --address=8.8.8.8 \
            --arp \
            --controlplane \
            --inCluster \
            --leaderElection \
            --namespace=kube-vip \
            --services \
            --servicesElection \
            --taint \
        > ${SCRATCH}

    # Update namespace to kube-vip (optional patch is documented).
    yq -iy '.metadata.namespace = "kube-vip"' ${SCRATCH}

    # Remove creationTimestamp fields as we do not care about them.
    yq -iy 'del(.metadata.creationTimestamp)' ${SCRATCH}
    yq -iy 'del(.spec.template.metadata.creationTimestamp)' ${SCRATCH}

    # Remove empty objects that get added by their generator.
    yq -iy 'del(.spec.template.spec.containers[0].resources)' ${SCRATCH}
    yq -iy 'del(.spec.updateStrategy)' ${SCRATCH}

    # Remove the tag from the image, as it is managed by the `kustomization.yml` file.
    yq -iy '.spec.template.spec.containers[0].image = "ghcr.io/kube-vip/kube-vip"' ${SCRATCH}

    # Remove VIP address, as this is a required patch.
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "address"))' ${SCRATCH}

    # Remove prometheus_server.
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "prometheus_server"))' ${SCRATCH}

    # Set cp_namespace via a reference.
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "cp_namespace") | .value)' ${SCRATCH}
    yq -iy '(.spec.template.spec.containers[0].env[] | select(.name == "cp_namespace") | .valueFrom.fieldRef.fieldPath) = "metadata.namespace"' ${SCRATCH}

    # Add our priorityClassName to the manifest.
    yq -iy '.spec.template.spec.priorityClassName = "critical-application-infra"' ${SCRATCH}

    # Sort the container's env by the name of the environment variables to set.
    yq -iy '.spec.template.spec.containers[0].env |= sort_by(.name)' ${SCRATCH}

    # Write out the final output.
    echo '# @codegen-command: just codegen-kube-vip-daemonset' > ${DEST}
    echo '# @generated' >> ${DEST}
    echo '---' >> ${DEST}
    yq -y -S '' ${SCRATCH} \
        | sed -e "s/'/\"/g" \
        >> ${DEST}

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
    renovate-config-validator renovate.json
    find renovate -name "*.json" -print | while read -r file; do 
        renovate-config-validator ${file}
    done

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
