FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:1af48f9bd555f7972b14424def113c166dab9c5027bd9d9f5cc57704a42974f2

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
