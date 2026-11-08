# kube-vip WireGuard Component

[![Current Version](https://img.shields.io/badge/dynamic/json?style=for-the-badge&label=version&query=%24.kustomization%2Fcomponents%2Fkube-vip-wireguard&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarinatedconcrete%2Fconfig%2Frefs%2Fheads%2Fmain%2F.release-please-manifest.json)](https://github.com/marinatedconcrete/config/releases?q=%22kustomize-kube-vip-wireguard%22)
[![Pod Security Standard: Privileged](https://img.shields.io/badge/pod_security_standard-privileged-red?style=for-the-badge&logo=kubernetes&logoColor=%23326CE5)](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

This component adds a third [kube-vip](https://kube-vip.io/) `DaemonSet`, `kube-vip-wg-ds`, to the `kube-vip` component.  `kube-vip-wg-ds` serves the `Service` resources that use the load balancer class `kube-vip.io/wireguard`.  Each of these `Service` resources has an IP address on a WireGuard tunnel, and a peer outside the cluster sends traffic into that tunnel.

Use this component together with the `kube-vip` component.  The `kube-vip` component creates the `ServiceAccount` that this component uses.

The component has two more parts:
1) A `Role` and a `RoleBinding` that let the `kube-vip` `ServiceAccount` read only the `Secret` named `wireguard`.
2) An init container that checks that the node sets `net.ipv4.conf.all.src_valid_mark` and `net.ipv4.conf.all.route_localnet` to `1`.

# Metrics

`kube-vip-wg-ds` supplies Prometheus metrics on port `2114`.  All `DaemonSet` resources use the host network, so each `DaemonSet` uses a different port.  The `kube-vip` component uses ports `2112` and `2113`.

# Examples

Replace each `{version}` with the version of that component that you want to use.

## Component

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

components:
  - https://github.com/marinatedconcrete/config/kustomization/components/kube-vip?ref=kustomize-kube-vip@v{version}
  - https://github.com/marinatedconcrete/config/kustomization/components/kube-vip-wireguard?ref=kustomize-kube-vip-wireguard@v{version}
```

## Resource

```yaml
---
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-kube-vip@v{version}/kustomize-kube-vip.yml
  - https://github.com/marinatedconcrete/config/releases/download/kustomize-kube-vip-wireguard@v{version}/kustomize-kube-vip-wireguard.yml
```

# Required Setup

## Set the Node Sysctls

Set `net.ipv4.conf.all.src_valid_mark` and `net.ipv4.conf.all.route_localnet` to `1` on each node at boot.  kube-vip writes these values at start when a value is `0`.  The write fails in a container that is not privileged, because `/proc/sys` is read-only.  kube-vip then stops.  The component does not set the values, because that needs a privileged container.

The init container `check-node-sysctls` reads both values before kube-vip starts.  If a value is not `1`, the init container prints the name and the value of that setting and exits with an error.  The pod does not start kube-vip.  Read the log of the init container to see the message.  kube-proxy in iptables mode sets `route_localnet`.

## Create the `wireguard` Secret

Create a `Secret` named `wireguard` in the kube-vip namespace.  Its `tunnels` key holds a YAML map.  Each key of the map is a tunnel.  kube-vip uses the key as the name of the WireGuard interface on the node.

| Field           | Meaning                                                      |
| --------------- | ------------------------------------------------------------ |
| `vip`           | The `Service` IP address, with a prefix length.              |
| `privateKey`    | The private key of the node.                                 |
| `peerPublicKey` | The public key of the peer.                                  |
| `peerEndpoint`  | The address and port of the peer.                            |
| `allowedIPs`    | The addresses that the tunnel accepts.                       |
| `listenPort`    | The UDP port of the node.                                    |

Set `allowedIPs` to `0.0.0.0/0`.  Then the tunnel accepts packets from all client source addresses.

Give each tunnel its own `listenPort`.  Two WireGuard interfaces on one node cannot use the same UDP port.  kube-vip also uses the port as the firewall mark (fwmark) and the routing table number of the tunnel.

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  name: wireguard
stringData:
  tunnels: |
    kv0:
      vip: 203.0.113.10/32
      privateKey: <private key>
      peerPublicKey: <peer public key>
      peerEndpoint: 198.51.100.1:51820
      allowedIPs:
        - 0.0.0.0/0
      listenPort: 51820
```

Use one tunnel for each `Service`.  Each `Service` elects its own node when `externalTrafficPolicy` is `Local`.  Two nodes cannot hold the same tunnel key.

## Configure a Service

Set `loadBalancerClass` to `kube-vip.io/wireguard`.  The `kube-vip-svc-ds` `DaemonSet` ignores these `Service` resources.  Set the address with the annotation `kube-vip.io/loadbalancerIPs`.  The address must match the `vip` of a tunnel.

If `targetPort` is a name, it must be the same as the name of the `Service` port.  kube-vip finds the name in the port names of the `EndpointSlice`.

## Clamp the TCP MSS on the Peer

Clamp the TCP maximum segment size (MSS) on the tunnel interface of the peer.  kube-vip routes the ICMP "fragmentation needed" message into the tunnel, so path MTU discovery fails.  Without the clamp, large responses stop at 512 bytes.

kube-vip sets the tunnel MTU to `1420`.  These rules clamp the MSS on a peer with the tunnel interface `kv0`:

```shell
iptables --table mangle --append FORWARD --out-interface kv0 --protocol tcp --tcp-flags SYN,RST SYN --jump TCPMSS --clamp-mss-to-pmtu
iptables --table mangle --append FORWARD --in-interface kv0 --protocol tcp --tcp-flags SYN,RST SYN --jump TCPMSS --set-mss 1380
```
