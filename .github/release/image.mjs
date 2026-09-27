import { execFileSync } from "node:child_process";

export function promoteImage(image, version, digest, run = execFileSync) {
  function inspect(reference, optional = false) {
    try {
      const output = run(
        "docker",
        ["buildx", "imagetools", "inspect", reference],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const result = output.match(/^Digest:\s+(sha256:[a-f0-9]{64})$/m)?.[1];
      if (!result) throw new Error("Registry response has no digest");
      return result;
    } catch (error) {
      if (
        optional &&
        /manifest unknown|not found/i.test(error.stderr?.toString() || "")
      )
        return null;
      throw error;
    }
  }
  const target = `${image}:${version}`;
  if (inspect(`${image}@${digest}`) !== digest)
    throw new Error("Validated image is unavailable");
  const existing = inspect(target, true);
  if (existing && existing !== digest)
    throw new Error("Version image already has a different digest");
  if (!existing)
    run(
      "docker",
      [
        "buildx",
        "imagetools",
        "create",
        "--prefer-index=false",
        "--tag",
        target,
        `${image}@${digest}`,
      ],
      { stdio: "inherit" },
    );
  if (inspect(target) !== digest)
    throw new Error("Published image digest differs");
}
