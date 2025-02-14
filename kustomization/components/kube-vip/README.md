# kube-vip Component

This will deploy [kub-vip](https://kube-vip.io/). This component must run under a `privileged`
[pod security standard](https://kubernetes.io/docs/concepts/security/pod-security-standards/).

# Example Usage

Note: please replace `{version}` with the desired version you wish to use.  [Here is a full list of GitHub releases for this component.](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-kube-vip%22).

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/kube-vip?ref=kustomize-kube-vip@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-kube-vip@v{version}/kube-vip.yml
```
