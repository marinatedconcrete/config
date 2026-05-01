# renovate
FROM debian:stable-slim@sha256:8f0c555de6a2f9c2bda1b170b67479d11f7f5e3b66bb4a7a1d8843361c9dd3ff

# Install sshd and remove the auto-generated keys
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates openssh-server curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm /etc/ssh/ssh_host_*

# Set up the dev user
RUN useradd -ms /bin/bash -u 1000 dev && \
    mkdir -p /home/dev/.ssh && \
    chown -R dev:dev /home/dev/.ssh

COPY root /

EXPOSE 2222
USER dev
CMD ["/init.sh"]

# Where we keep config like the ssh host keys
VOLUME /config
# The data we want ssh access to. Sessions will start in this directory.
VOLUME /data
