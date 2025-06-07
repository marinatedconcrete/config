# AGENT Instructions

## Development Environment
- This repository uses a devcontainer (see `.devcontainer/`). Use the devcontainer CLI to run commands inside the devcontainer when possible. If the CLI is unavailable, run commands directly but note that some tools like `just` may be missing.
- After opening the devcontainer, `yarn --immutable` installs dependencies and sets up Prettier as shown in `.devcontainer/post-create-command.sh`.

## Formatting and Linting
- Run `just format` before committing to automatically format YAML, JSON and Markdown files with Prettier. Formatting rules are defined in the justfile lines 154-161.
- Use `just check-format` to verify formatting (see justfile lines 6-12).
- Run `just lint` to execute all linters including Ansible, hadolint, kustomize, renovate, and shellcheck (see justfile lines 162-214).

## Testing
- Execute `just test` to run all kustomization tests. Individual component tests can be run with `just kustomization-test <component>` (see justfile lines 216-234).

## Commit Messages
- Follow [Conventional Commits](https://www.conventionalcommits.org/) style. Commits from `sdwilsh` use types such as `feat`, `fix`, `docs`, `chore`, and `tests`, optionally with `!` for breaking changes (e.g., `feat!: rename ...`).
- Keep the summary short and use the body to provide context if needed. Issue or PR references can be placed in parentheses after the summary, as seen in commits like `Add Mosquitto Kustomize Component (#74)`.
- Signed commits are recommended as noted in commit `Support GPG Signing of Commits (#76)`.

