# renovate
FROM debian:stable-slim@sha256:99fc6d2a0882fcbcdc452948d2d54eab91faafc7db037df82425edcdcf950e1f

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
