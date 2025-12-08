FROM mcr.microsoft.com/devcontainers/python:2-3.14@sha256:43311767f101e1c2a7bd0ecacf2c866f5c42124fc2efe45bb384eb2995ecce4d

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
