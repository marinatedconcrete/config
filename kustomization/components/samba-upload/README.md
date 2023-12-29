# Samba Uploads Component

This component is intended to be used with the [paperless component](../paperless/README.md).

Network-enabled scanners can upload scanned documents directly to CIFS/SMB network shares. Enabling this component will create a samba container that exposes the paperless-scans PVC, enabling a direct printer-to-paperless workflow. As paperless successfully processes documents, it will delete uploaded files from this PVC.

```yaml
components:
  - https://github.com/marinatedconcrete/config/kustomization/components/samba-upload
  # ...rest of your paperless components

patches:
  # Configure the external IP for the samba service
  - path: patches/configure-samba-address.yml
    target:
      kind: Service
      name: samba
  # ...rest of your paperless patches
```
