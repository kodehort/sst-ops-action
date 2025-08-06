/**
 * Integration tests for the complete SST Operations Action
 * Tests end-to-end workflows with realistic scenarios
 */

import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SST_DEPLOY_SUCCESS_OUTPUT,
  SST_DIFF_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
} from '../fixtures/sst-outputs';

// Mock node:child_process
vi.mock('node:child_process');

// Mock @actions/core
const mockCore = {
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
};

vi.mock('@actions/core', () => mockCore);

// Mock @actions/github
vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 1 },
    payload: { pull_request: { number: 123 } },
    eventName: 'pull_request',
  },
  getOctokit: vi.fn(() => ({
    rest: {
      issues: {
        createComment: vi.fn(),
        updateComment: vi.fn(),
        listComments: vi.fn().mockResolvedValue({ data: [] }),
      },
    },
  })),
}));

/**
 * Creates a mock child process for testing CLI execution
 */
function createMockChildProcess(output: string, exitCode = 0) {
  const mockProcess = {
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          // Simulate streaming output
          setTimeout(() => callback(Buffer.from(output)), 10);
        }
      }),
      pipe: vi.fn(),
    },
    stderr: {
      on: vi.fn(),
      pipe: vi.fn(),
    },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 50);
      }
    }),
    kill: vi.fn(),
  };
  return mockProcess as any;
}

/**
 * Executes the action with given environment variables
 */
async function executeAction(env: Record<string, string>) {
  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Mock core.getInput to return environment values
  mockCore.getInput.mockImplementation((name: string) => {
    return env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] || '';
  });

  mockCore.getBooleanInput.mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  // Import and run the action
  const { run } = await import('../../src/main');

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Capture outputs
  mockCore.setOutput.mockImplementation((name: string, value: string) => {
    outputs[name] = value;
  });

  mockCore.setFailed.mockImplementation((message: string) => {
    exitCode = 1;
    outputs.error = message;
  });

  try {
    await run();
  } catch (error) {
    exitCode = 1;
    outputs.error = error instanceof Error ? error.message : String(error);
  }

  return { exitCode, outputs };
}

describe('Action Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('INPUT_')) {
        delete process.env[key];
      }
    });
  });

  describe('Deploy Operation Integration', () => {
    it('should execute complete deploy workflow successfully', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test-integration',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'on-success',
        'INPUT_FAIL-ON-ERROR': 'true',
        'INPUT_MAX-OUTPUT-SIZE': '50000',
      };

      // Mock successful SST CLI execution
      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(SST_DEPLOY_SUCCESS_OUTPUT, 0)
      );

      const result = await executeAction(env);

      // Verify successful execution
      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.outputs.operation).toBe('deploy');
      expect(result.outputs.stage).toBe('test-integration');
      expect(result.outputs.completion_status).toBe('complete');

      // Verify SST CLI was called correctly
      expect(spawn).toHaveBeenCalledWith(
        'sst',
        ['deploy', '--stage', 'test-integration'],
        expect.any(Object)
      );

      // Verify core actions were called
      expect(mockCore.info).toHaveBeenCalledWith(
        '🚀 Starting SST Operations Action'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '🔧 Executing deploy operation...'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ SST deploy operation completed successfully'
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith('success', 'true');
    });

    it('should handle deploy failures correctly', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test-integration',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'always',
        'INPUT_FAIL-ON-ERROR': 'true',
      };

      // Mock failed SST CLI execution
      const failureOutput = 'Deploy failed: Authentication error';
      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(failureOutput, 1)
      );

      const result = await executeAction(env);

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
      expect(mockCore.setFailed).toHaveBeenCalled();
    });
  });

  describe('Diff Operation Integration', () => {
    it('should execute complete diff workflow successfully', async () => {
      const env = {
        INPUT_OPERATION: 'diff',
        INPUT_STAGE: 'staging',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'always',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(SST_DIFF_OUTPUT, 0)
      );

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.outputs.operation).toBe('diff');
      expect(result.outputs.stage).toBe('staging');

      // Verify diff-specific outputs
      expect(result.outputs.planned_changes).toBeDefined();
      expect(result.outputs.diff_summary).toBeDefined();

      expect(spawn).toHaveBeenCalledWith(
        'sst',
        ['diff', '--stage', 'staging'],
        expect.any(Object)
      );
    });
  });

  describe('Remove Operation Integration', () => {
    it('should execute complete remove workflow successfully', async () => {
      const env = {
        INPUT_OPERATION: 'remove',
        INPUT_STAGE: 'temp-test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'on-success',
        'INPUT_FAIL-ON-ERROR': 'true',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(SST_REMOVE_SUCCESS_OUTPUT, 0)
      );

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.outputs.operation).toBe('remove');
      expect(result.outputs.stage).toBe('temp-test');

      // Verify remove-specific outputs
      expect(result.outputs.resources_removed).toBeDefined();
      expect(result.outputs.removed_resources).toBeDefined();

      expect(spawn).toHaveBeenCalledWith(
        'sst',
        ['remove', '--stage', 'temp-test'],
        expect.any(Object)
      );
    });
  });

  describe('Input Validation Integration', () => {
    it('should handle invalid operation gracefully', async () => {
      const env = {
        INPUT_OPERATION: 'invalid-operation',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      const result = await executeAction(env);

      expect(result.exitCode).toBe(1);
      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed')
      );
    });

    it('should handle missing required inputs', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_TOKEN: 'fake-token',
        // Missing required INPUT_STAGE
      };

      const result = await executeAction(env);

      expect(result.exitCode).toBe(1);
      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed')
      );
    });
  });

  describe('Comment Mode Integration', () => {
    it('should respect comment-mode setting for success', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'never',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(SST_DEPLOY_SUCCESS_OUTPUT, 0)
      );

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      // GitHub comment creation should respect comment-mode
    });
  });

  describe('Error Recovery Integration', () => {
    it('should continue workflow when fail-on-error is false', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess('Deploy failed', 1)
      );

      const result = await executeAction(env);

      // Should not fail the action when fail-on-error is false
      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('false');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('SST deploy operation failed')
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '🔄 Continuing workflow as fail-on-error is disabled'
      );
    });
  });

  describe('Output Size Limits Integration', () => {
    it('should handle output truncation correctly', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_MAX-OUTPUT-SIZE': '100', // Very small limit
      };

      const largeOutput = 'x'.repeat(1000) + '\n' + SST_DEPLOY_SUCCESS_OUTPUT;
      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(largeOutput, 0)
      );

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.truncated).toBe('true');
      expect(mockCore.warning).toHaveBeenCalledWith(
        '⚠️ Output was truncated due to size limits'
      );
    });
  });

  describe('Environment Integration', () => {
    it('should work with different environment configurations', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'production',
        INPUT_TOKEN: 'ghp_test_token_123',
        GITHUB_REPOSITORY: 'test-org/test-repo',
        GITHUB_REF: 'refs/heads/main',
        CI: 'true',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createMockChildProcess(SST_DEPLOY_SUCCESS_OUTPUT, 0)
      );

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      // Should handle production environment appropriately
    });
  });
});
