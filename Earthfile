VERSION 0.7
FROM alpine

#
# Dependency Targets
#

kubectl:
    # renovate: datasource=github-releases depName=kubernetes/kubernetes
    ARG KUBERNETES_VERSION=v1.28.3
    ARG TARGETARCH
    ARG TARGETOS
    WORKDIR ~
    RUN wget -O kubectl https://dl.k8s.io/release/$KUBERNETES_VERSION/bin/$TARGETOS/$TARGETARCH/kubectl
    RUN chmod +x kubectl
    SAVE ARTIFACT kubectl /binary

kustomize:
    # renovate: datasource=github-releases depName=kustomize/kustomize
    ARG KUSTOMIZE_VERSION=v5.2.1
    ARG TARGETARCH
    ARG TARGETOS
    WORKDIR ~
    RUN wget -O kustomize.tar.gz https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/$KUSTOMIZE_VERSION/kustomize_"$KUSTOMIZE_VERSION"_"$TARGETOS"_"$TARGETARCH".tar.gz
    RUN tar -xf kustomize.tar.gz
    SAVE ARTIFACT kustomize /binary

minikube:
    # renovate: datasource=github-releases depName=kubernetes/minikube
    ARG MINIKUBE_VERSION=v1.34.0
    ARG TARGETARCH
    ARG TARGETOS
    WORKDIR ~
    RUN wget -O minikube https://github.com/kubernetes/minikube/releases/download/$MINIKUBE_VERSION/minikube-$TARGETOS-$TARGETARCH
    RUN chmod +x minikube
    SAVE ARTIFACT minikube /binary

#
# Working Images
#

ansible-lint:
    FROM ./ansible/+ansible

    # renovate: datasource=pypi depName=ansible-lint
    ARG ANSIBLE_LINT_VERSION=24.9.2
    RUN python3 -m pip install ansible-lint==$ANSIBLE_LINT_VERSION

    COPY --dir ansible ansible
    WORKDIR ansible
    RUN ansible-galaxy collection install --no-cache .
    RUN ansible-lint

kustomization-tests-image:
    FROM ./ansible/+ansible

    # renovate: datasource=pypi depName=kubernetes
    ARG PYKUBERNETES_VERSION=29.0.0
    RUN python3 -m pip install kubernetes==$PYKUBERNETES_VERSION

    COPY +kubectl/binary /usr/local/bin/kubectl
    COPY +kustomize/binary /usr/local/bin/kustomize
    COPY +minikube/binary /usr/local/bin/minikube

    WORKDIR workdir

#
# Workflows
#

kustomize-build:
    COPY +kustomize/binary /usr/local/bin/kustomize
    COPY kustomization kustomization
    RUN find kustomization/components/ -mindepth 1 -maxdepth 1 -type d -print | xargs -r -n1 kustomize build > /dev/null

kustomization-tests:
    FROM +kustomization-tests-image
    # Install marinatedconcrete.config collection
    COPY ansible ansible
    RUN ansible-galaxy collection install --no-cache ansible

    # Copy Kustomizations and Run Tests
    COPY kustomization kustomization
    WITH DOCKER
        RUN find kustomization/tests -mindepth 1 -maxdepth 1 -type d -print | \
            awk '{print "minikube_test__test_dir="$1}' | \
            xargs -r -n1 ansible-playbook marinatedconcrete.config.kustomization_test -e
    END

renovate-validate:
    # renovate: datasource=docker depName=renovate/renovate versioning=docker
    ARG RENOVATE_VERSION=37
    FROM renovate/renovate:$RENOVATE_VERSION
    WORKDIR /usr/src/app
    COPY renovate.json .
    RUN renovate-config-validator

validate:
    BUILD +kustomize-build
    BUILD +renovate-validate

prettier-lint:
    # renovate: datasource=docker depName=node versioning=docker
    ARG NODE_VERSION=20
    FROM node:$NODE_VERSION
    RUN corepack enable
    WORKDIR /config
    COPY --dir .pnp.cjs .yarnrc.yml package.json yarn.lock .yarn .
    RUN yarn
    COPY . .
    COPY --dir .prettierignore .prettierrc.yml .github .
    ARG write=false
    IF [ "$write" = "true" ]
      RUN yarn format
      SAVE ARTIFACT /config/* AS LOCAL .
    ELSE
      RUN yarn check-format || (echo "Lint failed. Please re-run earthly with --write=true to save the corrections" && exit 1)
    END

shellcheck-lint:
    # renovate: datasource=docker depName=koalaman/shellcheck-alpine versioning=docker
    ARG SHELLCHECK_VERSION=v0.10.0
    FROM koalaman/shellcheck-alpine:$SHELLCHECK_VERSION
    WORKDIR /mnt
    COPY . .
    RUN find . -name "*.sh" -print | xargs -r -n1 shellcheck

lint:
    BUILD +ansible-lint
    BUILD +prettier-lint
    BUILD +shellcheck-lint

images:
    BUILD ./images+all
