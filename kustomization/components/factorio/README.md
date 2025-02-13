# Factorio Server Component

This will deploy the [Open Factorio Server Manager](https://github.com/OpenFactorioServerManager/factorio-server-manager).

This also requires our PriorityClass component.

# Example Usage

Note: please replace `{version}` with the desired version you wish to use.  [Here is a full list of GitHub releases for this component.](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-factorio%22).

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/factorio?ref=kustomize-factorio@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-factorio@v{version}/factorio.yml
```
