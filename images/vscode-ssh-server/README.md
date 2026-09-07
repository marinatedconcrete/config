# Marinated Concrete SSH Server for VS Code
This SSH server supports the VS Code Remote SSH feature.
The [LinuxServer image](https://docs.linuxserver.io/images/docker-openssh-server/) uses Alpine Linux, which does not include glibc.
The missing glibc library is a [known limitation](https://code.visualstudio.com/docs/remote/ssh#_remote-ssh-limitations) for VS Code Remote SSH.

Run this container as a sidecar for an application such as ESPHome, Home Assistant, or zwave-js.
This image has fewer configuration options than the LinuxServer image.

## Configuration:
Add a container next to the application container.
- Set `AUTHORIZED_KEYS_URL` to the URL of your authorized keys. For example, use `https://github.com/$GH_USERNAME.keys`.
- Mount a small persistent volume at `/config`. This volume stores the SSH host key.
- Mount the volume for SSH access at `/data`. SSH sessions start in this directory.

## Examples
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: esphome
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: esphome
  template:
    metadata:
      labels:
        app.kubernetes.io/name: esphome
    spec:
      containers:
      - name: esphome
        env:
        - name: ESPHOME_DASHBOARD_USE_PING
            value: "true"
        image: ghcr.io/esphome/esphome
        volumeMounts:
            - mountPath: "/config"
              name: esphome-config
        # Add other ESPHome settings here.
        # Add the sidecar.
      - name: ssh-server
        env:
        - name: AUTHORIZED_KEYS_URL
          # Replace this username with your GitHub username.
          value: "https://github.com/marinatedconcrete.keys"
        image: ghcr.io/marinatedconcrete/config/vscode-ssh-server
        ports:
        - containerPort: 2222
        volumeMounts:
        - name: config
          mountPath: /config
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: esphome-configs

      # Option 1 (recommended): Let the SSH server generate its host key.
      # The server stores the host key in this volume.
      - name: config
        persistentVolumeClaim:
          claimName: ssh-config-pvc

      # Option 2: Supply an existing host key with a Kubernetes Secret.
      # Include ssh_host_ed25519_key and the related ssh_host_ed25519_key.pub in the Secret.
      - name: config
        secret:
          secretName: ssh-host-keys
          defaultMode: 0400

---
# Mount this PVC at /data in the SSH container for ESPHome configuration files.
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: esphome-configs
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
# Use this PVC for /config only with option 1.
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ssh-config-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Mi
```
