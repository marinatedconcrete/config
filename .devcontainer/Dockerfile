FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:9ad909ce6d84fdcbc7b337ce6d04aa630b766de78074fe64232f6f836f79f0f5

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
