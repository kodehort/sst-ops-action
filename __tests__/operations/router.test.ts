import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the classes needed for the router
vi.mock('@/github/client');
vi.mock('@/utils/cli');

import { GitHubClient } from '@/github/client';
import { OperationFactory } from '@/operations/factory';
import { executeOperation } from '@/operations/router';
import type {
  DeployResult,
  DiffResult,
  OperationOptions,
  RemoveResult,
} from '@/types';
import { SSTCLIExecutor } from '@/utils/cli';

describe('OperationRouter', () => {
  let mockOperation: {
    execute: ReturnType<typeof vi.fn>;
  };

  const defaultOptions: OperationOptions = {
    stage: 'test-stage',
    token: 'test-token',
    commentMode: 'on-success',
    failOnError: true,
    maxOutputSize: 50_000,
    runner: 'bun',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock operation
    mockOperation = {
      execute: vi.fn(),
    };

    // Mock OperationFactory methods
    vi.spyOn(OperationFactory.prototype, 'createOperation').mockReturnValue(
      mockOperation as any
    );
    vi.spyOn(OperationFactory, 'isValidOperationType').mockReturnValue(true);
    vi.spyOn(OperationFactory, 'getSupportedOperations').mockReturnValue([
      'deploy',
      'diff',
      'remove',
      'stage',
    ]);

    // Mock GitHubClient and SSTCLIExecutor constructors
    vi.mocked(GitHubClient).mockImplementation(
      () =>
        ({
          commentOnPR: vi.fn(),
          updateWorkflowSummary: vi.fn(),
        }) as any
    );

    vi.mocked(SSTCLIExecutor).mockImplementation(
      () =>
        ({
          execute: vi.fn(),
        }) as any
    );
  });

  describe('executeOperation', () => {
    it('should validate operation type before execution', async () => {
      vi.spyOn(OperationFactory, 'isValidOperationType').mockReturnValue(false);
      vi.spyOn(OperationFactory, 'getSupportedOperations').mockReturnValue([
        'deploy',
        'diff',
        'remove',
      ]);

      const result = await executeOperation('invalid' as any, defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid operation type: invalid');
      expect(result.error).toContain(
        'Supported operations: deploy, diff, remove'
      );
    });

    it('should handle deploy operation successfully', async () => {
      const mockDeployResult = {
        success: true,
        stage: 'test-stage',
        metadata: {
          app: 'test-app',
          rawOutput: 'Deploy successful',
          cliExitCode: 0,
          truncated: false,
        },
        resourceChanges: 3,
        urls: [
          { name: 'api', url: 'https://api.example.com', type: 'api' },
          { name: 'web', url: 'https://web.example.com', type: 'web' },
        ],
        resources: [
          {
            type: 'function',
            name: 'handler',
            status: 'created',
            timing: '2s',
          },
        ],
        permalink: 'https://console.sst.dev/deploy/123',
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation('deploy', defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect((result as DeployResult).resourceChanges).toBe(3);
      expect((result as DeployResult).urls).toHaveLength(2);
      expect((result as DeployResult).resources).toHaveLength(1);
      expect((result as DeployResult).permalink).toBe(
        'https://console.sst.dev/deploy/123'
      );
    });

    it('should handle diff operation successfully', async () => {
      const mockDiffResult = {
        success: true,
        stage: 'test-stage',
        metadata: {
          app: 'test-app',
          rawOutput: 'Diff completed',
          cliExitCode: 0,
          truncated: false,
        },
        changesDetected: 2,
        summary: 'Infrastructure changes detected',
        changes: [
          {
            resourceType: 'function',
            resourceName: 'handler',
            action: 'create',
            details: 'New Lambda function',
          },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockDiffResult);

      const result = await executeOperation('diff', defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect((result as DiffResult).plannedChanges).toBe(2);
      expect((result as DiffResult).changeSummary).toBe(
        'Infrastructure changes detected'
      );
      expect((result as DiffResult).changes).toHaveLength(1);
    });

    it('should handle remove operation successfully', async () => {
      const mockRemoveResult = {
        success: true,
        stage: 'test-stage',
        metadata: {
          app: 'test-app',
          rawOutput: 'Remove completed',
          cliExitCode: 0,
          truncated: false,
        },
        completionStatus: 'complete' as const,
        resourcesRemoved: 5,
        removedResources: [
          {
            resourceType: 'function',
            resourceName: 'handler',
            status: 'removed',
          },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockRemoveResult);

      const result = await executeOperation('remove', defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect((result as RemoveResult).resourcesRemoved).toBe(5);
      expect((result as RemoveResult).removedResources).toHaveLength(1);
    });

    it('should handle stage operation successfully', async () => {
      const mockStageResult = {
        success: true,
        operation: 'stage' as const,
        stage: 'test-stage',
        app: 'test-app',
        rawOutput: '',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete' as const,
        computedStage: 'pr-123',
        ref: 'refs/heads/feature-branch',
        eventName: 'pull_request',
        isPullRequest: true,
      };

      mockOperation.execute.mockResolvedValue(mockStageResult);

      const result = await executeOperation('stage', defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('stage');
      expect(result).toEqual(mockStageResult);
    });

    it('should handle operation execution errors', async () => {
      const mockError = new Error('Operation failed');
      mockOperation.execute.mockRejectedValue(mockError);

      const result = await executeOperation('deploy', defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation failed');
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('test-stage');
    });

    it('should normalize URL types correctly', async () => {
      const mockDeployResult = {
        success: true,
        stage: 'test-stage',
        metadata: { app: 'test-app' },
        urls: [
          { name: 'valid-api', url: 'https://api.example.com', type: 'api' },
          {
            name: 'invalid-type',
            url: 'https://custom.example.com',
            type: 'custom',
          },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation('deploy', defaultOptions);

      const deployResult = result as DeployResult;
      expect(deployResult.urls?.[0]?.type).toBe('api');
      expect(deployResult.urls?.[1]?.type).toBe('other'); // Should normalize to 'other'
    });

    it('should normalize resource status correctly', async () => {
      const mockDeployResult = {
        success: true,
        stage: 'test-stage',
        metadata: { app: 'test-app' },
        resources: [
          { type: 'function', name: 'valid', status: 'created' },
          { type: 'function', name: 'invalid', status: 'invalid-status' },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation('deploy', defaultOptions);

      const deployResult = result as DeployResult;
      expect(deployResult.resources?.[0]?.status).toBe('created');
      expect(deployResult.resources?.[1]?.status).toBe('created'); // Should normalize to 'created'
    });

    it('should normalize diff actions correctly', async () => {
      const mockDiffResult = {
        success: true,
        stage: 'test-stage',
        metadata: { app: 'test-app' },
        changes: [
          { resourceType: 'function', resourceName: 'valid', action: 'create' },
          {
            resourceType: 'function',
            resourceName: 'invalid',
            action: 'modify',
          },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockDiffResult);

      const result = await executeOperation('diff', defaultOptions);

      const diffResult = result as DiffResult;
      expect(diffResult.changes?.[0]?.action).toBe('create');
      expect(diffResult.changes?.[1]?.action).toBe('update'); // Should normalize to 'update'
    });

    it('should normalize remove status correctly', async () => {
      const mockRemoveResult = {
        success: true,
        stage: 'test-stage',
        metadata: { app: 'test-app' },
        removedResources: [
          {
            resourceType: 'function',
            resourceName: 'valid',
            status: 'removed',
          },
          {
            resourceType: 'function',
            resourceName: 'invalid',
            status: 'invalid-status',
          },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockRemoveResult);

      const result = await executeOperation('remove', defaultOptions);

      const removeResult = result as RemoveResult;
      expect(removeResult.removedResources?.[0]?.status).toBe('removed');
      expect(removeResult.removedResources?.[1]?.status).toBe('failed'); // Should normalize to 'failed'
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockDeployResult = {
        success: true,
        stage: 'test-stage',
        // Missing metadata, urls, resources
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation('deploy', defaultOptions);

      expect(result.success).toBe(true);
      expect((result as DeployResult).app).toBe('unknown');
      expect((result as DeployResult).rawOutput).toBe('');
      expect((result as DeployResult).exitCode).toBe(0);
      expect((result as DeployResult).resourceChanges).toBe(0);
      expect((result as DeployResult).urls).toEqual([]);
      expect((result as DeployResult).resources).toEqual([]);
    });

    it('should use fake token for stage operations', async () => {
      const mockStageResult = {
        success: true,
        operation: 'stage' as const,
        stage: 'test-stage',
        app: 'test-app',
        rawOutput: '',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete' as const,
        computedStage: 'main',
        ref: 'refs/heads/main',
        eventName: 'push',
        isPullRequest: false,
      };

      mockOperation.execute.mockResolvedValue(mockStageResult);

      await executeOperation('stage', defaultOptions);

      expect(GitHubClient).toHaveBeenCalledWith('fake-token');
    });

    it('should create failure result for unknown operation type', async () => {
      const result = await executeOperation('unknown' as any, defaultOptions);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('unknown');
      expect(result.stage).toBe('test-stage');
      expect(result.error).toContain(
        'Cannot transform result for unknown operation'
      );
    });

    it('should preserve optional fields when present', async () => {
      const mockDeployResult = {
        success: true,
        stage: 'test-stage',
        metadata: {
          app: 'test-app',
          rawOutput: 'Deploy output',
          cliExitCode: 0,
          truncated: true,
        },
        error: 'Warning message',
        permalink: 'https://console.sst.dev/123',
        urls: [
          {
            name: 'api',
            url: 'https://api.example.com',
            type: 'function',
          },
        ],
        resources: [
          {
            type: 'function',
            name: 'handler',
            status: 'updated',
            timing: '3s',
          },
        ],
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation('deploy', defaultOptions);

      expect(result.success).toBe(true);
      expect((result as DeployResult).error).toBe('Warning message');
      expect((result as DeployResult).permalink).toBe(
        'https://console.sst.dev/123'
      );
      expect((result as DeployResult).truncated).toBe(true);
      const deployResult = result as DeployResult;
      expect(deployResult.resources?.[0]?.timing).toBe('3s');
    });
  });
});
