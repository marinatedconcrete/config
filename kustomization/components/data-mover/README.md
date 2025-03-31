# Data Mover Component

This will move data from one persistent volume claim to another.

# Example Usage

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/data-mover
namespace: TARGET_NAMESPACE
patches:
  - patch: |-
      apiVersion: batch/v1
      kind: Job
      metadata:
        name: data-mover
      spec:
        template:
          spec:
            volumes:
              - name: source
                persistentVolumeClaim:
                  claimName: SOURCE-CLAIM-NAME
              - name: destination
                persistentVolumeClaim:
                  claimName: DESTINATION-CLAIM-NAME
```
# How to Use

1) Bring down whatever is currently using the volume.
2) Take note of the pvc and pv it references.
3) Delete that pvc.
4) Edit the pv and remove the existing `claimRef`.
5) Create a new pvc with the settings you want (which will also create a new pv).
6) Create a temporary pvc referencing the original volume.
7) Apply the correct patch to reference the new and old pvc, and apply the component.
8) Wait for Job completion.
9) Delete Job and temporary pvc.
10) Restart whatever needed to be brought up.
