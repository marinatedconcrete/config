# egress-kubernetes-api

This policy permits no connections until you supply API endpoint addresses and ports.
Set `networking.marinatedconcrete.com/api-server-client: "true"` on each Pod that needs this access.

Replace `{version}` with the release version.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/egress-kubernetes-api?ref=kustomize-egress-kubernetes-api@v{version}
```

See the [egress policy guide](../../../docs/egress-policies.md) for the complete example.
