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

# Generates the manifests for kube-vip.
[group('codegen')]
codegen-kube-vip:
    #!/usr/bin/env bash
    set -euo pipefail

    # renovate: datasource=docker depName=ghcr.io/kube-vip/kube-vip
    KUBE_VIP_VERSION=v1.0.1

    # VIP DaemonSet manifest generation.
    DEST=kustomization/components/kube-vip/daemonset/vip.yml
    SCRATCH=$(mktemp --tmpdir daemonset-XXX.yml)
    docker run --network host --rm ghcr.io/kube-vip/kube-vip:${KUBE_VIP_VERSION} \
        manifest daemonset \
            --address=8.8.8.8 \
            --arp \
            --controlplane \
            --inCluster \
            --leaderElection \
            --taint \
        > ${SCRATCH}

    # Drop namespace and let user configure this.
    yq -iy 'del(.metadata.namespace)' ${SCRATCH}

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

    # Add appropriate priorityClassName to the manifest.
    yq -iy '.spec.template.spec.priorityClassName = "system-cluster-critical"' ${SCRATCH}

    # Sort the container's env by the name of the environment variables to set.
    yq -iy '.spec.template.spec.containers[0].env |= sort_by(.name)' ${SCRATCH}

    # Write out the final output.
    echo '# @codegen-command: just codegen-kube-vip' > ${DEST}
    echo '# @generated' >> ${DEST}
    echo '---' >> ${DEST}
    yq -y -S '' ${SCRATCH} \
        | sed -e "s/'/\"/g" \
        >> ${DEST}


    # Services DaemonSet manifest generation.
    DEST=kustomization/components/kube-vip/daemonset/services.yml
    SCRATCH=$(mktemp --tmpdir daemonset-XXX.yml)
    docker run --network host --rm ghcr.io/kube-vip/kube-vip:${KUBE_VIP_VERSION} \
        manifest daemonset \
            --arp \
            --inCluster \
            --services \
            --servicesElection \
        > ${SCRATCH}

    # Set a unique name that is different from the control plane daemonset.
    yq -iy '.metadata.name = "kube-vip-svc-ds"' ${SCRATCH}
    yq -iy '.spec.selector.matchLabels."app.kubernetes.io/name" = "kube-vip-svc-ds"' ${SCRATCH}
    yq -iy '.spec.template.metadata.labels."app.kubernetes.io/name" = "kube-vip-svc-ds"' ${SCRATCH}

    # Drop namespace and let user configure this.
    yq -iy 'del(.metadata.namespace)' ${SCRATCH}

    # Remove creationTimestamp fields as we do not care about them.
    yq -iy 'del(.metadata.creationTimestamp)' ${SCRATCH}
    yq -iy 'del(.spec.template.metadata.creationTimestamp)' ${SCRATCH}

    # Remove empty objects that get added by their generator.
    yq -iy 'del(.spec.template.spec.containers[0].resources)' ${SCRATCH}
    yq -iy 'del(.spec.updateStrategy)' ${SCRATCH}

    # Remove the tag from the image, as it is managed by the `kustomization.yml` file.
    yq -iy '.spec.template.spec.containers[0].image = "ghcr.io/kube-vip/kube-vip"' ${SCRATCH}

    # Remove unused environment settings.
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "dns_mode"))' ${SCRATCH}
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "port"))' ${SCRATCH}
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "prometheus_server"))' ${SCRATCH}
    yq -iy 'del(.spec.template.spec.containers[0].env[] | select(.name == "vip_address"))' ${SCRATCH}

    # Set cp_namespace via a reference.
    yq -iy '.spec.template.spec.containers[0].env += [{"name": "cp_namespace", "valueFrom": { "fieldRef": { "fieldPath": "metadata.namespace"}}}]' ${SCRATCH}

    # Add appropriate priorityClassName to the manifest.
    yq -iy '.spec.template.spec.priorityClassName = "critical-application-infra"' ${SCRATCH}

    # Sort the container's env by the name of the environment variables to set.
    yq -iy '.spec.template.spec.containers[0].env |= sort_by(.name)' ${SCRATCH}

    # Write out the final output.
    echo '# @codegen-command: just codegen-kube-vip' > ${DEST}
    echo '# @generated' >> ${DEST}
    echo '---' >> ${DEST}
    yq -y -S '' ${SCRATCH} \
        | sed -e "s/'/\"/g" \
        >> ${DEST}


    # RBAC manifest generation.
    DEST=kustomization/components/kube-vip/rbac.yml
    SCRATCH=$(mktemp --tmpdir rbac-XXX.yml)

    docker run --network host --rm ghcr.io/kube-vip/kube-vip:${KUBE_VIP_VERSION} \
        manifest rbac \
            --namespace=kube-vip \
        > ${SCRATCH}

    # Drop namespace and let user configure this.
    yq -iy 'del(.metadata.namespace)' ${SCRATCH}
    yq -iy 'del(select(.kind == "ClusterRoleBinding") | .subjects[] | select(.name == "kube-vip") | .namespace)' ${SCRATCH}

    # Sort rules.
    yq -iy '.rules[]?.resources |= sort_by(.)' ${SCRATCH}
    yq -iy '.rules[]?.verbs |= sort_by(.)' ${SCRATCH}

    # Write out the final output.
    echo '# @codegen-command: just codegen-kube-vip' > ${DEST}
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

    # We need a valid .kube/context file for ansible-lint to be happy.
    minikube start --interactive=false --profile=ansible-lint
    cd ansible && ansible-lint
    minikube stop --profile=ansible-lint

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

[group('release')]
release-please-build project dest="":
    #!/usr/bin/env bash
    set -euo pipefail

    project="{{ project }}"
    if [[ "${project}" != kustomize-* ]]; then
        echo "Unsupported release-please project: ${project}" >&2
        exit 1
    fi

    component="${project#kustomize-}"
    component_path="kustomization/components/${component}"

    if [[ ! -d "${component_path}" ]]; then
        echo "Component path not found: ${component_path}" >&2
        exit 1
    fi

    dest_path="{{ dest }}"
    if [[ -z "${dest_path}" ]]; then
        dest_path="/tmp/${component}.yml"
    fi

    # Run component tests before building the release artifact.
    just kustomization-test "${component}"
    kustomize build "${component_path}/" -o "${dest_path}"
    echo "${dest_path}"

# Regenerate Yarn integrations with other tools, like VSCode
regen-yarn-sdks:
    #!/usr/bin/env bash
    set -euo pipefail
    yarn dlx @yarnpkg/sdks
