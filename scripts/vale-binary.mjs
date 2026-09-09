import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolve the vendored Vale executable for this host.
 *
 * The `@taskless/vale-*` packages are named `@taskless/vale-<os>-<cpu>` using
 * node's own `process.platform` / `process.arch` spellings, and ship the
 * binary as payload only: no `bin` entry, no lifecycle script, no `exports`
 * field. The path is therefore resolved through the package's `package.json`
 * and joined, not looked up as a command.
 *
 * They are `optionalDependencies` with `os`/`cpu` constraints, so `npm install`
 * fetches exactly one of the six. A host with no build fails here rather than
 * at install time, so this throws with the package name instead of returning
 * undefined.
 */
export function valeBinaryPath() {
  const pkg = `@taskless/vale-${process.platform}-${process.arch}`;
  let manifest;
  try {
    manifest = require.resolve(`${pkg}/package.json`);
  } catch {
    throw new Error(
      `No Vale build for ${process.platform}/${process.arch}. ` +
        `Expected the optional dependency ${pkg} to be installed.`
    );
  }
  return join(dirname(manifest), process.platform === "win32" ? "vale.exe" : "vale");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFileSync } = await import("node:child_process");
  const binary = valeBinaryPath();
  console.log(binary);
  console.log(execFileSync(binary, ["--version"], { encoding: "utf8" }).trim());
}
