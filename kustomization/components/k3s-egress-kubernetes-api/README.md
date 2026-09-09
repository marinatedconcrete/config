# k3s-egress-kubernetes-api

Require a patch supplying API endpoints and ports. Unpatched, this selects all pods and allows no egress; it does not discover endpoints.

## Usage

Replace `{version}` with a published version. Set your namespace in the consuming Kustomization.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/k3s-egress-kubernetes-api?ref=kustomize-k3s-egress-kubernetes-api@v{version}
```

Alternatively, use the release artifact under `resources`:

```yaml
resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-k3s-egress-kubernetes-api@v{version}/kustomize-k3s-egress-kubernetes-api.yml
```

See the [network policy guide](../../k3s-network-policies.md) for defaults, complete patch examples, limitations, testing, and migration.
