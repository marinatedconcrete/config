# kube-vip Component

This will deploy [kub-vip](https://kube-vip.io/). This component must run under a `privileged`
[pod security standard](https://kubernetes.io/docs/concepts/security/pod-security-standards/).

# Example Usage

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/kube-vip
```
