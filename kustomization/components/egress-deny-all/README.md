# egress-deny-all

This policy isolates all Pods in the namespace for egress.
Other NetworkPolicies can permit specific connections.
Configure ingress separately.

Replace `{version}` with the release version.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/egress-deny-all?ref=kustomize-egress-deny-all@v{version}
```

See the [egress policy guide](../../../docs/egress-policies.md) for the complete example.
