import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitHubClient, GitHubClient } from '../../src/github/client.js';
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
} from '../../src/types/index.js';
import {
  createMockDeployResult,
  createMockSSTUrl,
} from '../utils/test-types.js';

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

// Mock github module
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    payload: {
      pull_request: { number: 123 },
    },
  },
}));

// Mock summary
const mockSummary = {
  addHeading: vi.fn().mockReturnThis(),
  addRaw: vi.fn().mockReturnThis(),
  addSeparator: vi.fn().mockReturnThis(),
  write: vi.fn().mockResolvedValue(undefined),
};

describe('GitHub Client - API Integration', () => {
  let client: GitHubClient;
  const mockToken = 'ghp_test_token';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behaviors
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] } as any);

    // Setup github mock
    (github.getOctokit as any).mockReturnValue(mockOctokit);

    // Setup core summary mock - core is already mocked in setup.ts
    (core as any).summary = mockSummary as any;

    client = new GitHubClient(mockToken);
  });

  describe('constructor', () => {
    it('should initialize with GitHub token', () => {
      expect(github.getOctokit).toHaveBeenCalledWith(mockToken);
    });
  });

  describe('createOrUpdateComment', () => {
    const mockDeployResult = createMockDeployResult({
      stage: 'staging',
      app: 'test-app',
      rawOutput: 'Deploy successful',
      resourceChanges: 3,
      urls: [
        createMockSSTUrl({
          name: 'app',
          type: 'web',
          url: 'https://app.example.com',
        }),
        createMockSSTUrl({
          name: 'api',
          type: 'api',
          url: 'https://api.example.com',
        }),
      ],
      permalink: 'https://console.sst.dev/test-app/staging',
    }) as DeployResult;

    it('should create comment when comment mode is "always"', async () => {
      await client.createOrUpdateComment(mockDeployResult, 'always');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('🚀 DEPLOY SUCCESS'),
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
        body: expect.stringContaining('❌ DEPLOY FAILED'),
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

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create comment')
      );
    });

    it('should skip comment creation when not in PR context', async () => {
      // Temporarily modify the github context for this test
      const originalPayload = (github as any).context.payload;
      (github as any).context.payload = {};

      const testClient = new GitHubClient(mockToken);
      await testClient.createOrUpdateComment(mockDeployResult, 'always');

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();

      // Restore original payload
      (github as any).context.payload = originalPayload;
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
      plannedChanges: 0,
      changeSummary: 'No infrastructure changes detected',
      changes: [],
    };

    it('should create workflow summary for successful operation', async () => {
      await client.createWorkflowSummary(mockDiffResult);

      expect(mockSummary.addHeading).not.toHaveBeenCalled();
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Infrastructure Diff Summary')
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
        expect.stringContaining(
          '![Failed](https://img.shields.io/badge/Status-Failed-red)'
        )
      );
    });

    it('should handle summary creation errors gracefully', async () => {
      mockSummary.write.mockRejectedValue(new Error('Summary error'));

      await client.createWorkflowSummary(mockDiffResult);

      expect(core.warning).toHaveBeenCalledWith(
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
      resourcesRemoved: 5,
      removedResources: [],
    };

    it('should upload artifacts successfully', async () => {
      await client.uploadArtifacts(mockRemoveResult);

      // Verify DefaultArtifactClient constructor was called
      expect(DefaultArtifactClient).toHaveBeenCalled();
    });

    it('should use custom artifact options', async () => {
      await client.uploadArtifacts(mockRemoveResult, {
        name: 'custom-artifact',
        retentionDays: 7,
        compressionLevel: 9,
      });

      // Verify DefaultArtifactClient constructor was called
      expect(DefaultArtifactClient).toHaveBeenCalled();
    });

    it('should handle upload errors gracefully', async () => {
      // Create a new mock implementation that throws an error
      const failingArtifactClient = {
        uploadArtifact: vi.fn().mockRejectedValue(new Error('Upload failed')),
      };

      // Mock DefaultArtifactClient to return our failing instance
      (DefaultArtifactClient as any).mockReturnValueOnce(
        failingArtifactClient as any
      );

      await client.uploadArtifacts(mockRemoveResult);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload artifacts')
      );
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
          { name: 'app', type: 'web', url: 'https://my-app.com' },
          { name: 'api', type: 'api', url: 'https://api.my-app.com' },
        ],
        resources: [],
        permalink: 'https://console.sst.dev/my-app/production',
      };

      await client.createOrUpdateComment(deployResult, 'always');

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0]?.[0]?.body;
      expect(commentBody).toContain('DEPLOY SUCCESS');
      expect(commentBody).toContain('**Stage:** `production`');
      expect(commentBody).toContain('**App:** `my-app`');
      expect(commentBody).toContain('**Total Changes:** 5');
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
        plannedChanges: 5,
        changeSummary: '3 resources to create, 2 to update',
        changes: [
          { type: 'Lambda', name: 'Function1', action: 'create' },
          { type: 'S3', name: 'Bucket1', action: 'update' },
        ],
      };

      await client.createOrUpdateComment(diffResult, 'always');

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0]?.[0]?.body;
      expect(commentBody).toContain('🔍 DIFF SUCCESS');
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
        resourcesRemoved: 8,
        removedResources: [
          { type: 'Lambda', name: 'TestFunction', status: 'removed' },
          { type: 'S3', name: 'TestBucket', status: 'removed' },
        ],
      };

      await client.createOrUpdateComment(removeResult, 'always');

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0]?.[0]?.body;
      expect(commentBody).toContain('🗑️ REMOVE SUCCESS');
      expect(commentBody).toContain('Resources cleaned up: 8');
      expect(commentBody).toContain('All resources successfully removed');
    });
  });
});

describe('createGitHubClient', () => {
  it('should create a GitHubClient instance', () => {
    const token = 'test-token';
    const client = createGitHubClient(token);

    expect(client).toBeInstanceOf(GitHubClient);
    expect(github.getOctokit).toHaveBeenCalledWith(token);
  });
});
