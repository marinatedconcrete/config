# Authelia Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fauthelia&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-authelia%22)
[![Pod Security Standard: Restricted](https://img.shields.io/badge/pod_security_standard-restricted-green?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Fauthelia%2Fdeployment.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs [Authelia](https://www.authelia.com/).
It uses one replica with in-memory sessions and persistent SQLite storage.

# Examples

Replace `{version}` with the version that you want to use.

Add the priorityclass component and the required Secret to your Kustomization.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/authelia?ref=kustomize-authelia@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-authelia@v{version}/authelia.yml
```

# Required setup

Set a default StorageClass or set `spec.storageClassName` on the `authelia-data` claim.
Configure your HTTPS reverse proxy to use `authelia-svc` on port 9091.
See the [Authelia proxy guides](https://www.authelia.com/integration/proxies/introduction/).

# Required Secret

Create the Secret in the same namespace as the Deployment.
Replace the example domains and storage encryption key.
Keep the same encryption key for the life of the database.

Generate a password hash with `authelia crypto hash generate argon2`.
Insert the hash in `users.yml` with the user name and email address.
Restart the Deployment after you change the Secret.

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  name: authelia-config
stringData:
  configuration.yml: |
    authentication_backend:
      password_reset:
        disable: true
      file:
        path: /config/users.yml
    access_control:
      default_policy: deny
      rules:
        - domain: app.example.com
          policy: one_factor
    session:
      cookies:
        - domain: example.com
          authelia_url: https://auth.example.com
    storage:
      local:
        path: /data/db.sqlite3
    notifier:
      filesystem:
        filename: /data/notifications.txt
  users.yml: |
    users:
      example:
        displayname: Example User
        password: REPLACE_WITH_ARGON2_HASH
        email: user@example.com
  storage-encryption-key: REPLACE_WITH_A_RANDOM_STORAGE_ENCRYPTION_KEY
```

The password file is read-only.
Change passwords in the Secret.
The filesystem notifier writes messages to the claim.

# Optional high availability

For a new HA deployment, use shared PostgreSQL, Redis, LDAP, and SMTP services.
Use highly available PostgreSQL and Redis endpoints for database and session failover.
Use LDAP as the authentication backend in this mode.
See [Authelia's statelessness requirements](https://www.authelia.com/overview/authorization/statelessness/).

In the Secret example, keep the access control and cookie settings.
Replace the authentication backend, storage, and notifier sections with the sections below.
Add the `redis` section and retain `cookies` under the same `session` key.
Remove `users.yml` from the Secret.

```yaml
authentication_backend:
  password_reset:
    disable: true
  ldap:
    implementation: custom
    address: ldaps://ldap.example.com:636
    base_dn: dc=example,dc=com
    user: cn=authelia,ou=services,dc=example,dc=com
    additional_users_dn: ou=people
    users_filter: (&({username_attribute}={input})(objectClass=inetOrgPerson))
    additional_groups_dn: ou=groups
    groups_filter: (&(member={dn})(objectClass=groupOfNames))
    attributes:
      username: uid
      display_name: cn
      mail: mail
      group_name: cn
session:
  redis:
    host: redis.example.com
    port: 6379
    tls:
      server_name: redis.example.com
storage:
  postgres:
    address: tcp://postgres.example.com:5432
    database: authelia
    username: authelia
    tls:
      server_name: postgres.example.com
notifier:
  smtp:
    address: submission://smtp.example.com:587
    sender: authelia@example.com
    username: authelia
```

Add these keys to the Secret's `stringData`.
Use the same session secret and storage encryption key for all replicas.

```yaml
ldap-password: REPLACE_WITH_LDAP_PASSWORD
redis-password: REPLACE_WITH_REDIS_PASSWORD
session-secret: REPLACE_WITH_A_RANDOM_SESSION_SECRET
postgres-password: REPLACE_WITH_POSTGRES_PASSWORD
smtp-password: REPLACE_WITH_SMTP_PASSWORD
```

Add these patches to your Kustomization.
The Deployment patch removes the local data mount.
The second patch removes the unused claim from the rendered manifests.
Before you change an existing deployment, back up the claim and plan the database migration.

```yaml
patches:
  - target:
      kind: Deployment
      name: authelia-deployment
    patch: |
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: authelia-deployment
      spec:
        replicas: 2
        strategy:
          type: RollingUpdate
        template:
          spec:
            topologySpreadConstraints:
              - maxSkew: 1
                topologyKey: kubernetes.io/hostname
                whenUnsatisfiable: ScheduleAnyway
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/name: authelia
            containers:
              - name: authelia
                env:
                  - name: AUTHELIA_AUTHENTICATION_BACKEND_LDAP_PASSWORD_FILE
                    value: /config/ldap-password
                  - name: AUTHELIA_SESSION_REDIS_PASSWORD_FILE
                    value: /config/redis-password
                  - name: AUTHELIA_SESSION_SECRET_FILE
                    value: /config/session-secret
                  - name: AUTHELIA_STORAGE_POSTGRES_PASSWORD_FILE
                    value: /config/postgres-password
                  - name: AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE
                    value: /config/smtp-password
                volumeMounts:
                  - mountPath: /data
                    $patch: delete
            volumes:
              - name: data
                $patch: delete
  - target:
      kind: PersistentVolumeClaim
      name: authelia-data
    patch: |
      $patch: delete
      apiVersion: v1
      kind: PersistentVolumeClaim
      metadata:
        name: authelia-data
```
