# Marinated Concrete Fedora Devcontainer Base Image

Use this Fedora base image to build devcontainers for specified tasks.
The image supplies a small devcontainer environment for VS Code.
It includes Git and GitHub CLI (`gh`) for repository access.

Run `gh auth login --hostname github.com --git-protocol https --web` in each environment.
Run `gh auth setup-git --hostname github.com` to configure Git authentication.
Keep the user home directory on persistent storage to retain the login.
The image does not contain credentials.

The build workflow publishes a new version each week and after related changes.
