FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:9d063a63ebbded28ff97a11f246bb43aa198f3cb7db3589c92bd1bf2e017a0cf

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
