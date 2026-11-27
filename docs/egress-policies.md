# Kubernetes egress policies

Use a network plugin that enforces Kubernetes NetworkPolicy.
Install `egress-deny-all` to isolate all Pods in the namespace for egress.
To isolate ingress and egress with the same policy, add this patch to the namespace Kustomization.

```yaml
patches:
  - patch: |-
      - op: add
        path: /spec/policyTypes/-
        value: Ingress
    target:
      kind: NetworkPolicy
      name: deny-all-egress-networkpolicy
```

Add ingress rules for the connections that your workloads need.
NetworkPolicies combine their permissions.
Check the other policies that select the same Pods.

Add only the components that your workload needs.
Set the client labels on the Pod template.

| Component                | Pod label with value `"true"`                        | Permitted destinations                            |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------- |
| `egress-coredns`         | `networking.marinatedconcrete.com/dns-client`        | CoreDNS Pods on TCP and UDP port 53.              |
| `egress-public-internet` | `networking.marinatedconcrete.com/internet-client`   | Public IPv4 destinations on TCP ports 80 and 443. |
| `egress-kubernetes-api`  | `networking.marinatedconcrete.com/api-server-client` | The API endpoints and ports that you supply.      |

Build the [example](../kustomization/examples/egress/kustomization.yml) with this command.

```sh
kustomize build kustomization/examples/egress
```

The example uses addresses from the RFC 5737 documentation range.
Replace `192.0.2.10/32` with the API endpoint address.
Set the port to the port of that endpoint.
Replace `192.0.2.53/32` with the cluster DNS Service address if your network plugin requires a Service address rule.
Check the selectors for the CoreDNS Pods and namespace.
Each patch selects a policy by name.

The internet policy excludes private IPv4 ranges and the shared address space used by Tailscale.
Add exclusions for any public address ranges that route to your internal network.
The component permits no IPv6 destinations.
See the [IANA IPv4 address registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml).

Test permitted and prohibited connections with your network plugin.
Service address translation can change the destination address that the plugin checks.
See [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/).
