import copy
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

import yaml


ROOT = Path(__file__).resolve().parents[2]
PREFIX = "pod-security.kubernetes.io/"
PROFILES = {
    "pod-security-audit-warn-baseline": {"audit": "baseline", "warn": "baseline"},
    "pod-security-audit-warn-restricted": {"audit": "restricted", "warn": "restricted"},
    "pod-security-enforce-baseline": {"enforce": "baseline"},
    "pod-security-enforce-restricted": {"enforce": "restricted"},
    "pod-security-enforce-privileged": {"enforce": "privileged"},
}


def expected_labels(components):
    labels = {}
    for component in components:
        for mode, level in PROFILES[component].items():
            labels[PREFIX + mode] = level
            version = "latest"
            if mode == "enforce" and level != "privileged":
                patch = yaml.safe_load(
                    (ROOT / "kustomization/components" / component / "namespace-labels.yml").read_text()
                )
                version = patch["metadata"]["labels"][PREFIX + "enforce-version"]
                assert re.fullmatch(r"v\d+\.\d+", version), version
            labels[PREFIX + mode + "-version"] = version
    return labels


def check_render(components):
    resources = [
        {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": name,
                "labels": {
                    "example.com/owner": "test",
                    **{
                        PREFIX + mode: "privileged"
                        for mode in ("audit", "warn", "enforce")
                    },
                    **{
                        PREFIX + mode + "-version": "v1.35"
                        for mode in ("audit", "warn", "enforce")
                    },
                },
            },
        }
        for name in ("first", "second")
    ]
    resources.append({
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": "example", "namespace": "first"},
        "spec": {
            "selector": {"matchLabels": {"app": "example"}},
            "template": {
                "metadata": {"labels": {"app": "example"}},
                "spec": {"containers": [{"name": "example", "image": "example:1"}]},
            },
        },
    })
    expected = copy.deepcopy(resources)
    for resource in expected[:2]:
        resource["metadata"]["labels"].update(expected_labels(components))
    with tempfile.TemporaryDirectory(dir=ROOT / "kustomization/tests") as scratch:
        directory = Path(scratch)
        (directory / "resources.yml").write_text(yaml.safe_dump_all(resources))
        kustomization = {
            "apiVersion": "kustomize.config.k8s.io/v1beta1",
            "kind": "Kustomization",
            "resources": ["resources.yml"],
            "components": [
                os.path.relpath(ROOT / "kustomization/components" / name, directory)
                for name in components
            ],
        }
        (directory / "kustomization.yml").write_text(yaml.safe_dump(kustomization))
        result = subprocess.run(
            ["kustomize", "build", str(directory)], check=True, capture_output=True, text=True
        )
        actual = list(yaml.safe_load_all(result.stdout))
        key = lambda resource: (resource["kind"], resource["metadata"]["name"])
        assert sorted(actual, key=key) == sorted(expected, key=key), (components, actual)


def check_renovate(component):
    if component not in ("pod-security-enforce-baseline", "pod-security-enforce-restricted"):
        return
    subprocess.run(
        ["node", "-e", r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = `kustomization/components/${process.argv[1]}/namespace-labels.yml`;
const config = JSON.parse(fs.readFileSync('renovate.json', 'utf8'));
const managers = config.customManagers.filter(manager =>
  manager.managerFilePatterns.some(pattern => new RegExp(pattern.slice(1, -1)).test(file)));
const matches = managers.flatMap(manager => manager.matchStrings.flatMap(pattern =>
  Array.from(fs.readFileSync(file, 'utf8').matchAll(new RegExp(pattern, 'g')),
    match => ({ ...match.groups, versioning: manager.versioningTemplate }))));
assert.equal(matches.length, 1);
const match = matches[0];
assert.equal(match.datasource, 'github-tags');
assert.equal(match.depName, 'kubernetes/kubernetes');
assert.match(match.currentValue, /^v\d+\.\d+$/);
assert.equal(match.versioning, 'semver-coerced');
assert.equal(new RegExp(match.extractVersion).exec('v1.37.4').groups.version, 'v1.37');
assert.equal(new RegExp(match.extractVersion).exec('v1.37.0-alpha.1'), null);
""", component],
        cwd=ROOT,
        check=True,
    )


if __name__ == "__main__":
    component = sys.argv[1]
    assert component in PROFILES, component
    check_render([component])
    for partner in PROFILES:
        if set(PROFILES[partner]).isdisjoint(PROFILES[component]):
            check_render([component, partner])
            check_render([partner, component])
    empty = subprocess.run(
        ["kustomize", "build", str(ROOT / "kustomization/components" / component)],
        check=True, capture_output=True, text=True,
    )
    assert not empty.stdout.strip(), empty.stdout
    check_renovate(component)
    print(f"Passed {component}: labels, composition, workloads, empty render, Renovate")
