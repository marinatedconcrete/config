# k3s-deny-all-egress

Select all pods and allow no egress until another policy allows it.

## Usage

Replace `{version}` with a published version. Set your namespace in the consuming Kustomization.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/k3s-deny-all-egress?ref=kustomize-k3s-deny-all-egress@v{version}
```

Alternatively, use the release artifact under `resources`:

```yaml
resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-k3s-deny-all-egress@v{version}/kustomize-k3s-deny-all-egress.yml
```

See the [network policy guide](../../k3s-network-policies.md) for defaults, complete patch examples, limitations, testing, and migration.
