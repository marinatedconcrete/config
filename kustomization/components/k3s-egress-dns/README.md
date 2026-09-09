# k3s-egress-dns

This component permits access to kube-dns pods and the K3s DNS service IP on UDP/TCP 53.

## Usage

Replace `{version}` with a published version. Set your namespace in the consumer Kustomization.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/k3s-egress-dns?ref=kustomize-k3s-egress-dns@v{version}
```

You can also use the release artifact under `resources`:

```yaml
resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-k3s-egress-dns@v{version}/kustomize-k3s-egress-dns.yml
```

See the [network policy guide](../../k3s-network-policies.md) for defaults, complete patch examples, limitations, testing, and migration.
