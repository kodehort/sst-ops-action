import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitHubClient, GitHubClient } from '../../src/github/client.js';
import type {
  BaseOperationResult,
  DeployResult,
  DiffResult,
  RemoveResult,
} from '../../src/types/index.js';

// Additional mocks are handled in setup file

const mockCore = core as any;
const mockGitHub = github as any;
const mockArtifact = artifact as any;

// Mock GitHub API client
const mockOctokit = {
  rest: {
    issues: {
      createComment: vi.fn(),
      updateComment: vi.fn(),
      listComments: vi.fn(),
    },
  },
};

// Mock artifact client
const mockArtifactClient = {
  uploadArtifact: vi.fn(),
};

// Mock summary
const mockSummary = {
  addHeading: vi.fn().mockReturnThis(),
  addRaw: vi.fn().mockReturnThis(),
  addSeparator: vi.fn().mockReturnThis(),
  write: vi.fn().mockResolvedValue(undefined),
};

describe('GitHubClient', () => {
  let client: GitHubClient;
  const mockToken = 'ghp_test_token';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup GitHub mocks
    mockGitHub.getOctokit.mockReturnValue(mockOctokit as any);
    mockGitHub.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      payload: {
        pull_request: { number: 123 },
      },
    } as any;

    // Setup core summary mock
    mockCore.summary = mockSummary as any;

    // Setup artifact mock
    mockArtifact.create.mockReturnValue(mockArtifactClient as any);
    mockArtifactClient.uploadArtifact.mockResolvedValue({
      artifactName: 'test-artifact',
      size: 1024,
    } as any);

    client = new GitHubClient(mockToken);
  });

  describe('constructor', () => {
    it('should initialize with GitHub token', () => {
      expect(mockGitHub.getOctokit).toHaveBeenCalledWith(mockToken);
    });
  });

  describe('createOrUpdateComment', () => {
    const mockDeployResult: DeployResult = {
      success: true,
      operation: 'deploy',
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'Deploy successful',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete',
      resourceChanges: 3,
      urls: [
        { type: 'Web', url: 'https://app.example.com' },
        { type: 'API', url: 'https://api.example.com' },
      ],
      resources: [],
      permalink: 'https://console.sst.dev/test-app/staging',
    };

    it('should create comment when comment mode is "always"', async () => {
      await client.createOrUpdateComment(mockDeployResult, 'always');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('SST DEPLOY SUCCESS'),
      });
    });

    it('should create comment on success when mode is "on-success"', async () => {
      await client.createOrUpdateComment(mockDeployResult, 'on-success');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    });

    it('should not create comment on success when mode is "on-failure"', async () => {
      await client.createOrUpdateComment(mockDeployResult, 'on-failure');

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it('should create comment on failure when mode is "on-failure"', async () => {
      const failedResult: DeployResult = {
        ...mockDeployResult,
        success: false,
        exitCode: 1,
        completionStatus: 'failed',
        error: 'Deployment failed',
      };

      await client.createOrUpdateComment(failedResult, 'on-failure');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('SST DEPLOY FAILED'),
      });
    });

    it('should not create comment when mode is "never"', async () => {
      await client.createOrUpdateComment(mockDeployResult, 'never');

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it('should update existing comment instead of creating new one', async () => {
      const existingComment = {
        id: 456,
        body: '<!-- sst-deploy -->\nOld comment content',
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [existingComment],
      } as any);

      await client.createOrUpdateComment(mockDeployResult, 'always', {
        updateExisting: true,
      });

      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 456,
        body: expect.stringContaining('<!-- sst-deploy -->'),
      });
    });

    it('should handle API errors gracefully', async () => {
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('API Error')
      );

      await client.createOrUpdateComment(mockDeployResult, 'always');

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create comment')
      );
    });

    it('should skip comment creation when not in PR context', async () => {
      mockGitHub.context.payload.pull_request = undefined;

      await client.createOrUpdateComment(mockDeployResult, 'always');

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('createWorkflowSummary', () => {
    const mockDiffResult: DiffResult = {
      success: true,
      operation: 'diff',
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'No changes detected',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete',
      resourceChanges: 0,
      urls: [],
      diffSummary: 'No infrastructure changes detected',
    };

    it('should create workflow summary for successful operation', async () => {
      await client.createWorkflowSummary(mockDiffResult);

      expect(mockSummary.addHeading).toHaveBeenCalledWith(
        'SST DIFF Summary',
        2
      );
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('operation completed successfully')
      );
      expect(mockSummary.write).toHaveBeenCalled();
    });

    it('should create workflow summary for failed operation', async () => {
      const failedResult: DiffResult = {
        ...mockDiffResult,
        success: false,
        exitCode: 1,
        completionStatus: 'failed',
        error: 'Operation failed',
      };

      await client.createWorkflowSummary(failedResult);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('operation failed')
      );
    });

    it('should handle summary creation errors gracefully', async () => {
      mockSummary.write.mockRejectedValue(new Error('Summary error'));

      await client.createWorkflowSummary(mockDiffResult);

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create workflow summary')
      );
    });
  });

  describe('uploadArtifacts', () => {
    const mockRemoveResult: RemoveResult = {
      success: true,
      operation: 'remove',
      stage: 'pr-123',
      app: 'test-app',
      rawOutput: 'Resources removed successfully',
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete',
      resourceChanges: 5,
      urls: [],
    };

    it('should upload artifacts successfully', async () => {
      await client.uploadArtifacts(mockRemoveResult);

      expect(mockArtifactClient.uploadArtifact).toHaveBeenCalledWith(
        expect.stringContaining('sst-remove-pr-123'),
        expect.arrayContaining([
          expect.stringContaining('result.json'),
          expect.stringContaining('output.txt'),
          expect.stringContaining('metadata.json'),
        ]),
        '/tmp/sst-artifacts',
        expect.objectContaining({
          retentionDays: 30,
          compressionLevel: 6,
        })
      );
    });

    it('should use custom artifact options', async () => {
      await client.uploadArtifacts(mockRemoveResult, {
        name: 'custom-artifact',
        retentionDays: 7,
        compressionLevel: 9,
      });

      expect(mockArtifactClient.uploadArtifact).toHaveBeenCalledWith(
        'custom-artifact',
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({
          retentionDays: 7,
          compressionLevel: 9,
        })
      );
    });

    it('should handle upload errors gracefully', async () => {
      mockArtifactClient.uploadArtifact.mockRejectedValue(
        new Error('Upload failed')
      );

      await client.uploadArtifacts(mockRemoveResult);

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload artifacts')
      );
    });
  });

  describe('rate limiting', () => {
    it('should retry on rate limit errors', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      mockOctokit.rest.issues.createComment
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { id: 123 } } as any);

      const mockResult: BaseOperationResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Success',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
      };

      await client.createOrUpdateComment(mockResult, 'always');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(3);
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited, retrying')
      );
    });

    it('should fail after max retries on rate limit errors', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      mockOctokit.rest.issues.createComment.mockRejectedValue(rateLimitError);

      const mockResult: BaseOperationResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Success',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
      };

      await client.createOrUpdateComment(mockResult, 'always');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(3);
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create comment')
      );
    });

    it('should not retry on non-rate-limit errors', async () => {
      const genericError = new Error('Generic API error');
      mockOctokit.rest.issues.createComment.mockRejectedValue(genericError);

      const mockResult: BaseOperationResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Success',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
      };

      await client.createOrUpdateComment(mockResult, 'always');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
    });
  });

  describe('comment content formatting', () => {
    it('should format deploy comment with URLs and resource changes', async () => {
      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'production',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 5,
        urls: [
          { type: 'Web', url: 'https://my-app.com' },
          { type: 'API', url: 'https://api.my-app.com' },
        ],
        resources: [],
        permalink: 'https://console.sst.dev/my-app/production',
      };

      await client.createOrUpdateComment(deployResult, 'always');

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0][0].body;
      expect(commentBody).toContain('DEPLOY SUCCESS');
      expect(commentBody).toContain('**Stage:** `production`');
      expect(commentBody).toContain('**App:** `my-app`');
      expect(commentBody).toContain('Total Changes:** 5');
      expect(commentBody).toContain('https://my-app.com');
      expect(commentBody).toContain('https://api.my-app.com');
      expect(commentBody).toContain(
        'https://console.sst.dev/my-app/production'
      );
    });

    it('should format diff comment with changes summary', async () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Diff completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 0,
        urls: [],
        diffSummary: '3 resources to create, 2 to update',
      };

      await client.createOrUpdateComment(diffResult, 'always');

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0][0].body;
      expect(commentBody).toContain('SST DIFF SUCCESS');
      expect(commentBody).toContain('3 resources to create, 2 to update');
    });

    it('should format remove comment with cleanup status', async () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'pr-123',
        app: 'my-app',
        rawOutput: 'Cleanup completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 8,
        urls: [],
      };

      await client.createOrUpdateComment(removeResult, 'always');

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0][0].body;
      expect(commentBody).toContain('SST REMOVE SUCCESS');
      expect(commentBody).toContain('Resources Removed: 8');
      expect(commentBody).toContain('All resources successfully removed');
    });
  });
});

describe('createGitHubClient', () => {
  it('should create a GitHubClient instance', () => {
    const token = 'test-token';
    const client = createGitHubClient(token);

    expect(client).toBeInstanceOf(GitHubClient);
    expect(mockGitHub.getOctokit).toHaveBeenCalledWith(token);
  });
});
