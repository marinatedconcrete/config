---
title: A job that runs component tests on a GitHub runner must remove the host Mosquitto AppArmor profile
type: gotcha
layer: project
state: approved
tags: [repo:marinatedconcrete/config, github-actions, apparmor, mosquitto]
source: Workflow step comments, marinatedconcrete/config#996, review on marinatedconcrete/config#1143
scope:
  paths: [.github/workflows/**, kustomization/tests/**]
  labels: [area/ci, area/kustomization]
  lanes: []
---

A GitHub-hosted runner can load an AppArmor profile for Mosquitto, at `/etc/apparmor.d/mosquitto`. The component tests run in privileged containers, so the host profile also applies to Mosquitto in the test cluster. The profile blocks Mosquitto, and the Mosquitto test fails.

Each job that runs component tests on a GitHub runner has a step that removes the profile. The step runs before the devcontainer step:

```yaml
run: |
  if [[ -f /etc/apparmor.d/mosquitto ]]; then
    sudo apparmor_parser --remove /etc/apparmor.d/mosquitto
  fi
```

- In a matrix job with one component test for each entry, use an `if` that runs the step only for the `mosquitto` entry.
- A job that runs all component tests, for example with `just test`, always needs the step.
- When you add a job that runs component tests, add the step. To find the current copies, search `.github/workflows/` for `apparmor_parser`.
