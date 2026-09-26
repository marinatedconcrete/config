export function githubApi(repository, token, transport = fetch) {
  const base = `https://api.github.com/repos/${repository}`;
  return async (
    path,
    { method = "GET", body, missing = false, binary = false } = {},
  ) => {
    const response = await transport(
      path.startsWith("https://") ? path : `${base}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: binary
            ? "application/octet-stream"
            : "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body === undefined
            ? {}
            : {
                "Content-Type": Buffer.isBuffer(body)
                  ? "application/octet-stream"
                  : "application/json",
              }),
        },
        body:
          body === undefined
            ? undefined
            : Buffer.isBuffer(body)
              ? body
              : JSON.stringify(body),
      },
    );
    if (missing && response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        `GitHub ${method} ${path}: ${response.status} ${await response.text()}`,
      );
    if (response.status === 204) return null;
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  };
}

export async function allPages(api, path) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await api(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    result.push(...batch);
    if (batch.length < 100) return result;
  }
}

export async function tagCommit(api, tag) {
  const ref = await api(`git/ref/tags/${encodeURIComponent(tag)}`, {
    missing: true,
  });
  if (!ref) return null;
  let object = ref.object;
  while (object.type === "tag")
    object = (await api(`git/tags/${object.sha}`)).object;
  if (object.type !== "commit")
    throw new Error(`Tag ${tag} does not identify a commit`);
  return object.sha;
}
