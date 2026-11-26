# Redis Component

[![Pod Security Standard: Restricted](https://img.shields.io/badge/pod_security_standard-restricted-green?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

This component installs Redis for Paperless with a small PVC for stored data.
See the [Paperless component](../paperless/README.md) for more information.

The Redis container runs as the `redis` user with UID/GID 999.
The container disables all capabilities and privilege escalation.
It uses the `RuntimeDefault` seccomp profile.
The pod sets `fsGroup: 999` and uses `OnRootMismatch`.
These settings let the container mount existing PVCs without repeated ownership changes.
