# egress-coredns

This policy permits DNS queries to CoreDNS Pods in `kube-system` on TCP and UDP port 53.
Set `networking.marinatedconcrete.com/dns-client: "true"` on each Pod that needs this access.

Replace `{version}` with the release version.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/egress-coredns?ref=kustomize-egress-coredns@v{version}
```

See the [egress policy guide](../../../docs/egress-policies.md) for the complete example.
