# Pod Security components

Each subdirectory is an independent Kustomize component.
Select only the components that you need.
These components share one release-please package: `kustomize-pod-security`.
The shared Git tag has the form `kustomize-pod-security@v{version}`.
Release-please tracks only this directory for the shared release.

| Component                                                | Modes       | Policy     |
| -------------------------------------------------------- | ----------- | ---------- |
| [audit-warn-baseline](audit-warn-baseline/README.md)     | audit, warn | baseline   |
| [audit-warn-restricted](audit-warn-restricted/README.md) | audit, warn | restricted |
| [enforce-baseline](enforce-baseline/README.md)           | enforce     | baseline   |
| [enforce-restricted](enforce-restricted/README.md)       | enforce     | restricted |
| [enforce-privileged](enforce-privileged/README.md)       | enforce     | privileged |

## Usage

Replace `{version}` with a released package version.
This example selects only baseline enforcement.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yml

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/pod-security/enforce-baseline?ref=kustomize-pod-security@v{version}
```

Create `namespace.yml` with the required namespace name.
Use the same package version for each selected Pod Security component.
Do not select the parent directory as a component.
The package version and the Kubernetes policy version are separate values.

For the shared release, replace old `pod-security-*` component paths with the corresponding subdirectory paths.
Previous component tags retain their original paths.
