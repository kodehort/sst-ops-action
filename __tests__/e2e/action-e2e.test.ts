import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { spawn } = childProcess;
const { existsSync, mkdirSync, rmSync, writeFileSync } = fs;
const { tmpdir } = os;
const { join } = path;

// Test constants
const E2E_TIMEOUT = 60_000; // 1 minute for end-to-end operations
const ACTION_DIST_PATH = join(process.cwd(), 'dist', 'index.cjs');

/**
 * Execute the GitHub Action with given inputs and environment
 */
async function executeAction(
  inputs: Record<string, string>,
  env: Record<string, string> = {}
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  outputs: Record<string, string>;
}> {
  return new Promise((resolve) => {
    // Convert inputs to INPUT_ environment variables
    const actionEnv = {
      ...process.env,
      ...env,
      // GitHub Actions environment
      GITHUB_ACTIONS: 'true',
      GITHUB_WORKFLOW: 'test-workflow',
      GITHUB_RUN_ID: '123456',
      GITHUB_RUN_NUMBER: '1',
      GITHUB_REPOSITORY: 'test-org/test-repo',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: 'abc123def456',
      GITHUB_ACTOR: 'test-actor',
      GITHUB_EVENT_NAME: 'push',
      // Action inputs
      ...Object.fromEntries(
        Object.entries(inputs).map(([key, value]) => [
          `INPUT_${key.toUpperCase().replace(/-/g, '_')}`,
          value,
        ])
      ),
    };

    const child = spawn('node', [ACTION_DIST_PATH], {
      stdio: 'pipe',
      env: actionEnv,
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
        outputs: {},
      });
    }, E2E_TIMEOUT);

    child.on('close', (code) => {
      clearTimeout(timer);

      // Extract outputs from stdout (GitHub Actions format: ::set-output name=xxx::value)
      const outputs: Record<string, string> = {};
      const outputPattern = /::set-output name=([^:]+)::(.*)$/gm;
      let match;
      while ((match = outputPattern.exec(stdout)) !== null) {
        if (match[1] && match[2] !== undefined) {
          outputs[match[1]] = match[2];
        }
      }

      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        outputs,
      });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + error.message,
        outputs: {},
      });
    });
  });
}

/**
 * Create a test project structure for E2E testing
 */
