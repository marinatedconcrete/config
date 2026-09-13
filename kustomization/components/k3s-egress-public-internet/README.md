# k3s-egress-public-internet

This component includes DNS and permits access to IPv4 destinations outside RFC1918.
Other ranges can have local routes. Add exclusions for those ranges.

## Usage

Replace `{version}` with a published version. Set your namespace in the consumer Kustomization.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/k3s-egress-public-internet?ref=kustomize-k3s-egress-public-internet@v{version}
```

You can also use the release artifact under `resources`:

```yaml
resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-k3s-egress-public-internet@v{version}/kustomize-k3s-egress-public-internet.yml
```

See the [network policy guide](../../k3s-network-policies.md) for defaults, complete patch examples, limitations, testing, and migration.
