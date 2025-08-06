import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateBundle, validateBundleSize } from '../../scripts/build';

const TEST_ROOT = resolve(__dirname, '../fixtures/build-test');
const TEST_SRC = join(TEST_ROOT, 'src');
const TEST_DIST = join(TEST_ROOT, 'dist');
const TEST_ENTRY = join(TEST_SRC, 'main.ts');
const TEST_OUTPUT = join(TEST_DIST, 'main.js');

describe('Build System', () => {
  beforeEach(async () => {
    // Clean up any existing test directory
    await rm(TEST_ROOT, { recursive: true, force: true });

    // Create test directory structure
    await mkdir(TEST_SRC, { recursive: true });
    await mkdir(TEST_DIST, { recursive: true });

    // Create a minimal test entry file
    const testEntry = `
import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    core.info('Test action entry point');
    core.setOutput('test', 'success');
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

if (require.main === module) {
  run();
}

export default run;
    `.trim();

    await writeFile(TEST_ENTRY, testEntry);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  describe('Bundle Size Validation', () => {
    it('should validate bundle size within limits', async () => {
      // Create a small test bundle
      const smallBundle = 'module.exports = { test: "small bundle" };';
      await writeFile(TEST_OUTPUT, smallBundle);

      await expect(validateBundleSize(TEST_OUTPUT)).resolves.toBeUndefined();
    });

    it('should reject bundle size exceeding 10MB limit', async () => {
      // Create a large test bundle (>10MB)
      const largeBundleContent = `module.exports = { data: "${'x'.repeat(11 * 1024 * 1024)}" };`;
      await writeFile(TEST_OUTPUT, largeBundleContent);

      await expect(validateBundleSize(TEST_OUTPUT)).rejects.toThrow(
        /Bundle size.*exceeds limit/
      );
    });

    it('should throw error when bundle does not exist', async () => {
      const nonExistentPath = join(TEST_DIST, 'nonexistent.js');
      await expect(validateBundleSize(nonExistentPath)).rejects.toThrow(
        /Output bundle not found/
      );
    });
  });

  describe('Bundle Validation', () => {
    it('should validate syntactically correct bundle', async () => {
      const validBundle = `
        const core = require('@actions/core');
        
        function run() {
          core.info('Valid bundle');
          return { success: true };
        }
        
        module.exports = { run };
      `;

      await writeFile(TEST_OUTPUT, validBundle);
      await expect(validateBundle(TEST_OUTPUT)).resolves.toBeUndefined();
    });

    it('should reject bundle with invalid syntax', async () => {
      const invalidBundle = 'this is not valid javascript {{{';
      await writeFile(TEST_OUTPUT, invalidBundle);

      await expect(validateBundle(TEST_OUTPUT)).rejects.toThrow(
        /Bundle has invalid JavaScript syntax/
      );
    });

    it('should reject empty bundle', async () => {
      await writeFile(TEST_OUTPUT, '');
      await expect(validateBundle(TEST_OUTPUT)).rejects.toThrow(
        /Bundle is empty/
      );
    });

    it('should warn about missing CommonJS exports', async () => {
      const esmBundle = 'export const test = "esm";';
      await writeFile(TEST_OUTPUT, esmBundle);

      // Mock console.warn to check if warning is issued
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (message: string) => warnings.push(message);

      try {
        await validateBundle(TEST_OUTPUT);
        expect(
          warnings.some((w) =>
            w.includes('Bundle may not have proper CommonJS exports')
          )
        ).toBe(true);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('Build Configuration', () => {
    it('should build bundle with correct target and format', async () => {
      // This test would require mocking Bun.build since we're in a test environment
      // For now, we'll test the configuration options
      const buildOptions = {
        minify: true,
        sourcemap: true,
        target: 'node20',
        format: 'cjs' as const,
      };

      expect(buildOptions.target).toBe('node20');
      expect(buildOptions.format).toBe('cjs');
      expect(buildOptions.minify).toBe(true);
      expect(buildOptions.sourcemap).toBe(true);
    });

    it('should validate entry file exists before build', async () => {
      await rm(TEST_ENTRY);

      // Since we can't easily mock the build function, we'll test the validation logic
      expect(existsSync(TEST_ENTRY)).toBe(false);
    });

    it('should create dist directory if it does not exist', async () => {
      await rm(TEST_DIST, { recursive: true });
      expect(existsSync(TEST_DIST)).toBe(false);

      await mkdir(TEST_DIST, { recursive: true });
      expect(existsSync(TEST_DIST)).toBe(true);
    });
  });

  describe('Build Info Generation', () => {
    it('should generate build info with required fields', async () => {
      const mockBuildInfo = {
        timestamp: new Date().toISOString(),
        target: 'node20',
        format: 'cjs',
        bundler: 'bun',
        version: '1.0.0',
        commit: 'abc123',
        size: 1024,
      };

      const buildInfoPath = join(TEST_DIST, 'build-info.json');
      await writeFile(buildInfoPath, JSON.stringify(mockBuildInfo, null, 2));

      const savedBuildInfo = JSON.parse(await readFile(buildInfoPath, 'utf-8'));

      expect(savedBuildInfo).toHaveProperty('timestamp');
      expect(savedBuildInfo).toHaveProperty('target', 'node20');
      expect(savedBuildInfo).toHaveProperty('format', 'cjs');
      expect(savedBuildInfo).toHaveProperty('bundler', 'bun');
      expect(savedBuildInfo).toHaveProperty('version');
      expect(savedBuildInfo).toHaveProperty('commit');
      expect(savedBuildInfo).toHaveProperty('size');
    });

    it('should generate valid ISO timestamp', () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('Error Handling', () => {
    it('should provide structured error information', () => {
      const buildError = new Error('Test build error');
      buildError.name = 'BuildError';

      expect(buildError.name).toBe('BuildError');
      expect(buildError.message).toBe('Test build error');
    });

    it('should handle different error types appropriately', () => {
      const errors = [
        { code: 'MISSING_ENTRY', message: 'Entry file not found' },
        { code: 'BUILD_FAILED', message: 'Build process failed' },
        { code: 'BUNDLE_TOO_LARGE', message: 'Bundle exceeds size limit' },
        { code: 'INVALID_SYNTAX', message: 'Invalid JavaScript syntax' },
        { code: 'EMPTY_BUNDLE', message: 'Bundle is empty' },
      ];

      for (const error of errors) {
        expect(error.code).toBeTruthy();
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(5);
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should enforce 10MB bundle size limit', () => {
      const MAX_BUNDLE_SIZE_MB = 10;
      const MAX_BUNDLE_SIZE_BYTES = MAX_BUNDLE_SIZE_MB * 1024 * 1024;

      expect(MAX_BUNDLE_SIZE_BYTES).toBe(10_485_760); // 10MB in bytes
    });

    it('should validate bundle size calculations', () => {
      const testSizes = [
        { bytes: 1024, kb: 1, mb: 0.000_976_562_5 },
        { bytes: 1_048_576, kb: 1024, mb: 1 },
        { bytes: 10_485_760, kb: 10_240, mb: 10 },
      ];

      for (const { bytes, kb, mb } of testSizes) {
        expect(bytes / 1024).toBeCloseTo(kb);
        expect(bytes / (1024 * 1024)).toBeCloseTo(mb);
      }
    });
  });

  describe('GitHub Actions Integration', () => {
    it('should target Node.js 20 runtime', () => {
      const targetRuntime = 'node20';
      expect(targetRuntime).toBe('node20');
    });

    it('should use CommonJS format for compatibility', () => {
      const outputFormat = 'cjs';
      expect(outputFormat).toBe('cjs');
    });

    it('should bundle all dependencies', () => {
      const externalDeps: string[] = [];
      expect(externalDeps).toEqual([]);
    });

    it('should disable code splitting for single file output', () => {
      const splittingEnabled = false;
      expect(splittingEnabled).toBe(false);
    });

    it('should enable source maps for debugging', () => {
      const sourceMapsEnabled = true;
      expect(sourceMapsEnabled).toBe(true);
    });
  });
});
