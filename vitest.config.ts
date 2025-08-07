import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.{js,ts}', 'src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        'dist/',
        'scripts/',
        '*.config.*',
        'coverage/',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 30_000, // Increased for integration tests
    hookTimeout: 30_000,
    // Test categories with different configurations
    pool: 'forks', // Better isolation for integration tests
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './__tests__'),
    },
  },
});
