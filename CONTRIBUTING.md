# Contributing

Thank you for your help with this repository.
This repository holds several parts, and each part has its own version and release.
See the [README](README.md) for the list of parts.

## Set up

- Use the devcontainer in `.devcontainer/`. It runs `.devcontainer/post-create-command.sh` when it creates the container. That script installs the package manager, the dependencies, and the Ansible collection.
- Run `pnpm install --frozen-lockfile` again after a change to `pnpm-lock.yaml`. The script runs only when the container is created.
- Run `just` to list the recipes.

## Make a change

- Read [AGENTS.md](AGENTS.md). It has the writing rules, the commit message rules, and the commands to run before a commit.
- Run `just format` before a commit. Run `just lint` and `just test` to check a change.
- Use the [pull request template](.github/pull_request_template.md). The pull request title must follow [Conventional Commits](https://www.conventionalcommits.org/).
- Read the QA page in [docs/qa/](docs/qa) for the part that you change. It lists the checks that the part needs.

## Report a problem or ask for a feature

Open an issue with the [issue templates](.github/ISSUE_TEMPLATE).

## Add a Kustomize component

Use the prompt in [.github/prompts/add-kustomize-component.prompt.md](.github/prompts/add-kustomize-component.prompt.md). It is for people and for coding agents.
