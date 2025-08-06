/**
 * Error scenario integration tests for SST Operations Action
 * Tests edge cases, failures, and error recovery mechanisms
 */

import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Mock @actions/github with potential failures
const mockOctokit = {
  rest: {
    issues: {
      createComment: vi.fn(),
      updateComment: vi.fn(),
      listComments: vi.fn().mockResolvedValue({ data: [] }),
    },
  },
};

vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 1 },
    payload: { pull_request: { number: 123 } },
    eventName: 'pull_request',
  },
  getOctokit: vi.fn(() => mockOctokit),
}));

// Mock file system operations that might fail
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('@actions/io', () => ({
  mkdirP: vi.fn(),
}));

/**
 * Creates a mock child process that can simulate various failure modes
 */
function createFailingMockChildProcess(
  output: string,
  exitCode: number,
  errorType?: 'timeout' | 'crash' | 'stream_error'
) {
  const mockProcess = {
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data' && errorType !== 'stream_error') {
          setTimeout(() => callback(Buffer.from(output)), 10);
        } else if (event === 'error' && errorType === 'stream_error') {
          setTimeout(() => callback(new Error('Stream error')), 10);
        }
      }),
      pipe: vi.fn(),
    },
    stderr: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Error details')), 15);
        }
      }),
      pipe: vi.fn(),
    },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        if (errorType === 'timeout') {
          // Simulate timeout by not calling callback
          return;
        }
        setTimeout(() => callback(exitCode), 50);
      } else if (event === 'error' && errorType === 'crash') {
        setTimeout(() => callback(new Error('Process crashed')), 25);
      }
    }),
    kill: vi.fn(),
  };
  return mockProcess as any;
}

/**
 * Executes the action with error handling
 */
async function executeActionWithErrorHandling(env: Record<string, string>) {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  mockCore.getInput.mockImplementation((name: string) => {
    return env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] || '';
  });

  mockCore.getBooleanInput.mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  const { run } = await import('../../src/main');

  let exitCode = 0;
  const outputs: Record<string, string> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  mockCore.setOutput.mockImplementation((name: string, value: string) => {
    outputs[name] = value;
  });

  mockCore.setFailed.mockImplementation((message: string) => {
    exitCode = 1;
    outputs.error = message;
  });

  mockCore.error.mockImplementation((message: string) => {
    errors.push(message);
  });

  mockCore.warning.mockImplementation((message: string) => {
    warnings.push(message);
  });

  try {
    await run();
  } catch (error) {
    exitCode = 1;
    outputs.error = error instanceof Error ? error.message : String(error);
  }

  return { exitCode, outputs, errors, warnings };
}

