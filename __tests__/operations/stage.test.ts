/**
 * Test suite for StageOperation
 * Tests stage computation operation execution and integration
 */

import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/github/client';
import { StageOperation } from '../../src/operations/stage';
import type { OperationOptions } from '../../src/types';

describe('Stage Operation - Stage Computation Integration', () => {
  let stageOperation: StageOperation;
  let mockGitHubClient: GitHubClient;
  let mockOptions: OperationOptions;

  beforeEach(() => {
    // Create mock GitHub client
    mockGitHubClient = {
      createOrUpdateComment: vi.fn().mockResolvedValue(undefined),
      createWorkflowSummary: vi.fn().mockResolvedValue(undefined),
    } as unknown as GitHubClient;

    // Create stage operation instance
    stageOperation = new StageOperation(null, mockGitHubClient);

    // Default options
    mockOptions = {
      stage: 'fallback-stage',
      token: 'test-token',
      commentMode: 'never',
      failOnError: true,
      maxOutputSize: 1000,
      runner: 'bun',
      environment: {},
    };

    // Reset mocks
    vi.clearAllMocks();

    // Reset GitHub context to a clean state
    Object.assign(github.context, {
      eventName: 'push',
      payload: {},
      ref: undefined,
      ref_name: undefined,
    });
  });

  describe('Stage Operation Execution', () => {
    it('should execute stage operation successfully for pull request', async () => {
      // Mock GitHub context
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/user-authentication',
            },
          },
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('stage');
      expect(result.stage).toBe('user-authentication');
      expect(result.computedStage).toBe('user-authentication');
      expect(result.ref).toBe('feature/user-authentication');
      expect(result.eventName).toBe('pull_request');
      expect(result.isPullRequest).toBe(true);
      expect(result.app).toBe('stage-calculator');
      expect(result.completionStatus).toBe('complete');
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should execute stage operation successfully for push event', async () => {
      // Mock GitHub context
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('main');
      expect(result.ref).toBe('refs/heads/main');
      expect(result.eventName).toBe('push');
      expect(result.isPullRequest).toBe(false);
    });

    it('should fail when missing ref (no fallback behavior)', async () => {
      // Mock GitHub context with no ref
      Object.assign(github.context, {
        eventName: 'workflow_dispatch',
        payload: {},
      });

      mockOptions.stage = 'production'; // This is ignored by stage operation

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Failed to generate a valid stage name from Git context'
      );
      expect(result.exitCode).toBe(1);
    });

    it('should handle numeric branch names correctly', async () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: '123-hotfix',
            },
          },
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('pr-123-hotfix');
    });

    it('should truncate long branch names', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/feature/very-long-branch-name-that-should-be-truncated',
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage.length).toBeLessThanOrEqual(26);
      expect(result.computedStage).toBe('very-long-branch-name-that');
    });

    it('should handle output truncation when maxOutputSize is small', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      mockOptions.maxOutputSize = 20;

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.rawOutput.length).toBe(20);
    });

    it('should fail when no valid stage can be determined', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {},
      });

      mockOptions.stage = ''; // Empty fallback

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Failed to generate a valid stage name from Git context'
      );
      expect(result.completionStatus).toBe('failed');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in branch names', async () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/my-branch@special#chars',
            },
          },
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('my-branch-special-chars');
    });

    it('should handle mixed case and underscores', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/Feature_Branch_Name',
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('feature-branch-name');
    });

    it('should remove leading and trailing hyphens', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/---branch-name---',
        },
      });

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('branch-name');
    });
  });

  describe('Stage Inference Integration', () => {
    it('should work with empty stage input (automatic inference)', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/feature-auto-stage',
        },
      });

      // Use empty stage to test inference
      mockOptions.stage = '';

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('feature-auto-stage');
      expect(result.stage).toBe('feature-auto-stage');
    });

    it('should prefer explicit stage over inference when provided', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/feature-branch',
        },
      });

      // Explicit stage should be used as fallback, but computed stage is from Git context
      mockOptions.stage = 'explicit-stage';

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      // Stage operation always computes from Git context, uses fallback only when computation fails
      expect(result.computedStage).toBe('feature-branch');
      expect(result.stage).toBe('feature-branch');
    });

    it('should fail when Git context provides no usable ref (no fallback)', async () => {
      Object.assign(github.context, {
        eventName: 'workflow_dispatch',
        payload: {},
        ref: undefined,
      });

      // Stage operation should fail when no Git context is available
      mockOptions.stage = 'fallback-stage'; // This is ignored

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Failed to generate a valid stage name from Git context'
      );
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Configurable Parameters', () => {
    it('should pass custom truncation length to parser', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/very-long-branch-name-that-exceeds-default-limits',
        },
      });

      mockOptions.truncationLength = 15;

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('very-long-branc'); // Truncated to 15 chars
      expect(result.computedStage.length).toBe(15);
    });

    it('should pass custom prefix to parser', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/123-hotfix',
        },
      });

      mockOptions.prefix = 'fix-';

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('fix-123-hotfix');
      expect(result.computedStage.startsWith('fix-')).toBe(true);
    });

    it('should use both custom parameters together', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/123-very-long-branch-name-that-needs-truncation',
        },
      });

      mockOptions.truncationLength = 20;
      mockOptions.prefix = 'issue-';

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('issue-123-very-long'); // Truncated to 19 chars due to trailing hyphen cleanup
      expect(result.computedStage.length).toBeLessThanOrEqual(20);
      expect(result.computedStage.startsWith('issue-')).toBe(true);
    });

    it('should use default values when parameters not provided', async () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/123-branch-name',
        },
      });

      // Don't set custom parameters - should use defaults

      const result = await stageOperation.execute(mockOptions);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('pr-123-branch-name'); // Default prefix 'pr-'
      expect(result.computedStage.length).toBeLessThanOrEqual(26); // Default truncation length
    });
  });
});
