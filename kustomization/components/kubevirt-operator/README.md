# Kubevirt Operator

Dependencies: operator-lifecycle-manager

This will install the [Kubevirt](https://operatorhub.io/operator/community-kubevirt-hyperconverged) and its CRDs.

## Example Usage

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/kubevirt-operator
```
