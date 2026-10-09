# Pod Security components

Each Pod Security component has a separate directory under `kustomization/components`.
These five components share one release-please package: `kustomize-pod-security`.
The shared Git tag has the form `kustomize-pod-security@v{version}`.

| Component                                                                                     | Modes       | Policy     |
| --------------------------------------------------------------------------------------------- | ----------- | ---------- |
| [pod-security-audit-warn-baseline](components/pod-security-audit-warn-baseline/README.md)     | audit, warn | baseline   |
| [pod-security-audit-warn-restricted](components/pod-security-audit-warn-restricted/README.md) | audit, warn | restricted |
| [pod-security-enforce-baseline](components/pod-security-enforce-baseline/README.md)           | enforce     | baseline   |
| [pod-security-enforce-restricted](components/pod-security-enforce-restricted/README.md)       | enforce     | restricted |
| [pod-security-enforce-privileged](components/pod-security-enforce-privileged/README.md)       | enforce     | privileged |

Use the same package version for each selected component.
Select one enforcement component and one audit and warning component.
The package version and the Kubernetes policy version are separate values.

## Release scope

The shared package tracks `kustomization/components` and excludes all directories without the `pod-security-` prefix.
The release workflow checks these exclusions before it runs release-please.
The lint checks also check these exclusions.
A missing exclusion stops the workflow before release-please can create a release or release pull request.

When you add an unrelated component, add its directory to the shared package's `exclude-paths` in `release-please-config.json`.
Use a repository-relative directory path.
