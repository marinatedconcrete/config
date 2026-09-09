# K3s egress components

These IPv4 NetworkPolicy components control outbound access. You select the components that your workloads need.
The components do not install a network policy controller or configure ingress.
Each component selects all pods in the consumer namespace by default.
Set `namespace` in the consumer Kustomization.

| Component                      | Policy name                            | Allowed egress                               |
| ------------------------------ | -------------------------------------- | -------------------------------------------- |
| `k3s-egress-deny-all`          | `deny-all-egress`                      | None                                         |
| `k3s-egress-dns`               | `dns-egress`                           | kube-dns pods and DNS service IP, UDP/TCP 53 |
| `k3s-egress-public-internet`   | `public-internet-egress`, `dns-egress` | DNS and IPv4 destinations outside RFC1918    |
| `k3s-egress-pods-and-services` | `pods-and-services-egress`             | Configured pod and service CIDRs, all ports  |
| `k3s-egress-kubernetes-api`    | `allow-egress-kubernetes-api`          | None until patched with endpoints and ports  |

NetworkPolicies permit the combined access from all applicable policies.
A deny-all policy cannot prevent access that another policy permits.
An egress policy can isolate pods that previously had unrestricted access.
Use one baseline policy. Add only the extension policies that the workload needs.
You can use the DNS component separately. The public-internet component includes DNS.
Do not add the DNS component separately when you use public-internet.

## Defaults and portability

The [K3s defaults](https://docs.k3s.io/cli/server) are pod CIDR `10.42.0.0/16`, service CIDR `10.43.0.0/16`, and DNS service address `10.43.0.10`.
Check your `cluster-cidr`, `service-cidr`, and `cluster-dns` configuration.
These values are independent. Do not calculate one value from another value.
The DNS policy also selects pods with the label `k8s-app: kube-dns` in `kube-system`.

Public egress excludes these RFC1918 ranges: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`.
Other IPv4 destinations remain accessible by default. Some of these destinations can have private routes in your network.
Add exclusions for pod and service CIDRs outside RFC1918.
Add exclusions for other ranges with local routes.
These ranges can include CGNAT (`100.64.0.0/10`) and link-local (`169.254.0.0/16`) addresses.
Also exclude public address ranges that your cluster uses for pods, services, nodes, or LANs.

No component permits IPv6 egress. This version does not support dual-stack or IPv6-only configurations.
Do not add `::/0` without the necessary IPv6 rules and exclusions.

The API component starts with `egress: []`.
Before you use the component, add a patch with the exact endpoint addresses and ports.
K3s node endpoints usually use TCP/6443. The Kubernetes service usually uses TCP/443.
Address translation can require separate rules for these destinations.
Get the addresses from your cluster configuration and Kubernetes service EndpointSlices.
The component does not find the addresses automatically.
Network access does not give Kubernetes API authorization.

## Complete customization example

The [example Kustomization](examples/k3s-egress/kustomization.yml) uses a [local wrapper component](examples/k3s-egress/cluster-network/kustomization.yml).
Build the example from this repository:

```sh
kustomize build kustomization/examples/k3s-egress
```

The example uses pod and service ranges `172.20.0.0/16` and `172.21.0.0/16`.
It changes the DNS address to `172.21.0.53/32` and supplies DNS selectors.
It includes API endpoints, an optional API service rule, additional public exclusions, and a private HTTPS exception.
Replace the example API addresses before deployment.
The example includes all extensions to test their combined result.
Remove extensions that your workload does not need.

Copy the wrapper component into your repository.
Replace its relative upstream references with component URLs that specify release tags.
Use the URL format in each component README.
Keep relative references to the wrapper component in namespace consumers.
This wrapper component keeps common network patches in one location.

Each patch selects a named NetworkPolicy. It replaces the complete `/spec/egress` list.
This replacement removes the old defaults. It does not depend on positions in the destination list.
Keep the RFC1918 exclusions when you replace the public egress rules.
Keep UDP and TCP 53 when you replace the DNS rules.
Keep the necessary DNS pod and service paths.
The DNS namespace and pod selectors are in the same peer. Both selectors must match.

The wrapper component also replaces `/spec/podSelector`.
Every policy in the example selects `app: example`.
These policies do not isolate pods without that label.
For a namespace-wide baseline, keep `podSelector: {}`.
Limit extension policies to the pods that need them.
The [private access policy](examples/k3s-egress/cluster-network/private-access.yml) permits one destination and port.
Add separate policies for private access. Keep the private exclusions in the public baseline.
Keep local device and subnet policies in the consumer repository.

## Releases

Each `k3s-egress-*` component has independent releases with tags `kustomize-<component>@v<version>`.
The README examples show remote component references and downloadable `kustomize-<component>.yml` artifacts.
These artifacts do not specify a namespace.

Public-internet includes `../k3s-egress-dns` from the same Git tree.
Its release tag identifies the DNS implementation at that commit.
The separate DNS component version does not control this dependency.
When DNS behavior changes, include a conventional feature or fix commit for the public-internet component.
Make a new public-internet release with that change.
Explain the DNS change in its changelog.
Consumers of each component must update their release references to get the change.

## Validation and enforcement

The five component tests render the defaults and the complete wrapper component.
The tests check exact rules, selectors, namespaces, and unique resource identities.
They do not start Minikube or change a cluster.

```sh
just kustomization-test k3s-egress-public-internet
just release-please-build kustomize-k3s-egress-public-internet /tmp/public-internet.yml
```

Run these commands through the repository devcontainer.
Run `just check-format` to check formatting.
Run `just lint` to run the lint checks.
Other repository tests apply resources to Minikube to check their schema and application.
Those tests do not show that the network enforces egress rules.

[Kubernetes documentation](https://kubernetes.io/docs/concepts/services-networking/network-policies/) describes the required support from the network implementation.
Service address translation can occur before or after policy evaluation.
Test DNS access through the service address on your K3s network.
Test direct pod and service destinations.
Test the API service and its endpoints.
Test public and private destinations.
Host-networked workloads and node traffic have different restrictions.
Do not use these policies as host firewalls.

## Follow-up ansible migration

After upstream tags and artifacts are available, do these steps:

1. Replace local generic policies with wrapper components that specify published release tags. Keep local component paths and existing policy names. Configure the actual pod and service CIDRs in those wrapper components. Configure their DNS settings and API endpoints.
2. Keep management, family, IoT, camera, monitoring, and Traefik MQTT exceptions in the local repository. Do not put their addresses in upstream components. Do not increase private access during migration.
3. Render each affected namespace before and after the change. Check the effect of exclusions for all RFC1918 ranges. If an exclusion blocks a necessary route, add an extension policy for that route. Keep the baseline exclusions.
4. Check the namespace of the new `dns-egress` resource. Some consumers assign namespaces through patches that select individual policy names. These consumers include Traefik, cert-manager, and monitoring. Add a namespace patch for the DNS policy where necessary. Change DNS rule patches to select `dns-egress`.
5. Test one representative namespace on K3s before you change more namespaces. Test DNS access over UDP and TCP. Test public access and the necessary private routes. Make sure that the policies block other private routes. Test the necessary API service and endpoint connections. Examine all applicable policies together. If necessary traffic fails, restore the previous wrapper reference. Then examine the failed network path.

This upstream change does not migrate ansible consumers or apply policies to the live cluster.
