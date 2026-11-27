# egress-public-internet

This policy permits IPv4 HTTP and HTTPS connections on TCP ports 80 and 443.
It excludes private, shared, link-local, multicast, and reserved address ranges.
Add CoreDNS separately if these Pods need cluster DNS.
Set `networking.marinatedconcrete.com/internet-client: "true"` on each Pod that needs this access.

Replace `{version}` with the release version.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/egress-public-internet?ref=kustomize-egress-public-internet@v{version}
```

See the [egress policy guide](../../../docs/egress-policies.md) for the complete example.
