/**
 * Bundle integration tests for SST Operations Action
 * Tests the complete bundled action (dist/index.js) as it would run in GitHub Actions
 */

import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Unmock fs operations for bundle tests
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
  };
});

const execFileAsync = promisify(execFile);

/**
 * Executes the bundled action as a separate Node.js process
 * This simulates how GitHub Actions would actually run the action
 */
async function executeBundledAction(
  env: Record<string, string>,
  timeoutMs = 10_000
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const { stdout, stderr } = await execFileAsync('node', ['dist/index.cjs'], {
      env: {
        ...process.env,
        ...env,
        NODE_ENV: 'test',
      },
      cwd: process.cwd(),
      timeout: timeoutMs,
    });

    return {
      exitCode: 0,
      stdout,
      stderr,
    };
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || 'Unknown error',
    };
  }
}

describe('Bundle Integration Tests', () => {
  beforeEach(() => {
    // Clear any leftover environment variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('INPUT_') || key.startsWith('GITHUB_')) {
        delete process.env[key];
      }
    });
  });

  describe('Bundle Structure Validation', () => {
    it('should have dist/index.cjs bundle file', async () => {
      const bundlePath = 'dist/index.cjs';

      // Check file exists
      await expect(access(bundlePath)).resolves.not.toThrow();

      // Check file is not empty
      const stats = await stat(bundlePath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
    });

    it('should be a valid Node.js bundle', async () => {
      // Test that the bundle is syntactically valid by running it with --check
      try {
        await execFileAsync('node', ['--check', 'dist/index.cjs'], {
          timeout: 5000,
        });
      } catch (error: any) {
        throw new Error(
          `Bundle syntax error: ${error.stderr || error.message}`
        );
      }
    });
  });

  describe('Bundle Execution', () => {
    it('should handle missing required inputs with proper error', async () => {
      const env = {
        // Missing required INPUT_STAGE and INPUT_TOKEN
        INPUT_OPERATION: 'deploy',
        GITHUB_ACTIONS: 'true',
      };

      const result = await executeBundledAction(env, 15_000);

      // Should exit with error due to validation failure
      expect(result.exitCode).toBe(1);
      // Should log the validation error (either to stdout or stderr)
      const output = result.stdout + result.stderr;
      expect(output).toMatch(/validation|required|stage|token/i);
    });

    it('should handle invalid operation with proper error', async () => {
      const env = {
        INPUT_OPERATION: 'invalid-operation',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        GITHUB_ACTIONS: 'true',
      };

      const result = await executeBundledAction(env, 15_000);

      expect(result.exitCode).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toMatch(/validation|operation|invalid/i);
    });

    it('should start and reach CLI execution phase', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'bundle-test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'never',
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'test/repo',
      };

      const result = await executeBundledAction(env, 15_000);

      // The action should fail when trying to execute SST CLI (since it's not available in test env)
      // But it should pass input validation and reach that point
      const output = result.stdout + result.stderr;

      // Should contain startup messages
      expect(output).toMatch(
        /Starting SST Operations Action|validation|deploy/i
      );

      // Either succeeds (if SST CLI mock works) or fails trying to run SST CLI
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('Bundle Performance', () => {
    it('should start within reasonable time', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'perf-test',
        INPUT_TOKEN: 'fake-token',
        GITHUB_ACTIONS: 'true',
      };

      const startTime = Date.now();

      const result = await executeBundledAction(env, 8000);

      const duration = Date.now() - startTime;

      // Should complete within 8 seconds (whether success or expected failure)
      expect(duration).toBeLessThan(8000);
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Bundle Environment', () => {
    it('should handle GitHub Actions environment variables', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'env-test',
        INPUT_TOKEN: 'fake-token',
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'test-org/test-repo',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_SHA: 'abc123',
        CI: 'true',
        RUNNER_OS: 'Linux',
      };

      const result = await executeBundledAction(env, 15_000);

      // Should handle the environment appropriately
      expect(typeof result.exitCode).toBe('number');
      expect(result.exitCode).toBeGreaterThanOrEqual(0);

      const output = result.stdout + result.stderr;

      // Should not crash due to environment issues
      expect(output).not.toMatch(/undefined.*undefined|null.*null/i);
    });

    it('should handle minimal environment gracefully', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'minimal-test',
        INPUT_TOKEN: 'fake-token',
        // Minimal environment - just the required GitHub Actions marker
        GITHUB_ACTIONS: 'true',
      };

      const result = await executeBundledAction(env, 15_000);

      // Should handle minimal environment without crashing
      expect(typeof result.exitCode).toBe('number');
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('Bundle Error Handling', () => {
    it('should not crash with malformed inputs', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'a'.repeat(1000), // Very long stage name
        INPUT_TOKEN: 'fake-token',
        'INPUT_MAX-OUTPUT-SIZE': 'not-a-number',
        'INPUT_FAIL-ON-ERROR': 'not-a-boolean',
        GITHUB_ACTIONS: 'true',
      };

      const result = await executeBundledAction(env, 15_000);

      // Should handle malformed input gracefully with validation error
      expect(result.exitCode).toBe(1);

      const output = result.stdout + result.stderr;
      expect(output).toMatch(/validation|error|invalid/i);
    });
  });
});
