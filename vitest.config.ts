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
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
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
