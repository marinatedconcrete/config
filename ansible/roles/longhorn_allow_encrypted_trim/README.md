Role Name
=========

This role enables the `discards` flag on each Longhorn `Volume`.
This flag lets [the trim command operate](https://longhorn.io/docs/1.9.1/nodes-and-volumes/volumes/trim-filesystem/#encrypted-volumes) on encrypted volumes.

Requirements
------------

The target systems must have [`pexpect`](https://pypi.org/project/pexpect/) installed.

Role Variables
--------------


Dependencies
------------

This role needs the [kubernetes.core collection](https://galaxy.ansible.com/ui/repo/published/kubernetes/core/).

Example Playbook
----------------

```
---
- hosts: localhost
  gather_facts: false
  roles:
      - role: marinatedconcrete.config.longhorn_allow_encrypted_trim
```

License
-------

BSD-3-Clause
