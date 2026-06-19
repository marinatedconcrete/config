# Redis component

Sets up a Redis for paperless (for now) with a small PVC for state. See the [paperless component](../paperless/README.md) for more details.

The Redis container runs as the image's `redis` user, UID/GID 999, with all
capabilities dropped, privilege escalation disabled, and `RuntimeDefault`
seccomp. The pod sets `fsGroup: 999` with `OnRootMismatch` so existing PVCs can
be mounted without requiring a recurring ownership migration.
