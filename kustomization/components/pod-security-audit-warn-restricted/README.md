# pod-security-audit-warn-restricted

This component sets Pod Security audit and warning labels on every Namespace resource in the Kustomization.

| Mode | Policy | Version |
| --- | --- | --- |
| audit | restricted | latest |
| warn | restricted | latest |

The component does not create Namespace resources or change workload security contexts.
Add each Namespace resource to the consumer Kustomization.
Existing labels outside these modes remain unchanged.
Without Namespace resources, this component produces no resources.

## Usage

Replace `{version}` with a released package version.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yml

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/pod-security-audit-warn-restricted?ref=kustomize-pod-security-audit-warn-restricted@v{version}
```

Create `namespace.yml` with the required namespace name.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: application
```

You can combine this component with `pod-security-enforce-baseline`.
Select one enforcement component and one audit and warning component.
Their order does not affect the labels.
Do not combine two components that set the same mode.

## Policy versions

Baseline and restricted enforcement use a fixed Kubernetes minor version.
Renovate proposes updates to these versions.
Audit, warning, and privileged enforcement use `latest`.
For `latest`, the API server selects the policy version.
Check cluster compatibility before you select a new component release.
A change to a policy version can change admission results.

Use the versioned component URL to install this component.
The release has no standalone resource manifest because this component contains only a patch.
