# Frigate Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Ffrigate&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-frigate%22)
[![Pod Security Standard: Baseline](https://img.shields.io/badge/pod_security_standard-baseline-yellow?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
[![Priority Class](https://img.shields.io/badge/dynamic/yaml?style=for-the-badge&label=priorityclass&url=https%3A%2F%2Fgithub.com%2Fmarinatedconcrete%2Fconfig%2Fraw%2Frefs%2Fheads%2Fmain%2Fkustomization%2Fcomponents%2Ffrigate%2Fdeployment.yml&query=%24.spec.template.spec.priorityClassName)](https://github.com/marinatedconcrete/config/tree/main/kustomization/components/priorityclass)

This component installs [Frigate](https://frigate.video/) with persistent storage for the configuration and recordings.
The Frigate image starts s6-overlay as root to set the user IDs of its services.
The pod uses the Baseline Pod Security Standard.

# Examples

Replace `{version}` with the release version.
Install the `application` PriorityClass.
Make a default StorageClass available for the two claims.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/frigate?ref=kustomize-frigate@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-frigate@v{version}/kustomize-frigate.yml
```

Each release also includes a complete manifest for each hardware option.
Use one hardware manifest in place of the base manifest.

| Hardware     | Release asset                    |
| ------------ | -------------------------------- |
| USB Coral    | `kustomize-frigate-coral.yml`    |
| AMD VA-API   | `kustomize-frigate-va-amd.yml`   |
| Intel VA-API | `kustomize-frigate-va-intel.yml` |

# Required Setup

Configure ingress restrictions in your cluster before you deploy Frigate.
Port 5000 on the Pod accepts unauthenticated requests.
Restrict direct access to this port.
Connect to `frigate-svc` on port 8971 with HTTPS.
Get the initial administrator password from the Frigate container logs.
Use the Frigate UI to add cameras and change settings.
Increase the media claim and shared memory limits to match the requirements of your cameras.

# Optional Hardware

Add the hardware components after the base component.
You can use Coral with one VA-API component.
To use both devices, make both resources available on the same node.

## USB Coral TPU

On the device plugin, apply the [gdp-coraltpu component](../gdp-coraltpu/README.md).
It makes the plugin advertise `devic.es/coraltpu`.
Initialize the USB Coral on the node before you start Frigate.
The Coral changes its USB identity when it first loads firmware.
Initialize it again after a power cycle so allocation uses the new USB device path.

Add this entry under `components`:

```yaml
- https://github.com/marinatedconcrete/config/kustomization/components/frigate/coral?ref=kustomize-frigate@v{version}
```

Add the USB detector and set a compatible Edge TPU model in the [Frigate configuration](https://docs.frigate.video/configuration/object_detectors/#edge-tpu-detector).
Replace any current detector and model settings as necessary.

```yaml
detectors:
  coral:
    type: edgetpu
    device: usb
model:
  path: /edgetpu_model.tflite
  width: 320
  height: 320
  input_tensor: nhwc
  input_pixel_format: rgb
  labelmap_path: /labelmap.txt
```

## AMD or Intel VA-API

The Kairos Fedora image includes AMD and Intel GPU firmware.
Check that the kernel driver creates a render device on the node.
Configure the [Generic Device Plugin](https://github.com/squat/generic-device-plugin) on those nodes to advertise the vendor-specific resource.
For AMD, add this device definition to the plugin:

```yaml
name: dri-amd
groups:
  - paths:
      - path: /dev/dri/renderD128
        mountPath: /dev/dri/renderD128
```

For Intel, use `name: dri-intel`.
Set `path` to the render node for that GPU.
Keep `mountPath` at `/dev/dri/renderD128` for the Frigate preset.
Use the default plugin domain `devic.es` for these resource names.

Add one of these entries under `components`:

```yaml
- https://github.com/marinatedconcrete/config/kustomization/components/frigate/va-amd?ref=kustomize-frigate@v{version}
```

```yaml
- https://github.com/marinatedconcrete/config/kustomization/components/frigate/va-intel?ref=kustomize-frigate@v{version}
```

The AMD component selects `radeonsi`.
The Intel component selects `iHD`.
For older Intel GPUs, set `LIBVA_DRIVER_NAME` to `i965` with a Deployment patch.
Set the [VA-API preset](https://docs.frigate.video/configuration/hardware_acceleration_video/) in the Frigate configuration:

```yaml
ffmpeg:
  hwaccel_args: preset-vaapi
```
