# K3s egress components

These opt-in IPv4 NetworkPolicy components configure outbound access. They do not install an enforcement engine or configure ingress. Every component defaults to selecting all pods in the consuming namespace; set `namespace` in the consuming Kustomization.

| Component                      | Policy name                            | Allowed egress                               |
| ------------------------------ | -------------------------------------- | -------------------------------------------- |
| `k3s-deny-all-egress`          | `deny-all-egress`                      | None                                         |
| `k3s-dns-egress`               | `dns-egress`                           | kube-dns pods and DNS service IP, UDP/TCP 53 |
| `k3s-public-internet-egress`   | `public-internet-egress`, `dns-egress` | DNS and IPv4 destinations outside RFC1918    |
| `k3s-pods-and-services-egress` | `pods-and-services-egress`             | Configured pod and service CIDRs, all ports  |
| `k3s-kubernetes-api-egress`    | `allow-egress-kubernetes-api`          | None until patched with endpoints and ports  |

NetworkPolicies are additive: a deny-all policy establishes isolation, but cannot veto access another policy allows. Adding any of these egress policies can isolate selected pods that previously had unrestricted access. Prefer one baseline and only the extensions a workload needs. DNS-only is independently usable; public-internet already includes DNS, so do not also include the DNS component in the same Kustomization.

## Defaults and portability

The [K3s defaults](https://docs.k3s.io/cli/server) are pod CIDR `10.42.0.0/16`, service CIDR `10.43.0.0/16`, and DNS service address `10.43.0.10`. Verify your actual `cluster-cidr`, `service-cidr`, and `cluster-dns` configuration. They are independent values; do not derive one from another. DNS also selects pods labeled `k8s-app: kube-dns` in `kube-system`.

Public egress excludes all RFC1918 space: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. This is an IPv4 complement of those ranges, not an exhaustive classification of globally reachable addresses. Add exclusions for pod/service CIDRs outside RFC1918 and any other locally routed ranges, including CGNAT (`100.64.0.0/10`) and link-local (`169.254.0.0/16`) where appropriate. A cluster using publicly numbered pod, service, node, or LAN addresses must exclude those explicitly.

No component grants IPv6 egress. Dual-stack and IPv6-only configurations are outside this version's supported defaults; do not simply add `::/0`.

The API component intentionally starts with `egress: []`. Patch in exact endpoint addresses and ports before using it. K3s node endpoints normally use TCP/6443; the Kubernetes service normally uses TCP/443. These may need separate rules to account for translation. Discover addresses from the cluster configuration and Kubernetes service EndpointSlices; they are not discovered by this component. Network reachability does not grant Kubernetes API authorization.

## Complete customization example

The [example Kustomization](examples/k3s-egress/kustomization.yml) and its [local wrapper component](examples/k3s-egress/cluster-network/kustomization.yml) are buildable directly from this checkout:

```sh
kustomize build kustomization/examples/k3s-egress
```

The example demonstrates custom pod/service ranges (`172.20.0.0/16`, `172.21.0.0/16`), a DNS address (`172.21.0.53/32`) and selectors, multiple API endpoints, an optional API service rule, extra public exclusions, and a narrowly selected private HTTPS exception. Its documentation-only API addresses must be replaced before deployment. It deliberately includes all extensions to exercise composition; remove extensions your workload does not need.

Copy the wrapper into your own repository and replace its relative upstream references with pinned component URLs, using the pattern in each component README. Keep the wrapper relative reference in namespace consumers. That centralizes network patches without repeating them in every namespace.

Each patch targets a named NetworkPolicy and replaces the complete `/spec/egress` list. This removes old defaults instead of appending destinations or relying on numbered list entries. When replacing public egress, retain the RFC1918 exclusions. When replacing DNS egress, retain both UDP and TCP 53 and the desired pod/service paths. The DNS namespace and pod selectors belong to the same peer so both must match.

The wrapper also demonstrates replacing `/spec/podSelector`. In the example, every policy selects `app: example`. Pods without that label are not isolated by these policies. In a namespace-wide baseline, leave `podSelector: {}` and narrow only extension policies to the pods that need them. The [private access policy](examples/k3s-egress/cluster-network/private-access.yml) grants one destination and port; add such explicit policies instead of removing private exclusions from the public baseline. Local device and subnet policies remain consumer-owned.

## Releases

Each flat `k3s-*` component is independently released with tags `kustomize-<component>@v<version>`. README examples show both remote component references and downloadable `kustomize-<component>.yml` artifacts. No namespace is embedded in those artifacts.

Public-internet composes `../k3s-dns-egress` from the same Git tree. Its tag therefore captures the DNS implementation at that commit, independent of the DNS component's own version. Whenever DNS behavior changes, include a corresponding conventional feature/fix commit affecting the public-internet component and release it too. Its changelog should explain the inherited DNS change. DNS-only consumers and public-internet consumers then update their respective pinned versions.

## Validation and enforcement

The five component test entrypoints render defaults and the complete custom wrapper, then assert exact rules, selectors, namespace assignment, and unique resource identities. They do not start Minikube or modify a cluster.

```sh
just kustomization-test k3s-public-internet-egress
just release-please-build kustomize-k3s-public-internet-egress /tmp/public-internet.yml
```

Run these through the repository devcontainer. Formatting and lint checks remain `just check-format` and `just lint`. Existing Minikube apply tests elsewhere in the repository provide schema/application checks, not evidence that egress is enforced.

[Kubernetes documents](https://kubernetes.io/docs/concepts/services-networking/network-policies/) that enforcement requires a supporting network implementation and that service address translation may happen before or after policy evaluation. Test DNS through the service address, direct pod/service destinations, API service and endpoints, and public/private destinations on the target K3s networking implementation. Host-networked workloads and node traffic have special limitations; do not treat these policies as host firewalls.

## Follow-up ansible migration

After upstream tags and artifacts are published:

1. Replace the local generic policy implementations with wrapper components pinned to published tags. Keep local component paths and existing policy names to minimize consumer changes. Configure actual pod/service CIDRs, DNS settings, and API endpoints in those wrappers.
2. Retain management, family, IoT, camera, monitoring, and Traefik MQTT exceptions locally. Do not upstream their addresses or broaden private access during migration.
3. Render every affected namespace before and after. Review expected tightening from the old selected exclusions to all RFC1918 ranges. If a required route is newly blocked, add a reviewed narrow extension rather than relaxing the baseline.
4. Account for the new `dns-egress` resource. Where namespace assignment currently patches individual policy names (including Traefik, cert-manager, and monitoring consumers), ensure any new DNS policy receives the intended namespace. Update DNS-specific patches to target `dns-egress`.
5. Before broader adoption, validate one representative namespace on K3s: DNS over UDP and TCP, public connectivity, required private routes, blocked unapproved private routes, and required API service/endpoint connectivity. Inspect the union of policies, not just the baseline. Roll back the wrapper reference if required traffic fails, then investigate the missing path.

This upstream change does not migrate ansible consumers or apply policies to the live cluster.
