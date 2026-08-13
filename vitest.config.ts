import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@tests": resolve(import.meta.dirname, "./__tests__"),
    },
  },
  test: {
    coverage: {
      exclude: [
        "node_modules/",
        "__tests__/",
        "dist/",
        "scripts/",
        "*.config.*",
        "coverage/",
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Thresholds are flat here on purpose. Vitest treats an unrecognised key
      // as a glob pattern, so the previous `global: { ... }` nesting matched no
      // files and silently enforced nothing.
      //
      // Ratchet rule: never lower a threshold to accommodate new untested code.
      // Raise them as coverage improves. Re-baselining downwards is permitted
      // only when the sole cause is deleting covered code, and the commit body
      // must state the before/after numbers and that cause.
      //
      // `functions` is a one-off exception re-baselined 97 -> 95 under #136, for
      // granularity rather than deletion: there are only ~240 functions, so each
      // one is worth ~0.42 points, and at 97.08% actual the old threshold left
      // 0.08 points of headroom — CI broke after deleting eight tested functions.
      // Statements, branches and lines count in the thousands and move smoothly,
      // so they keep tight thresholds. At 95 the metric still fails if ~5
      // untested functions are added, while tolerating ~100 tested deletions.
      thresholds: {
        branches: 79,
        functions: 95,
        lines: 89,
        statements: 89,
      },
    },
    environment: "node",
    globals: true,
    hookTimeout: 30_000,
    include: ["__tests__/**/*.test.{js,ts}", "src/**/*.{test,spec}.{js,ts}"],
    // Test categories with different configurations
    pool: "forks", // Better isolation for integration tests
    setupFiles: ["./__tests__/setup.ts"],
    testTimeout: 30_000, // Increased for integration tests
  },
});
