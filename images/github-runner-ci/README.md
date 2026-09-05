# Marinated Concrete GitHub Runner CI Image

Use this image for GitHub Actions job containers on ARC `kubernetes-novolume` runners.

The image uses `ghcr.io/marinatedconcrete/devcontainer-base` as its base.
It includes standard shell tools, system tools, and Homebrew.
The container runs as `runner` with UID/GID `1001:1001`.
These IDs match the ownership of the ARC runner workspace.
The `runner` user can write to its home directory, `/home/runner`.

Select language runtimes and tools for each CI image or workflow that uses this base image.
Examples include Node.js, Python, the GitHub CLI, Kubernetes tools, and container linters.
Workflows can use `brew` to install more packages when a job runs.
