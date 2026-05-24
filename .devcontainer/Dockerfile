FROM mcr.microsoft.com/devcontainers/python:3-3.14@sha256:882b17d068262c7af4300180ead0ee14423d2c03393778c92435b0ca642dea07

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
