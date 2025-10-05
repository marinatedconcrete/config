Role Name
=========

This role walks every Longhorn `Volume`, and enables the `discards` flag on it
so that [the trim command can work](https://longhorn.io/docs/1.9.1/nodes-and-volumes/volumes/trim-filesystem/#encrypted-volumes).

Requirements
------------

The target systems must have [`pexpect`](https://pypi.org/project/pexpect/) installed.

Role Variables
--------------


Dependencies
------------

This requires the [kubernetes.core collection](https://galaxy.ansible.com/ui/repo/published/kubernetes/core/).

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
