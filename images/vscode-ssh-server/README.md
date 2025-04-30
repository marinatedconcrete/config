# Marinated Concrete's VSCode-compatible ssh server
This runs a little ssh server that's compatible with VSCode's remote SSH feature. Unfortunately, [the LinuxServer one](https://docs.linuxserver.io/images/docker-openssh-server/) cannot be used because it is based on Alpine so it lacks glibc, a [known limitation](https://code.visualstudio.com/docs/remote/ssh#_remote-ssh-limitations).

It's also less flexible/more opinionated. The intention is to run it as a sidecar to an existing application you have, such as esphome, HomeAssistant, or zwavejs.

## Configuration:
In a new container alongside your application's container:
- Set the environment variable `AUTHORIZED_KEYS_URL` to a path containing your authorized keys. For instance, `https://github.com/$GH_USERNAME.keys`.
- Mount a small empty dir in `/config` - this will container your server's ssh host key, which must be persisted
- Mount the volume you want accessible over ssh in `/data`. When you ssh in, this is the directory where you'll start.

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
        # ... the rest of the esp config
        # Now add the sidecar:
      - name: ssh-server
        env:
        - name: AUTHORIZED_KEYS_URL
          # Swap in your github username
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

      # Option 1 (preferred): Let the ssh server autogenerate its key
      # It will persist the keys into this volume
      - name: config
        persistentVolumeClaim:
          claimName: ssh-config-pvc

      # Option 2: Pre-provisioned key via a k8s Secret
      # The secret should have a key named ssh_host_ed25519_key and a corresponding ssh_host_ed25519_key.pub
      - name: config
        secret:
          secretName: ssh-host-keys
          defaultMode: 0400

---
# PVC for esphome configurations, mounted in the ssh container at /data
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
# PVC for /config (only needed for option 1)
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