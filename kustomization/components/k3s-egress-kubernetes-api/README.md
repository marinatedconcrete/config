# k3s-egress-kubernetes-api

This component requires a patch with API endpoints and ports.
Without the patch, it selects all pods and permits no egress.
It does not find endpoints automatically.

## Usage

Replace `{version}` with a published version. Set your namespace in the consumer Kustomization.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/k3s-egress-kubernetes-api?ref=kustomize-k3s-egress-kubernetes-api@v{version}
```

You can also use the release artifact under `resources`:

```yaml
resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-k3s-egress-kubernetes-api@v{version}/kustomize-k3s-egress-kubernetes-api.yml
```

See the [network policy guide](../../k3s-network-policies.md) for defaults, complete patch examples, limitations, testing, and migration.
