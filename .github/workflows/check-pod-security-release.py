import json
from pathlib import Path


def check_scope(root):
    package_path = Path("kustomization/components")
    config = json.loads((root / "release-please-config.json").read_text())
    excluded = config["packages"][package_path.as_posix()].get("exclude-paths", [])
    for directory in (root / package_path).iterdir():
        if not directory.is_dir():
            continue
        path = directory.relative_to(root)
        is_excluded = any(path.is_relative_to(item) for item in excluded)
        is_pod_security = directory.name.startswith("pod-security-")
        if is_pod_security and is_excluded:
            raise ValueError(f"Remove {path} from the Pod Security release exclusions.")
        if not is_pod_security and not is_excluded:
            raise ValueError(f"Add {path} to the Pod Security release exclusions.")


if __name__ == "__main__":
    check_scope(Path(__file__).resolve().parents[2])
