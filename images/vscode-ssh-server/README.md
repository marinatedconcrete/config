# Marinated Concrete's VSCode-compatible ssh server
This runs a little ssh server that's compatible with VSCode's remote SSH feature. Unfortunately, [the LinuxServer one](https://docs.linuxserver.io/images/docker-openssh-server/) cannot be used because it is based on Alpine so it lacks glibc, a [known limitation](https://code.visualstudio.com/docs/remote/ssh#_remote-ssh-limitations).

It's also less flexible/more opinionated.

Configuration:
- Set the environment variable `AUTHORIZED_KEYS_URL` to a path containing your authorized keys. For instance, `https://github.com/$GH_USERNAME.keys`.
- Mount a small empty dir in `/config` - this will container your server's ssh host key, which must be persisted
- Mount the volume you want accessible over ssh in `/data`. When you ssh in, this is the directory where you'll start.
