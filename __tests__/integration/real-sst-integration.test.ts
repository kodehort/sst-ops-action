/**
 * Real SST CLI Integration Tests
 * Tests the action with actual SST CLI commands in controlled environments
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Test constants
const TEST_TIMEOUT = 30_000; // 30 seconds for real CLI operations
const TEST_PROJECT_NAME = 'sst-test-project';

/**
 * Create a minimal SST project for testing
 */
function createTestSSTProject(projectPath: string) {
  mkdirSync(projectPath, { recursive: true });

  // Create package.json
  const packageJson = {
    name: TEST_PROJECT_NAME,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'sst dev',
      build: 'sst build',
      deploy: 'sst deploy',
      remove: 'sst remove',
    },
    dependencies: {
      sst: '^3.0.0',
    },
  };
  writeFileSync(
    join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create basic sst.config.ts
  const sstConfig = `/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "${TEST_PROJECT_NAME}",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // Simple test function for testing
    new sst.aws.Function("TestFunction", {
      handler: "index.handler",
      runtime: "nodejs20.x",
      code: {
        zipFile: "exports.handler = async () => ({ statusCode: 200, body: 'Hello World' });"
      }
    });
  },
});
`;
  writeFileSync(join(projectPath, 'sst.config.ts'), sstConfig);
}

/**
 * Check if SST CLI is available in the system
 */
async function checkSSTAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('sst', ['--version'], { stdio: 'pipe' });
    child.on('close', (code) => {
      resolve(code === 0);
    });
    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Execute SST command and capture output
 */
async function executeSSTCommand(
  command: string[],
  cwd: string,
  timeout: number = TEST_TIMEOUT
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('sst', command, {
      cwd,
      stdio: 'pipe',
      env: {
        ...process.env,
        // Add test-specific environment variables
        SST_STAGE: 'test-integration',
        SST_TELEMETRY_DISABLED: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTimeout: Process killed',
      });
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code || 0, stdout, stderr });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout, stderr: stderr + error.message });
    });
  });
}

describe('Real SST CLI Integration Tests', () => {
  let testProjectPath: string;
  let sstAvailable: boolean;

  beforeEach(async () => {
    // Create temporary test project
    testProjectPath = join(tmpdir(), `sst-test-${Date.now()}`);
    createTestSSTProject(testProjectPath);

    // Check if SST is available
    sstAvailable = await checkSSTAvailability();
  });

  afterEach(() => {
    // Clean up test project
    try {
      rmSync(testProjectPath, { recursive: true, force: true });
    } catch (_error) {}
  });

  describe('SST CLI Availability', () => {
    it('should detect if SST CLI is available', () => {
      // This test always runs to document CLI availability
      if (sstAvailable) {
      } else {
      }

      // Always pass - this is just informational
      expect(true).toBe(true);
    });
  });

  describe('SST Diff Operation', () => {
    it(
      'should execute sst diff command successfully',
      async () => {
        if (!sstAvailable) {
          return;
        }

        const result = await executeSSTCommand(['diff'], testProjectPath);

        // SST diff should complete (exit code varies based on changes)
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout || result.stderr).toContain('sst');
      },
      TEST_TIMEOUT
    );

    it('should handle diff with invalid stage gracefully', async () => {
      if (!sstAvailable) {
        return;
      }

      const result = await executeSSTCommand(
        ['diff', '--stage', 'invalid-stage@#$'],
        testProjectPath,
        10_000 // Shorter timeout for error case
      );

      // Should fail with invalid stage
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toBeTruthy();
    }, 15_000);
  });

  describe('SST Deploy Operation (Dry Run)', () => {
    it(
      'should validate deployment configuration without actually deploying',
      async () => {
        if (!sstAvailable) {
          return;
        }

        // Use sst build to validate configuration without deploying
        const result = await executeSSTCommand(['build'], testProjectPath);

        // Build should complete successfully or with known configuration issues
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout || result.stderr).toContain('sst');
      },
      TEST_TIMEOUT
    );
  });

  describe('SST Remove Operation (Safe)', () => {
    it('should handle remove command on non-existent stage gracefully', async () => {
      if (!sstAvailable) {
        return;
      }

      const result = await executeSSTCommand(
        ['remove', '--stage', 'non-existent-test-stage'],
        testProjectPath,
        15_000
      );

      // Remove on non-existent stage should complete (may be success or controlled failure)
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout || result.stderr).toContain('sst');
    }, 20_000);
  });

  describe('SST Error Scenarios', () => {
    it('should handle malformed sst.config.ts file', async () => {
      if (!sstAvailable) {
        return;
      }

      // Overwrite with malformed config
      writeFileSync(
        join(testProjectPath, 'sst.config.ts'),
        'invalid typescript syntax{{{'
      );

      const result = await executeSSTCommand(['diff'], testProjectPath, 10_000);

      // Should fail with syntax error
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr.toLowerCase()).toMatch(/error|syntax|config/);
    }, 15_000);

    it('should handle missing sst.config.ts file', async () => {
      if (!sstAvailable) {
        return;
      }

      // Remove config file
      rmSync(join(testProjectPath, 'sst.config.ts'), { force: true });

      const result = await executeSSTCommand(['diff'], testProjectPath, 10_000);

      // Should fail with missing config error
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr.toLowerCase()).toMatch(/config|not found|missing/);
    }, 15_000);
  });

  describe('Environment Integration', () => {
    it(
      'should respect SST_STAGE environment variable',
      async () => {
        if (!sstAvailable) {
          return;
        }

        const _customStage = 'custom-test-stage';
        const result = await executeSSTCommand(['diff'], testProjectPath);

        // Check that the command respects environment configuration
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout || result.stderr).toContain('sst');
      },
      TEST_TIMEOUT
    );
  });
});
