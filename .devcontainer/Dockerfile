# renovate: datasource=docker depName=python
ARG PYTHON_VERSION=3.14
FROM mcr.microsoft.com/devcontainers/python:2-${PYTHON_VERSION}

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
