FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:77238990f09e14b9baecb21c620bb919a6293fdb7a539d19f53996860b47a00a

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        libssh-dev \
        shellcheck \
        yq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
COPY ansible/requirements.txt requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt
