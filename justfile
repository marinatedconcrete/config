# List all recipes.
[private]
default:
    @just --list

# Check the file format.
[group('format')]
check-format:
    #!/usr/bin/env bash
    set -euo pipefail
    just --unstable --fmt --check -f justfile
    yarn prettier --no-error-on-unmatched-pattern --check **/*.yml **/*.json **/*.md

# Generate the kube-vip manifests.
[group('codegen')]
codegen-kube-vip:
    #!/usr/bin/env bash
    set -euo pipefail

    # renovate: datasource=docker depName=ghcr.io/kube-vip/kube-vip
    KUBE_VIP_VERSION=v1.2.3
    KUBE_VIP_DIGEST=sha256:2fcdbb014a2e217b9ea1b6dacac53d6851b185af323cdd28d100ad82d74bc79a
    KUBE_VIP_IMAGE=ghcr.io/kube-vip/kube-vip@${KUBE_VIP_DIGEST}

    # Generate the VIP DaemonSet manifest.
    DEST=kustomization/components/kube-vip/daemonset/vip.yml
    SCRATCH=$(mktemp --tmpdir daemonset-XXX.yml)
    docker run --network host --rm ${KUBE_VIP_IMAGE} \
        manifest daemonset \
            --address=8.8.8.8 \
            --arp \
            --controlplane \
            --inCluster \
            --leaderElection \
            --taint \
        > ${SCRATCH}

    # Remove the namespace so the user can configure it.
    yq -i 'del(.metadata.namespace)' ${SCRATCH}

    # Remove the unused creationTimestamp fields.
    yq -i 'del(.metadata.creationTimestamp)' ${SCRATCH}
    yq -i 'del(.spec.template.metadata.creationTimestamp)' ${SCRATCH}

    # Remove empty objects from the generated manifest.
    yq -i 'del(.spec.template.spec.containers[0].resources)' ${SCRATCH}
    yq -i 'del(.spec.updateStrategy)' ${SCRATCH}

    # Remove the image tag. The `kustomization.yml` file controls this tag.
    yq -i '.spec.template.spec.containers[0].image = "ghcr.io/kube-vip/kube-vip"' ${SCRATCH}

    # Remove the VIP address. The user must set this address with a patch.
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "address"))' ${SCRATCH}

    # Remove prometheus_server.
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "prometheus_server"))' ${SCRATCH}

    # Set cp_namespace with a field reference.
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "cp_namespace") | .value)' ${SCRATCH}
    yq -i '(.spec.template.spec.containers[0].env[] | select(.name == "cp_namespace") | .valueFrom.fieldRef.fieldPath) = "metadata.namespace"' ${SCRATCH}

    # Set priorityClassName in the manifest.
    yq -i '.spec.template.spec.priorityClassName = "system-cluster-critical"' ${SCRATCH}

    # Sort the environment variables by name.
    yq -i '.spec.template.spec.containers[0].env |= sort_by(.name)' ${SCRATCH}

    # Write the final manifest.
    echo '# @codegen-command: just codegen-kube-vip' > ${DEST}
    echo '# @generated' >> ${DEST}
    echo '---' >> ${DEST}
    yq '.' ${SCRATCH} \
        | sed -e "s/'/\"/g" \
        >> ${DEST}


    # Generate the services DaemonSet manifest.
    DEST=kustomization/components/kube-vip/daemonset/services.yml
    SCRATCH=$(mktemp --tmpdir daemonset-XXX.yml)
    docker run --network host --rm ${KUBE_VIP_IMAGE} \
        manifest daemonset \
            --arp \
            --inCluster \
            --services \
            --servicesElection \
        > ${SCRATCH}

    # Set a name that differs from the control plane DaemonSet name.
    yq -i '.metadata.name = "kube-vip-svc-ds"' ${SCRATCH}
    yq -i '.spec.selector.matchLabels."app.kubernetes.io/name" = "kube-vip-svc-ds"' ${SCRATCH}
    yq -i '.spec.template.metadata.labels."app.kubernetes.io/name" = "kube-vip-svc-ds"' ${SCRATCH}

    # Remove the namespace so the user can configure it.
    yq -i 'del(.metadata.namespace)' ${SCRATCH}

    # Remove the unused creationTimestamp fields.
    yq -i 'del(.metadata.creationTimestamp)' ${SCRATCH}
    yq -i 'del(.spec.template.metadata.creationTimestamp)' ${SCRATCH}

    # Remove empty objects from the generated manifest.
    yq -i 'del(.spec.template.spec.containers[0].resources)' ${SCRATCH}
    yq -i 'del(.spec.updateStrategy)' ${SCRATCH}

    # Remove the image tag. The `kustomization.yml` file controls this tag.
    yq -i '.spec.template.spec.containers[0].image = "ghcr.io/kube-vip/kube-vip"' ${SCRATCH}

    # Remove unused environment settings.
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "dns_mode"))' ${SCRATCH}
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "port"))' ${SCRATCH}
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "prometheus_server"))' ${SCRATCH}
    yq -i 'del(.spec.template.spec.containers[0].env[] | select(.name == "vip_address"))' ${SCRATCH}

    # Set cp_namespace with a field reference.
    yq -i '.spec.template.spec.containers[0].env += [{"name": "cp_namespace", "valueFrom": { "fieldRef": { "fieldPath": "metadata.namespace"}}}]' ${SCRATCH}

    # Set priorityClassName in the manifest.
    yq -i '.spec.template.spec.priorityClassName = "critical-application-infra"' ${SCRATCH}

    # Sort the environment variables by name.
    yq -i '.spec.template.spec.containers[0].env |= sort_by(.name)' ${SCRATCH}

    # Write the final manifest.
    echo '# @codegen-command: just codegen-kube-vip' > ${DEST}
    echo '# @generated' >> ${DEST}
    echo '---' >> ${DEST}
    yq '.' ${SCRATCH} \
        | sed -e "s/'/\"/g" \
        >> ${DEST}


    # Generate the RBAC manifest.
    DEST=kustomization/components/kube-vip/rbac.yml
    SCRATCH=$(mktemp --tmpdir rbac-XXX.yml)

    docker run --network host --rm ${KUBE_VIP_IMAGE} \
        manifest rbac \
            --namespace=kube-vip \
        > ${SCRATCH}

    # Remove the namespace so the user can configure it.
    yq -i 'del(.metadata.namespace)' ${SCRATCH}
    yq -i 'del(select(.kind == "ClusterRoleBinding") | .subjects[] | select(.name == "kube-vip") | .namespace)' ${SCRATCH}

    # Sort the rules.
    yq -i '(select(.kind == "ClusterRole") | .rules[].resources) |= sort_by(.)' ${SCRATCH}
    yq -i '(select(.kind == "ClusterRole") | .rules[].verbs) |= sort_by(.)' ${SCRATCH}

    # Write the final manifest.
    echo '# @codegen-command: just codegen-kube-vip' > ${DEST}
    echo '# @generated' >> ${DEST}
    echo '---' >> ${DEST}
    yq '.' ${SCRATCH} \
        | sed -e "s/'/\"/g" \
        >> ${DEST}

# Format the files.
[group('format')]
format:
    #!/usr/bin/env bash
    set -euo pipefail
    just --unstable --fmt -f justfile
    yarn prettier --no-error-on-unmatched-pattern --log-level warn --write **/*.yml **/*.json **/*.md

# Check Ansible plays, roles, and configuration.
[group('lint')]
ansible-lint:
    #!/usr/bin/env bash
    set -euo pipefail

    # Start Minikube to supply a correct Kubernetes context for ansible-lint.
    minikube start --interactive=false --profile=ansible-lint
    cd ansible && ansible-lint
    minikube stop --profile=ansible-lint

# Check Containerfiles and Dockerfiles with hadolint.
[group('lint')]
hado-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find . -name "*erfile*" -print | while read -r file; do 
        echo -n "Running \`hadolint\` on ${file}..."
        hadolint ${file}
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Check all Kustomize files.
[group('lint')]
kustomize-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find kustomization/components -mindepth 1 -maxdepth 1 -type d -print | while read -r file; do 
        echo -n "Running \`kustomize build\` on ${file}..."
        kustomize build ${file} > /dev/null
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Check the Renovate configuration.
[group('lint')]
renovate-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    yarn renovate-config-validator renovate.json
    find renovate -name "*.json" -print | while read -r file; do
        yarn renovate-config-validator ${file}
    done

# Check shell scripts with ShellCheck.
[group('lint')]
shellcheck-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    find . -path "./.yarn" -prune -o -name "*.sh" -print | while read -r file; do
        echo -n "Running \`shellcheck\` on ${file}..."
        shellcheck ${file}
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Run all linters.
[group('lint')]
lint: ansible-lint hado-lint kustomize-lint renovate-lint shellcheck-lint

# Run the Kairos Fedora end-to-end test for startup and installation.
[group('test')]
e2e-kairos-fedora:
    #!/usr/bin/env bash
    set -euo pipefail
    bash images/kairos-fedora/e2e.sh

# Run one component test.
[group('test')]
kustomization-test component:
    ansible-playbook kustomization/tests/{{ component }}/test.yml

# Run all Kustomize component tests.
[group('test')]
kustomization-tests:
    #!/usr/bin/env bash
    set -euo pipefail
    find kustomization/tests/*/test.yml -print | while read -r file; do
        echo -n "Running tests in ${file}..."
        ansible-playbook ${file}
        echo "{{ BOLD + GREEN }}OK{{ NORMAL }}"
    done

# Run all tests..
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

    # Run component tests before the release build.
    just kustomization-test "${component}"
    kustomize build "${component_path}/" -o "${dest_path}"
    echo "${dest_path}"

# Generate the Yarn integration files for tools such as VS Code.
regen-yarn-sdks:
    #!/usr/bin/env bash
    set -euo pipefail
    yarn dlx @yarnpkg/sdks
