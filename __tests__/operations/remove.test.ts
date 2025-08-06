import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/github/client';
import { RemoveOperation } from '../../src/operations/remove';
import type { RemoveParser } from '../../src/parsers/remove-parser';
import type { OperationOptions } from '../../src/types';
import type { SSTCLIExecutor } from '../../src/utils/cli';

// Mock the dependencies
const mockSSTExecutor = {
  executeSST: vi.fn(),
};

const mockGitHubClient = {
  postPRComment: vi.fn(),
};

const mockRemoveParser = {
  parse: vi.fn(),
};

describe('RemoveOperation', () => {
  let removeOperation: RemoveOperation;

  beforeEach(() => {
    vi.clearAllMocks();
    removeOperation = new RemoveOperation(
      mockSSTExecutor as any as SSTCLIExecutor,
      mockGitHubClient as any as GitHubClient,
      mockRemoveParser as any as RemoveParser
    );
  });

  it('should execute remove operation successfully with resources removed', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
      maxOutputSize: 1_000_000,
    };

    const mockSSTResult = {
      success: true,
      stdout: `Removing resources...
| Deleted Function MyFunction
| Deleted Bucket MyBucket
| Deleted Database OldDatabase

✓ All resources removed
Monthly cost savings: $67.80`,
      stderr: '',
      exitCode: 0,
      executionTime: 8000,
    };

    const mockRemoveResult = {
      success: true,
      operation: 'remove' as const,
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete' as const,
      resourcesRemoved: 3,
      removedResources: [
        { type: 'Function', name: 'MyFunction', status: 'removed' as const },
        { type: 'Bucket', name: 'MyBucket', status: 'removed' as const },
        { type: 'Database', name: 'OldDatabase', status: 'removed' as const },
      ],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockRemoveParser.parse.mockReturnValue(mockRemoveResult);
    mockGitHubClient.postPRComment.mockResolvedValue({ success: true });

    const result = await removeOperation.execute(options);

    expect(result).toEqual({
      success: true,
      stage: 'staging',
      resourcesRemoved: 3,
      removedResources: [
        {
          resourceType: 'Function',
          resourceName: 'MyFunction',
          status: 'removed',
        },
        { resourceType: 'Bucket', resourceName: 'MyBucket', status: 'removed' },
        {
          resourceType: 'Database',
          resourceName: 'OldDatabase',
          status: 'removed',
        },
      ],
      completionStatus: 'complete',
      costSavings: {
        monthly: 67.8,
        formatted: 'Monthly cost savings: $67.80',
      },
      summary:
        'Successfully removed 3 resources from staging. Monthly savings: $67.80',
      prCommentPosted: true,
      executionTime: 8000,
      metadata: {
        cliExitCode: 0,
        parsingSuccess: true,
        githubIntegration: true,
      },
    });

    expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith(
      'remove',
      'staging',
      {
        env: { SST_TOKEN: 'test-token', NODE_ENV: 'production', CI: 'true' },
        timeout: 900_000, // 15 minutes
        maxOutputSize: 1_000_000,
      }
    );

    expect(mockRemoveParser.parse).toHaveBeenCalledWith(
      mockSSTResult.stdout,
      'staging',
      0
    );
    expect(mockGitHubClient.postPRComment).toHaveBeenCalledWith(
      expect.stringContaining('Resources Successfully Removed'),
      'remove'
    );
  });

  it('should handle partial removal with some failures', async () => {
    const options: OperationOptions = {
      stage: 'production',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: true,
      stdout: `Removing resources...
| Deleted Function MyFunction
| Deleted Bucket MyBucket
! Database OldDatabase could not be removed: Resource in use

⚠ 2 of 3 resources removed successfully`,
      stderr: '',
      exitCode: 0,
      executionTime: 6000,
    };

    const mockRemoveResult = {
      success: true,
      operation: 'remove' as const,
      stage: 'production',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'partial' as const,
      resourcesRemoved: 2,
      removedResources: [
        { type: 'Function', name: 'MyFunction', status: 'removed' as const },
        { type: 'Bucket', name: 'MyBucket', status: 'removed' as const },
        { type: 'Database', name: 'OldDatabase', status: 'failed' as const },
      ],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockRemoveParser.parse.mockReturnValue(mockRemoveResult);
    mockGitHubClient.postPRComment.mockResolvedValue({ success: true });

    const result = await removeOperation.execute(options);

    expect(result).toEqual({
      success: true,
      stage: 'production',
      resourcesRemoved: 2,
      removedResources: [
        {
          resourceType: 'Function',
          resourceName: 'MyFunction',
          status: 'removed',
        },
        { resourceType: 'Bucket', resourceName: 'MyBucket', status: 'removed' },
        {
          resourceType: 'Database',
          resourceName: 'OldDatabase',
          status: 'failed',
        },
      ],
      completionStatus: 'partial',
      costSavings: null,
      summary:
        'Partially removed 2 of 3 resources from production. Some resources could not be removed.',
      prCommentPosted: true,
      executionTime: 6000,
      metadata: {
        cliExitCode: 0,
        parsingSuccess: true,
        githubIntegration: true,
      },
    });

    expect(mockGitHubClient.postPRComment).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ **Partial Resource Removal**'),
      'remove'
    );
  });

  it('should handle complete removal failure', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: false,
      stdout: '',
      stderr: 'Error: Unable to connect to AWS. Check your credentials.',
      exitCode: 1,
      executionTime: 2000,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);

    const result = await removeOperation.execute(options);

    expect(result).toEqual({
      success: false,
      stage: 'staging',
      resourcesRemoved: 0,
      removedResources: [],
      completionStatus: 'failed',
      costSavings: null,
      summary: 'Failed to execute SST remove command',
      prCommentPosted: false,
      executionTime: 2000,
      error: 'Error: Unable to connect to AWS. Check your credentials.',
      metadata: {
        cliExitCode: 1,
        parsingSuccess: false,
        githubIntegration: false,
      },
    });

    expect(mockRemoveParser.parse).not.toHaveBeenCalled();
    expect(mockGitHubClient.postPRComment).not.toHaveBeenCalled();
  });

  it('should handle parsing failure', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: true,
      stdout: 'Malformed output that cannot be parsed',
      stderr: '',
      exitCode: 0,
      executionTime: 3000,
    };

    const mockRemoveResult = {
      success: false,
      operation: 'remove' as const,
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'failed' as const,
      resourcesRemoved: 0,
      removedResources: [],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockRemoveParser.parse.mockReturnValue(mockRemoveResult);

    const result = await removeOperation.execute(options);

    expect(result).toEqual({
      success: false,
      stage: 'staging',
      resourcesRemoved: 0,
      removedResources: [],
      completionStatus: 'failed',
      costSavings: null,
      summary: 'Failed to parse SST remove output',
      prCommentPosted: false,
      executionTime: 3000,
      error: 'Failed to parse SST remove output',
      metadata: {
        cliExitCode: 0,
        parsingSuccess: false,
        githubIntegration: false,
      },
    });
  });

  it('should handle GitHub API failure gracefully', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: true,
      stdout: `| Deleted Function MyFunction
✓ All resources removed`,
      stderr: '',
      exitCode: 0,
      executionTime: 4000,
    };

    const mockRemoveResult = {
      success: true,
      operation: 'remove' as const,
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete' as const,
      resourcesRemoved: 1,
      removedResources: [
        { type: 'Function', name: 'MyFunction', status: 'removed' as const },
      ],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockRemoveParser.parse.mockReturnValue(mockRemoveResult);
    mockGitHubClient.postPRComment.mockRejectedValue(
      new Error('GitHub API rate limit exceeded')
    );

    const result = await removeOperation.execute(options);

    expect(result.success).toBe(true);
    expect(result.resourcesRemoved).toBe(1);
    expect(result.prCommentPosted).toBe(false);
    expect(result.metadata.githubIntegration).toBe(false);
    expect(result.completionStatus).toBe('complete');
  });
});
