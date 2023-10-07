# Prometheus Operator Component

This will deploy the
[Prometheus Operator](https://operatorhub.io/operator/prometheus)

## Example Usage

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/operator-prometheus
```
