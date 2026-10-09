import copy
import json
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


def component_path(component, legacy=False):
    if legacy:
        return ROOT / "kustomization/components" / component
    return ROOT / "kustomization/pod-security" / component.removeprefix("pod-security-")


def expected_labels(components):
    labels = {}
    for component in components:
        for mode, level in PROFILES[component].items():
            labels[PREFIX + mode] = level
            version = "latest"
            if mode == "enforce" and level != "privileged":
                patch = yaml.safe_load(
                    (component_path(component) / "namespace-labels.yml").read_text()
                )
                version = patch["metadata"]["labels"][PREFIX + "enforce-version"]
                assert re.fullmatch(r"v\d+\.\d+", version), version
            labels[PREFIX + mode + "-version"] = version
    return labels


def check_render(components, legacy=False):
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
                os.path.relpath(component_path(name, legacy), directory)
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
const file = `kustomization/pod-security/${process.argv[1].replace('pod-security-', '')}/namespace-labels.yml`;
const config = JSON.parse(fs.readFileSync('renovate.json', 'utf8'));
const managers = config.customManagers.filter(manager =>
  manager.managerFilePatterns.some(pattern => new RegExp(pattern.slice(1, -1)).test(file)));
const matches = managers.flatMap(manager => manager.matchStrings.flatMap(pattern =>
  Array.from(fs.readFileSync(file, 'utf8').matchAll(new RegExp(pattern, 'g')),
    match => match.groups)));
assert.equal(matches.length, 1);
const match = matches[0];
assert.match(match.currentValue, /^v\d+\.\d+$/);
assert.equal(new RegExp(match.extractVersion).exec('v1.37.4').groups.version, 'v1.37');
assert.equal(new RegExp(match.extractVersion).exec('v1.37.0-alpha.1'), null);
""", component],
        cwd=ROOT,
        check=True,
    )


def check_release_output():
    packages = {
        "kustomization/policies": {"package-name": "kustomize-policy-bundle"},
        "kustomization/components/example": {"package-name": "kustomize-example"},
    }
    outputs = {
        "paths_released": json.dumps(list(packages)),
        "kustomization/policies--release_created": True,
        "kustomization/policies--tag_name": "kustomize-policy-bundle@v1.2.3",
        "kustomization/components/example--release_created": False,
    }
    with tempfile.TemporaryDirectory() as scratch:
        directory = Path(scratch)
        (directory / "release-please-config.json").write_text(json.dumps({"packages": packages}))
        output_file = directory / "output"
        subprocess.run(
            ["sh", str(ROOT / ".github/workflows/release-please-output-helper.sh")],
            cwd=directory,
            env={**os.environ, "OUTPUTS": json.dumps(outputs), "GITHUB_OUTPUT": str(output_file)},
            check=True,
            capture_output=True,
            text=True,
        )
        assert json.loads(output_file.read_text().removeprefix("components_json=")) == [
            {"project": "kustomize-policy-bundle", "tag": "kustomize-policy-bundle@v1.2.3"}
        ]


if __name__ == "__main__":
    component = sys.argv[1]
    assert component in PROFILES, component
    check_render([component])
    check_render([component], legacy=True)
    for partner in PROFILES:
        if component < partner and set(PROFILES[partner]).isdisjoint(PROFILES[component]):
            check_render([component, partner])
            check_render([partner, component])
    empty = subprocess.run(
        ["kustomize", "build", str(ROOT / "kustomization/components" / component)],
        check=True, capture_output=True, text=True,
    )
    assert not empty.stdout.strip(), empty.stdout
    check_renovate(component)
    if component == next(iter(PROFILES)):
        check_release_output()
    print(f"Passed {component}: labels, composition, workloads, empty render, Renovate, release")