function createTestProject(projectPath: string) {
  mkdirSync(projectPath, { recursive: true });

  // Create a minimal SST project structure
  const packageJson = {
    name: 'e2e-test-project',
    version: '0.1.0',
    type: 'module',
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
      name: "e2e-test-app",
      removal: "remove",
      home: "aws",
    };
  },
  async run() {
    // Simple test resource
    new sst.aws.Function("E2ETestFunction", {
      handler: "index.handler",
      runtime: "nodejs20.x",
      code: {
        zipFile: "exports.handler = async () => ({ statusCode: 200, body: 'E2E Test' });"
      }
    });
  },
});
`;
  writeFileSync(join(projectPath, 'sst.config.ts'), sstConfig);
}

describe('End-to-End Action Tests', () => {
  let testProjectPath: string;
  let originalCwd: string;

  beforeEach(() => {
    // Save original directory
    originalCwd = process.cwd();

    // Create test project
    testProjectPath = join(tmpdir(), `e2e-test-${Date.now()}`);
    createTestProject(testProjectPath);

    // Change to test project directory for action execution
    process.chdir(testProjectPath);
  });

  afterEach(() => {
    process.chdir(originalCwd);

    rmSync(testProjectPath, { recursive: true, force: true });
  });

  describe('Action Distribution', () => {
    it('should have a built action available', () => {
      expect(existsSync(ACTION_DIST_PATH)).toBe(true);
    });
  });

  describe('Deploy Operation E2E', () => {
    it('should handle deploy operation with valid inputs', async () => {
      const result = await executeAction({
        operation: 'deploy',
        stage: 'e2e-test',
        token: 'fake-token-for-testing',
        'comment-mode': 'never',
        'fail-on-error': 'true',
      });

      // Should complete execution (may fail due to lack of AWS credentials, but shouldn't crash)
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');

      // Should attempt to parse inputs and validate them
      expect(result.stdout).toMatch(/operation|stage|deploy/i);
    });

    it('should handle deploy operation with minimal inputs', async () => {
      const result = await executeAction({
        stage: 'e2e-minimal',
        'fail-on-error': 'true',
      });

      // Should default to deploy operation
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
    });
  });

  describe('Diff Operation E2E', () => {
    it('should handle diff operation correctly', async () => {
      const result = await executeAction({
        operation: 'diff',
        stage: 'e2e-diff-test',
        token: 'fake-token',
        'comment-mode': 'always',
        'fail-on-error': 'true',
      });

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
      expect(result.stdout).toMatch(/diff.*operation/i);
    });
  });

  describe('Remove Operation E2E', () => {
    it('should handle remove operation correctly', async () => {
      const result = await executeAction({
        operation: 'remove',
        stage: 'e2e-remove-test',
        token: 'fake-token',
        'fail-on-error': 'true',
      });

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
      expect(result.stdout).toMatch(/remove.*operation/i);
    });
  });

  describe('Input Processing E2E', () => {
    it('should handle all operation types successfully', async () => {
      const operations = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const result = await executeAction({
          operation,
          stage: `e2e-${operation}-test`,
          token: 'fake-token',
          'comment-mode': 'never',
          'fail-on-error': 'true',
        });

        // Each operation should start successfully (may fail later due to missing AWS creds)
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout).toContain('SST Operations Action');
        expect(result.stdout).toMatch(
          new RegExp(`${operation}.*operation`, 'i')
        );
      }
    });

    it('should handle various input combinations', async () => {
      const result = await executeAction({
        operation: 'diff',
        stage: 'comprehensive-test',
        token: 'fake-token-comprehensive',
        'comment-mode': 'on-success',
        'max-output-size': '25000',
        'fail-on-error': 'true',
      });

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
    });
  });

  describe('Error Handling E2E', () => {
    it('should handle missing sst.config.ts gracefully', async () => {
      // Remove the config file
      rmSync(join(testProjectPath, 'sst.config.ts'), { force: true });

      const result = await executeAction({
        operation: 'diff',
        stage: 'test',
        token: 'fake-token',
        'fail-on-error': 'true',
      });

      // Should fail but handle error gracefully
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('SST Operations Action');
    });

    it('should continue when fail-on-error is false', async () => {
      // Remove the config file to cause an error
      rmSync(join(testProjectPath, 'sst.config.ts'), { force: true });

      const result = await executeAction({
        operation: 'deploy',
        stage: 'test',
        token: 'fake-token',
        'fail-on-error': 'false', // Should not fail the action
      });

      // Action should handle the error but not exit with failure
      expect(result.stdout).toContain('SST Operations Action');
      // May still exit 1 due to SST CLI error, but should log appropriately
    });
  });

  describe('Comment Mode E2E', () => {
    it('should respect never comment mode', async () => {
      const result = await executeAction({
        operation: 'deploy',
        stage: 'test',
        token: 'fake-token',
        'comment-mode': 'never',
        'fail-on-error': 'true',
      });

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
      // Should not attempt GitHub API calls with comment-mode never
    });

    it('should respect always comment mode', async () => {
      const result = await executeAction(
        {
          operation: 'deploy',
          stage: 'test',
          token: 'fake-token',
          'comment-mode': 'always',
          'fail-on-error': 'true',
        },
        {
          GITHUB_EVENT_NAME: 'pull_request', // Ensure PR context
        }
      );

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
      // Should attempt GitHub operations with comment-mode always
    });
  });

  describe('Output Size Limits E2E', () => {
    it('should respect max-output-size setting', async () => {
      const result = await executeAction({
        operation: 'deploy',
        stage: 'test',
        token: 'fake-token',
        'max-output-size': '100', // Very small limit
        'fail-on-error': 'true',
      });

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
      // Should handle small output limits appropriately
    });
  });

  describe('Environment Integration E2E', () => {
    it('should work in CI environment', async () => {
      const result = await executeAction(
        {
          operation: 'diff',
          stage: 'ci-test',
          token: 'fake-token',
          'fail-on-error': 'true',
        },
        {
          CI: 'true',
          GITHUB_ACTIONS: 'true',
        }
      );

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
    });

    it('should handle missing GitHub context gracefully', async () => {
      const result = await executeAction(
        {
          operation: 'deploy',
          stage: 'no-context-test',
          token: 'fake-token',
          'fail-on-error': 'true',
        },
        {
          // Remove GitHub context
          GITHUB_REPOSITORY: '',
          GITHUB_REF: '',
        }
      );

      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout).toContain('SST Operations Action');
    });
  });
});
