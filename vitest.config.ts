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
      // files and silently enforced nothing. Values are a ratchet set just
      // under the current numbers: raise them as coverage improves, never lower.
      thresholds: {
        branches: 79,
        functions: 97,
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