describe('Error Scenarios Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('INPUT_')) {
        delete process.env[key];
      }
    });
  });

  describe('CLI Execution Failures', () => {
    it('should handle SST CLI not found error', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_FAIL-ON-ERROR': 'true',
      };

      // Mock SST CLI not found
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('spawn sst ENOENT');
      });

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.errors.some((err) => err.includes('ENOENT'))).toBe(true);
    });

    it('should handle authentication errors gracefully', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'production',
        INPUT_TOKEN: 'invalid-token',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      const authErrorOutput = `
        Error: AWS credentials not found
        Please configure your AWS credentials
      `;

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess(authErrorOutput, 1)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0); // Should not fail when fail-on-error is false
      expect(result.outputs.success).toBe('false');
      expect(
        result.warnings.some((warn) => warn.includes('operation failed'))
      ).toBe(true);
    });

    it('should handle permission denied errors', async () => {
      const env = {
        INPUT_OPERATION: 'remove',
        INPUT_STAGE: 'production',
        INPUT_TOKEN: 'fake-token',
        'INPUT_FAIL-ON-ERROR': 'true',
      };

      const permissionErrorOutput = `
        Error: Access denied
        Insufficient permissions for S3 bucket operations
      `;

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess(permissionErrorOutput, 1)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle process crash scenarios', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Partial output', 1, 'crash')
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
    });

    it('should handle stream errors', async () => {
      const env = {
        INPUT_OPERATION: 'diff',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('', 0, 'stream_error')
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely long stage names', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'a'.repeat(1000), // Very long stage name
        INPUT_TOKEN: 'fake-token',
      };

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(
        result.errors.some((err) => err.includes('validation failed'))
      ).toBe(true);
    });

    it('should handle invalid characters in stage name', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test@#$%^&*()',
        INPUT_TOKEN: 'fake-token',
      };

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(
        result.errors.some((err) => err.includes('validation failed'))
      ).toBe(true);
    });

    it('should handle empty or whitespace-only inputs', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: '   ',
        INPUT_TOKEN: 'fake-token',
      };

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(
        result.errors.some((err) => err.includes('validation failed'))
      ).toBe(true);
    });

    it('should handle malformed token formats', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'not-a-real-token-format',
      };

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(
        result.errors.some((err) => err.includes('validation failed'))
      ).toBe(true);
    });
  });

  describe('Output Parsing Edge Cases', () => {
    it('should handle completely malformed SST output', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      const malformedOutput = `
        Random garbage text
        { invalid: json
        Not SST output at all
      `;

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess(malformedOutput, 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
    });

    it('should handle empty SST output', async () => {
      const env = {
        INPUT_OPERATION: 'diff',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
    });

    it('should handle partial SST output with truncation', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_MAX-OUTPUT-SIZE': '50', // Very small limit
      };

      const partialOutput = `
        Starting deployment...
        Resource updates:
        | Function | MyFunc | Created
        Deployment comple
      `; // Truncated output

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess(partialOutput, 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.outputs.truncated).toBe('true');
      expect(result.warnings.some((warn) => warn.includes('truncated'))).toBe(
        true
      );
    });
  });

  describe('GitHub API Integration Failures', () => {
    it('should handle GitHub API rate limiting', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'always',
      };

      // Mock rate limiting error
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0); // Should not fail the action
      expect(result.warnings.some((warn) => warn.includes('rate limit'))).toBe(
        true
      );
    });

    it('should handle GitHub API authentication failures', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'invalid-github-token',
        'INPUT_COMMENT-MODE': 'always',
      };

      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Bad credentials')
      );

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0); // Should not fail the action
      expect(
        result.warnings.some((warn) =>
          warn.includes('Failed to create comment')
        )
      ).toBe(true);
    });

    it('should handle GitHub API network failures', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'on-success',
      };

      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Network timeout')
      );

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('System Resource Failures', () => {
    it('should handle file system permission errors', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      // Mock file system failure
      const { writeFile } = await import('node:fs/promises');
      vi.mocked(writeFile).mockRejectedValue(
        new Error('EACCES: permission denied')
      );

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy failed', 1)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(
        result.warnings.some((warn) => warn.includes('permission denied'))
      ).toBe(true);
    });

    it('should handle disk space exhaustion', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      const { writeFile } = await import('node:fs/promises');
      vi.mocked(writeFile).mockRejectedValue(
        new Error('ENOSPC: no space left on device')
      );

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy failed', 1)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.warnings.some((warn) => warn.includes('space left'))).toBe(
        true
      );
    });
  });

  describe('Concurrent Operation Conflicts', () => {
    it('should handle SST lock file conflicts', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'shared-stage',
        INPUT_TOKEN: 'fake-token',
      };

      const lockErrorOutput = `
        Error: Stage is currently being deployed by another process
        Lock file exists: .sst/shared-stage.lock
      `;

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess(lockErrorOutput, 1)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
      expect(result.errors.some((err) => err.includes('lock'))).toBe(true);
    });
  });

  describe('Environment Edge Cases', () => {
    it('should handle missing environment variables', async () => {
      // Remove standard GitHub Actions environment variables
      delete process.env.GITHUB_REPOSITORY;
      delete process.env.GITHUB_REF;
      delete process.env.GITHUB_SHA;

      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      // Should still work but may have limited functionality
      expect(result.exitCode).toBe(0);
    });

    it('should handle corrupted action metadata', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        GITHUB_ACTION: 'corrupted-action-ref',
      };

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from transient GitHub API failures', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'always',
      };

      // First call fails, second succeeds (if retried)
      mockOctokit.rest.issues.createComment
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({ data: { id: 123 } } as any);

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0);
      // Should have warnings about the failure but continue
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle graceful degradation when non-critical features fail', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'on-success',
      };

      // Summary creation fails but shouldn't break the action
      mockCore.summary.write.mockRejectedValue(
        new Error('Summary service unavailable')
      );

      vi.mocked(spawn).mockImplementation(() =>
        createFailingMockChildProcess('Deploy successful', 0)
      );

      const result = await executeActionWithErrorHandling(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.warnings.some((warn) => warn.includes('summary'))).toBe(
        true
      );
    });
  });
});
