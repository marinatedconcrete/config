# Marinated Concrete's GitHub Runner CI Image

This image is intended for GitHub Actions job containers running on ARC
`kubernetes-novolume` runners.

It inherits from `ghcr.io/marinatedconcrete/devcontainer-base`, installs a small
set of common shell/system tools plus Homebrew, and runs as `runner` with
UID/GID `1001:1001` so job containers match the ownership of the ARC runner
workspace. The default home directory is `/home/runner`, and it is writable by
that user.

Language runtimes and domain-specific tools such as Node.js, Python, the GitHub
CLI, Kubernetes tooling, and container-specific linters are intentionally left
for downstream CI images or workflows to choose. Workflows can use `brew` to
install additional packages at job runtime.
