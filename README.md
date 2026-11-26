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
| [Justfile modules](justfile-modules/README.md)          | `justfile-modules/`         | Reusable Just recipes for other repositories.                                                                                |
| [Renovate presets](renovate/README.md)                  | `renovate/`                 | Shared [Renovate](https://docs.renovatebot.com/) presets that other repositories can extend.                                 |
| [Release automation](.github/release/README.md)         | `.github/release/`          | Scripts that plan, validate, and publish releases.                                                                           |

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up, make a change, and report a problem.

## Documentation

- [docs/qa/](docs/qa) has one review page for each part. Each page lists the checks that a change to that part needs.
- [.github/prompts/](.github/prompts) has prompts for coding agents. One adds a Kustomize component. One reviews a pull request.

## Releases

[Release Please](https://github.com/googleapis/release-please) opens a release pull request for each part when its changes land.
See [Release automation](.github/release/README.md) for the release sequence.
Renovate updates the dependencies. See [docs/qa/renovate-presets.md](docs/qa/renovate-presets.md) for its rules.

## License

This repository uses the [BSD 3-Clause License](LICENSE).
