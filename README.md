# Marinated Concrete config

This repository holds the shared configuration of the Marinated Concrete home infrastructure.
It is a monorepo. Each part has its own version, changelog, and release.

## Parts

| Part                                                    | Path                        | What it is                                                                                                                   |
| ------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Kustomize components](kustomization/components)        | `kustomization/components/` | Reusable [Kustomize](https://kustomize.io/) components for a Kubernetes cluster. Most have a test in `kustomization/tests/`. |
| Container images                                        | `images/`                   | Images that are published to GHCR. Each directory has a README.                                                              |
| [GitHub Actions](actions/image-release-notes/README.md) | `actions/`                  | Composite actions. Today this is `image-release-notes`.                                                                      |
| [Ansible collection](ansible)                           | `ansible/`                  | The `marinatedconcrete.config` collection of roles.                                                                          |
| [Renovate presets](renovate/README.md)                  | `renovate/`                 | Shared [Renovate](https://docs.renovatebot.com/) presets that other repositories can extend.                                 |
| [Release automation](.github/release/README.md)         | `.github/release/`          | Scripts that plan, validate, and publish releases.                                                                           |

## Work in this repository

- Read [AGENTS.md](AGENTS.md) first. It has the writing rules, the commit message rules, and the commands to run before a commit.
- Use the devcontainer in `.devcontainer/`. Run `pnpm install --frozen-lockfile` after you open it.
- Run `just` to list the recipes. Use `just format` before a commit and `just lint` and `just test` to check a change.
- Use the [pull request template](.github/pull_request_template.md). The pull request title must follow [Conventional Commits](https://www.conventionalcommits.org/).
- Open an issue with the [issue templates](.github/ISSUE_TEMPLATE) to report a defect or ask for a feature.

## Documentation

- [docs/qa/](docs/qa) has one review page for each part. Each page lists the checks that a change to that part needs.
- [.github/prompts/](.github/prompts) has prompts for coding agents. One adds a Kustomize component. One reviews a pull request.

## Releases

[Release Please](https://github.com/googleapis/release-please) opens a release pull request for each part when its changes land.
See [Release automation](.github/release/README.md) for the release sequence.
Renovate updates the dependencies. See [docs/qa/renovate-presets.md](docs/qa/renovate-presets.md) for its rules.

## License

This repository uses the [BSD 3-Clause License](LICENSE).
