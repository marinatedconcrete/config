FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:1c3a6304ca90d6843915738d1adfbc4db1a660a65fa96948b88048357cc3811a

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
