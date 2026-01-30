FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:99bf0ccea2570de791b53370bf17d0aa103a4faf396b5fb968462f65267bc6a5

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
