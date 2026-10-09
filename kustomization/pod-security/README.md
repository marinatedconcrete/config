# Pod Security components

These five components share one release-please package: `kustomize-pod-security`.
The shared Git tag has the form `kustomize-pod-security@v{version}`.
Release-please tracks only this directory for the shared release.
Components in `kustomization/components` have separate release configuration.

| Component                                                | Modes       | Policy     |
| -------------------------------------------------------- | ----------- | ---------- |
| [audit-warn-baseline](audit-warn-baseline/README.md)     | audit, warn | baseline   |
| [audit-warn-restricted](audit-warn-restricted/README.md) | audit, warn | restricted |
| [enforce-baseline](enforce-baseline/README.md)           | enforce     | baseline   |
| [enforce-restricted](enforce-restricted/README.md)       | enforce     | restricted |
| [enforce-privileged](enforce-privileged/README.md)       | enforce     | privileged |

Use the same package version for each selected component.
Select one enforcement component and one audit and warning component.
The package version and the Kubernetes policy version are separate values.

The existing `kustomization/components/pod-security-*` paths load the components in this directory.
These paths remain available for existing installations.
The release build tests both sets of component paths.
