# Marinated Concrete's Buildah Action Runner Image

This image extends the upstream `quay.io/buildah/stable` image with the tools needed
for a minimal buildah environment in CI: `jq`, `curl`, and Node.js, for jobs that build
containers with `buildah` and also need common scripting tools.

We publish semantically-versioned releases via release-please.
