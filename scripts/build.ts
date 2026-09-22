import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { build, version as bunVersion, file } from "bun";

const packageInfo = await file("package.json").json();
const version =
  typeof packageInfo.version === "string" ? packageInfo.version : "unknown";

const result = await build({
  define: {
    __ACTION_VERSION__: JSON.stringify(version),
  },
  entrypoints: ["src/index.ts"],
  format: "esm",
  metafile: true,
  minify: {
    identifiers: true,
    keepNames: true,
    syntax: true,
    whitespace: true,
  },
  naming: "index.js",
  outdir: "dist",
  packages: "bundle",
  sourcemap: "linked",
  splitting: false,
  target: "node",
});

const bundle = result.outputs.find(
  (output) => output.kind === "entry-point" && output.path.endsWith("index.js")
);
const sourceMap = result.outputs.find(
  (output) =>
    output.kind === "sourcemap" && output.path.endsWith("index.js.map")
);

if (!(bundle && sourceMap)) {
  throw new Error("Bun did not emit dist/index.js and dist/index.js.map");
}

if (
  result.outputs.filter((output) => output.kind === "entry-point").length !== 1
) {
  throw new Error("Expected Bun to emit exactly one entry point");
}

if (!result.metafile) {
  throw new Error("Bun did not return build metadata");
}

const bundleText = await bundle.text();

/**
 * Whether the emitted bundle actually reaches for a module it does not carry.
 *
 * Matches the specifier in import, dynamic-import or require position, which
 * is what distinguishes a live dependency from the same name appearing as an
 * ordinary string — `@actions/cache` ships its own name as a user-agent field.
 */
function isReferenced(specifier: string): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:from|import|require)\\s*\\(?\\s*["']${escaped}["']`
  ).test(bundleText);
}

/**
 * Modules the dependency graph left unresolved, narrowed to the ones the
 * output still refers to.
 *
 * The graph alone over-reports. A barrel file like
 * `@azure/core-rest-pipeline/index.js` re-exports thirty siblings; when none
 * of the re-exported symbols are used, Bun drops the edge without resolving
 * it and the metafile marks it external — though nothing about it survives
 * into the bundle. The same goes for a `require` of a genuinely optional
 * dependency: `debug` asks for `supports-color` inside a try/catch precisely
 * because it may be absent, and Bun compiles it to a throwing stub that the
 * catch swallows.
 *
 * Neither can fail on a consumer's runner, because neither is in the file. A
 * dependency that failed to bundle is, and it appears here as a real import.
 */
const unresolvedReferences = [
  ...new Set(
    Object.values(result.metafile.inputs)
      .flatMap((input) => input.imports)
      .filter(
        (imported) =>
          imported.external &&
          !imported.path.startsWith("node:") &&
          !builtinModules.includes(imported.path)
      )
      .map((imported) => imported.path)
  ),
].filter(isReferenced);

if (unresolvedReferences.length > 0) {
  throw new Error(
    `Bundle contains unresolved imports: ${unresolvedReferences.join(", ")}`
  );
}

const bundleBytes = new Uint8Array(await bundle.arrayBuffer());
const bundleSize = bundleBytes.byteLength;
const manifest = {
  arch: process.arch,
  buildTimestamp: new Date().toISOString(),
  bundleSize,
  bundleSizeMB: (bundleSize / (1024 * 1024)).toFixed(2),
  bunVersion,
  format: "es",
  integrity: createHash("sha256").update(bundleBytes).digest("hex"),
  minified: true,
  platform: process.platform,
  sourcemap: true,
  target: "node24",
  treeshaken: true,
  version,
};

await writeFile(
  "dist/build-manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`
);
