FROM ubuntu:24.04

ARG TAG

RUN apt-get update
RUN apt-get install -y --no-install-recommends \
    htop \
    usbutils \
    vim \
    zsh
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

RUN echo "MARINATEDCONCRETE_IMAGE=ghcr.io/marinatedconcrete/ubuntu-24-lts:$TAG" >> /etc/os-release
