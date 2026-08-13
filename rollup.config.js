import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import { transform } from "esbuild";

// Transpile TypeScript with esbuild. TypeScript 7 no longer exposes the classic
// compiler API that @rollup/plugin-typescript drives. Type checking stays in
// `bun run typecheck`; `verbatimModuleSyntax` keeps the source safe to strip
// types file by file.
function esbuildTranspile() {
  return {
    name: "esbuild-transpile",
    async transform(code, id) {
      if (!id.endsWith(".ts")) {
        return null;
      }

      const result = await transform(code, {
        loader: "ts",
        sourcefile: id,
        sourcemap: true,
        target: "es2022",
        tsconfigRaw: {
          compilerOptions: {
            target: "ES2022",
            useDefineForClassFields: true,
            verbatimModuleSyntax: true,
          },
        },
      });

      return { code: result.code, map: result.map };
    },
  };
}

// Plugin to generate enhanced build manifest with useful details for changelog and releases
function generateBuildManifest() {
  return {
    name: "generate-build-manifest",
    writeBundle(_options, bundle) {
      // Get main bundle file
      const bundleFile = bundle["index.js"];
      if (!bundleFile) {
        throw new Error("Main bundle file not found");
      }

      // Calculate bundle size
      const bundleCode = bundleFile.code;
      const bundleSize = Buffer.byteLength(bundleCode, "utf8");
      const bundleSizeMB = (bundleSize / (1024 * 1024)).toFixed(2);

      // Generate integrity hash
      const hash = createHash("sha256");
      hash.update(bundleCode);
      const integrity = hash.digest("hex");

      // Read package.json for version info
      let packageInfo = { version: "unknown" };
      try {
        const packageJson = readFileSync("package.json", "utf8");
        packageInfo = JSON.parse(packageJson);
      } catch {
        packageInfo = { version: "unknown" };
      }

      // Create enhanced build manifest with useful details for releases
      const manifest = {
        arch: process.arch,

        // Build metadata
        buildTimestamp: new Date().toISOString(),
        // Core bundle information
        bundleSize,
        bundleSizeMB,
        format: "es",
        integrity,
        minified: true, // Using terser for minification
        nodeVersion: process.version,

        // Environment information
        platform: process.platform,

        // Build configuration
        sourcemap: true, // We always generate sourcemaps
        target: "node24",
        treeshaken: true, // Using enhanced tree-shaking
        version: packageInfo.version || "unknown",
      };

      // Write manifest to dist folder
      const manifestPath = "dist/build-manifest.json";
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    },
  };
}

// Read package.json for version injection
let packageVersion = "unknown";
try {
  const packageJson = readFileSync("package.json", "utf8");
  const packageInfo = JSON.parse(packageJson);
  packageVersion = packageInfo.version || "unknown";
} catch {
  packageVersion = "unknown";
}

export default {
  input: "src/index.ts",
  onwarn(warning, warn) {
    // Suppress known harmless warnings from node_modules
    if (warning.code === "THIS_IS_UNDEFINED") {
      return;
    }
    if (
      warning.code === "CIRCULAR_DEPENDENCY" &&
      warning.ids?.every((id) => id.includes("node_modules"))
    ) {
      return;
    }
    warn(warning);
  },
  output: {
    esModule: true,
    file: "dist/index.js",
    format: "es",
    generatedCode: "es2015",
    hoistTransitiveImports: false,
    interop: "auto",
    sourcemap: true,
  },
  plugins: [
    replace({
      __ACTION_VERSION__: JSON.stringify(packageVersion),
      preventAssignment: true,
    }),
    esbuildTranspile(),
    json(),
    nodeResolve({
      exportConditions: ["node", "import", "module", "default"],
      // esbuild strips types but leaves extensionless imports alone, so the
      // resolver has to try .ts before .js
      extensions: [".ts", ".mjs", ".js", ".json", ".node"],
      // `undici` is a real dependency (via @actions/http-client) and must be
      // inlined, because dist/ ships without node_modules. Bun lists `undici`
      // in `module.builtinModules`, so when rollup runs under Bun rather than
      // Node — any environment without a real `node` on PATH, such as the
      // oven/bun image — a plain `preferBuiltins: true` treats it as a builtin
      // and leaves a bare `import ... from "undici"` in the bundle. That
      // bundle still passes `node -c`, then fails at runtime. Name the
      // exception rather than trusting the host runtime's builtin list.
      preferBuiltins: (id) => id !== "undici",
    }),
    commonjs({
      ignoreDynamicRequires: true,
    }),
    terser({
      compress: {
        drop_console: false,
        drop_debugger: true,
        ecma: 2020,
        pure_funcs: [],
      },
      format: {
        comments: false,
        ecma: 2020,
      },
      mangle: {
        keep_classnames: true,
        keep_fnames: /^(main|run|setup|teardown)$/,
      },
      sourceMap: true,
    }),
    generateBuildManifest(),
  ],
  treeshake: {
    moduleSideEffects: false,
    preset: "recommended",
  },
};
