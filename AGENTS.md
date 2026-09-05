# Agent Instructions

## Documentation and Code Comments
- Use [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/) for all documentation and code comments.
- Apply the writing rules and the approved dictionary meanings in ASD-STE100, Issue 9.
- Use approved words. Use technical nouns and technical verbs only as the standard permits.
- Use the same term for the same item in all parts of a document.
- Use American English spelling.
- Use short sentences and the active voice. Give one instruction in each sentence.
- Use a maximum of 20 words in procedural sentences and 25 words in descriptive sentences.
- Use the imperative form for instructions. Use complete sentences for explanations.
- Do not use slang, idioms, or contractions.
- Apply these rules to Markdown files, new release notes, and comments in code, configuration files, and examples.
- Keep past changelog entries unchanged, including their wording and Markdown format. Use the standard for all new entries.
- Keep commands, identifiers, URLs, version numbers, and tool directives unchanged when you change prose.
- Keep the existing Markdown syntax style when you change prose. Preserve heading markers, list markers, and code-block formatting.
- Keep license text and third-party source text unchanged. For generated text, change the source or template when possible.
- Check the wording against the standard. A formatting check does not show ASD-STE100 compliance.

## Development Environment
- This repository uses a devcontainer. See `.devcontainer/` for its configuration. Use the devcontainer CLI to run commands in the devcontainer when possible. If the CLI is not available, run commands on the host. Report missing tools, such as `just`.
- After you open the devcontainer, run `yarn --immutable` to install dependencies and configure Prettier. See `.devcontainer/post-create-command.sh` for the setup commands.
- Use the `build_files` pattern for container images. See `devcontainer-base` and `kairos-fedora` for examples. Keep stages, arguments, mounts, labels, and final image settings in the Containerfile. Put package installation and setup commands in executable scripts under `images/<name>/build_files/`.

## Formatting and Lint Checks
- Before you make a commit, run `just format`. This command formats YAML, JSON, Markdown, and the justfile. See the justfile recipes for the formatting rules.
- Run `just check-format` to check the format.
- Run `just lint` to run the Ansible, hadolint, Kustomize, Renovate, and ShellCheck checks.

## Tests
- Run `just test` to run all Kustomize component tests. Run `just kustomization-test <component>` to test one component.

## Commit Messages
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. Use types such as `feat`, `fix`, `docs`, `chore`, and `tests`. Add `!` for a breaking change. For example, use `feat!: rename ...`.
- Keep the summary short. Put more information in the message body if necessary. Put issue or pull request references in parentheses after the summary if necessary.
- Use signed commits when possible. See commit `Support GPG Signing of Commits (#76)`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for pull request titles.
