import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/github/client';
import { DiffOperation } from '../../src/operations/diff';
import type { DiffParser } from '../../src/parsers/diff-parser';
import type { OperationOptions } from '../../src/types';
import type { SSTCLIExecutor } from '../../src/utils/cli';

// Mock the dependencies
const mockSSTExecutor = {
  executeSST: vi.fn(),
};

const mockGitHubClient = {
  postPRComment: vi.fn(),
};

const mockDiffParser = {
  parse: vi.fn(),
};

describe('Diff Operation - Change Analysis Workflows', () => {
  let diffOperation: DiffOperation;

  beforeEach(() => {
    vi.clearAllMocks();
    diffOperation = new DiffOperation(
      mockSSTExecutor as any as SSTCLIExecutor,
      mockGitHubClient as any as GitHubClient,
      mockDiffParser as any as DiffParser
    );
  });

  it('should execute diff operation successfully with changes detected', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
      maxOutputSize: 1_000_000,
    };

    const mockSSTResult = {
      success: true,
      stdout: `Planned changes:
+ Function MyFunction
~ Bucket MyBucket (policy updated)
- Database OldDatabase

Monthly: $45.50 → $67.80 (+$22.30)`,
      stderr: '',
      exitCode: 0,
      duration: 5000,
    };

    const mockDiffResult = {
      success: true,
      operation: 'diff' as const,
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete' as const,
      plannedChanges: 3,
      changeSummary:
        'Found 3 planned changes: 1 creation, 1 update, 1 deletion. Cost increase: +$22.30 monthly.',
      changes: [
        {
          type: 'Function',
          name: 'MyFunction',
          action: 'create' as const,
          details: '',
        },
        {
          type: 'Bucket',
          name: 'MyBucket',
          action: 'update' as const,
          details: 'policy updated',
        },
        {
          type: 'Database',
          name: 'OldDatabase',
          action: 'delete' as const,
          details: '',
        },
      ],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.postPRComment.mockResolvedValue({ success: true });

    const result = await diffOperation.execute(options);

    expect(result).toEqual({
      success: true,
      stage: 'staging',
      hasChanges: true,
      changesDetected: 3,
      changes: [
        {
          action: 'create',
          resourceType: 'Function',
          resourceName: 'MyFunction',
          details: '',
        },
        {
          action: 'update',
          resourceType: 'Bucket',
          resourceName: 'MyBucket',
          details: '',
        },
        {
          action: 'delete',
          resourceType: 'Database',
          resourceName: 'OldDatabase',
          details: '',
        },
      ],
      breakingChanges: false,
      costAnalysis: null,
      summary:
        'Found 3 planned changes: 1 creation, 1 update, 1 deletion. Cost increase: +$22.30 monthly.',
      prCommentPosted: true,
      executionTime: 5000,
      metadata: {
        cliExitCode: 0,
        parsingSuccess: true,
        githubIntegration: true,
      },
    });

    expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith('diff', 'staging', {
      env: { SST_TOKEN: 'test-token', NODE_ENV: 'production', CI: 'true' },
      timeout: 300_000, // 5 minutes
      maxOutputSize: 1_000_000,
    });

    expect(mockDiffParser.parse).toHaveBeenCalledWith(
      mockSSTResult.stdout,
      'staging',
      0
    );
    expect(mockGitHubClient.postPRComment).toHaveBeenCalledWith(
      expect.stringContaining('🔍 Infrastructure Changes Preview'),
      'diff'
    );
  });

  it('should handle diff operation with no changes detected', async () => {
    const options: OperationOptions = {
      stage: 'production',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: true,
      stdout: 'No changes detected.',
      stderr: '',
      exitCode: 0,
      duration: 2000,
    };

    const mockDiffResult = {
      success: true,
      operation: 'diff' as const,
      stage: 'production',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete' as const,
      plannedChanges: 0,
      changeSummary: 'No changes detected.',
      changes: [],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.postPRComment.mockResolvedValue({ success: true });

    const result = await diffOperation.execute(options);

    expect(result).toEqual({
      success: true,
      stage: 'production',
      hasChanges: false,
      changesDetected: 0,
      changes: [],
      breakingChanges: false,
      costAnalysis: null,
      summary: 'No changes detected.',
      prCommentPosted: true,
      executionTime: 2000,
      metadata: {
        cliExitCode: 0,
        parsingSuccess: true,
        githubIntegration: true,
      },
    });

    expect(mockGitHubClient.postPRComment).toHaveBeenCalledWith(
      expect.stringContaining('No Changes'),
      'diff'
    );
  });

  it('should handle diff with delete operations without breaking change warnings', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: true,
      stdout: `Planned changes:
- Function MyFunction

Changes detected in infrastructure.`,
      stderr: '',
      exitCode: 0,
      duration: 3000,
    };

    const mockDiffResult = {
      success: true,
      operation: 'diff' as const,
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete' as const,
      plannedChanges: 1,
      changeSummary: 'Found 1 planned change: 1 deletion.',
      changes: [
        {
          type: 'Function',
          name: 'MyFunction',
          action: 'delete' as const,
        },
      ],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.postPRComment.mockResolvedValue({ success: true });

    const result = await diffOperation.execute(options);

    expect(result.breakingChanges).toBe(false);
    expect(result.summary).toBe('Found 1 planned change: 1 deletion.');
    expect(mockGitHubClient.postPRComment).toHaveBeenCalledWith(
      expect.stringContaining('🔍 Infrastructure Changes Preview'),
      'diff'
    );
  });

  it('should handle SST CLI execution failure', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: false,
      stdout: '',
      stderr: 'Authentication failed: Invalid SST token',
      exitCode: 1,
      duration: 1000,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);

    const result = await diffOperation.execute(options);

    expect(result).toEqual({
      success: false,
      stage: 'staging',
      hasChanges: false,
      changesDetected: 0,
      changes: [],
      breakingChanges: false,
      costAnalysis: null,
      summary: 'Failed to execute SST diff command',
      prCommentPosted: false,
      executionTime: 1000,
      error: 'Authentication failed: Invalid SST token',
      metadata: {
        cliExitCode: 1,
        parsingSuccess: false,
        githubIntegration: false,
      },
    });

    expect(mockDiffParser.parse).not.toHaveBeenCalled();
    expect(mockGitHubClient.postPRComment).not.toHaveBeenCalled();
  });

  it('should handle GitHub API failure gracefully', async () => {
    const options: OperationOptions = {
      stage: 'staging',
      environment: { SST_TOKEN: 'test-token' },
    };

    const mockSSTResult = {
      success: true,
      stdout: `Planned changes:
+ Function MyFunction`,
      stderr: '',
      exitCode: 0,
      duration: 3000,
    };

    const mockDiffResult = {
      success: true,
      operation: 'diff' as const,
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'test output',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete' as const,
      plannedChanges: 1,
      changeSummary: 'Found 1 planned change: 1 creation.',
      changes: [
        {
          type: 'Function',
          name: 'MyFunction',
          action: 'create' as const,
          details: '',
        },
      ],
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.postPRComment.mockRejectedValue(
      new Error('GitHub API token invalid')
    );

    const result = await diffOperation.execute(options);

    expect(result.success).toBe(true);
    expect(result.prCommentPosted).toBe(false);
    expect(result.metadata.githubIntegration).toBe(false);
    expect(result.hasChanges).toBe(true);
  });
});
