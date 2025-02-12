# PriorityClass Component

This sets up a number of common priority classes that are used in this repository.

# Example Usage

Note: please replace `{version}` with the desired version you wish to use.  [Here is a full list of GitHub releases for this component.](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-priorityclass%22).

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/priorityclass?ref=kustomize-priorityclass@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-priorityclass@v{version}/priorityclass.yml
```
