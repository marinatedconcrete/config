# CoralTPU device definition for generic-device-plugin

This will add a definition for the [Coral TPU USB Accelerator](https://coral.ai/products/accelerator) to your [Generic Device Plugin](https://github.com/sdwilsh/ansible-playbooks/kustomization/components/generic-device-plugin).

# Example Usage

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/sdwilsh/ansible-playbooks/kustomization/components/generic-device-plugin
  - https://github.com/marinatedconcrete/config/kustomization/components/gdp-coraltpu
```
