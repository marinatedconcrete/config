FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:882b17d068262c7af4300180ead0ee14423d2c03393778c92435b0ca642dea07

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libssh-dev \
        shellcheck \
        yq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# renovate: datasource=github-releases depName=kubernetes-sigs/kind
ARG KIND_VERSION=0.32.0
RUN architecture="$(dpkg --print-architecture)" \
    && case "${architecture}" in \
        amd64 | arm64) kind_architecture="${architecture}" ;; \
        *) echo "Unsupported architecture: ${architecture}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL -o /usr/local/bin/kind \
        "https://kind.sigs.k8s.io/dl/v${KIND_VERSION}/kind-linux-${kind_architecture}" \
    && chmod 0755 /usr/local/bin/kind

WORKDIR /tmp
COPY ansible/requirements.txt requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt
