/**
 * Test suite for DeployOperation
 * Tests deploy operation execution with SST CLI integration and GitHub integration
 * Covers all deployment scenarios: success, partial, failure
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/github/client';
import { DeployOperation } from '../../src/operations/deploy';
import { DeployParser } from '../../src/parsers/deploy-parser';
import type { DeployResult, OperationOptions } from '../../src/types';
import type { SSTCLIExecutor, SSTCommandResult } from '../../src/utils/cli';
import {
  SST_DEPLOY_FAILURE_OUTPUT,
  SST_DEPLOY_PARTIAL_OUTPUT,
} from '../fixtures/sst-outputs';

describe('Deploy Operation - SST Deployment Workflows', () => {
  let deployOperation: DeployOperation;
  let mockSSTExecutor: SSTCLIExecutor;
  let mockGitHubClient: GitHubClient;

  const mockOperationOptions: OperationOptions = {
    stage: 'staging',
    token: 'ghp_test_token',
    commentMode: 'on-success',
    failOnError: true,
    maxOutputSize: 50_000,
  };

  const mockCLIResult: SSTCommandResult = {
    output: 'SST Deploy\nApp: test-app\nStage: staging\n\n✓ Complete\n',
    exitCode: 0,
    duration: 45_000,
    command: 'sst deploy --stage staging',
    truncated: false,
    stdout: 'SST Deploy\nApp: test-app\nStage: staging\n\n✓ Complete\n',
    stderr: '',
    success: true,
    stage: 'staging',
    operation: 'deploy',
  };

  const mockDeployResult: DeployResult = {
    success: true,
    operation: 'deploy',
    stage: 'staging',
    app: 'test-app',
    rawOutput: mockCLIResult.output,
    exitCode: 0,
    truncated: false,
    completionStatus: 'complete',
    resourceChanges: 3,
    urls: [
      { name: 'API', url: 'https://api.staging.example.com', type: 'api' },
      { name: 'Web', url: 'https://staging.example.com', type: 'web' },
    ],
    resources: [
      { type: 'Function', name: 'test-app-staging-handler', status: 'created' },
      { type: 'Api', name: 'test-app-staging-api', status: 'created' },
      { type: 'Website', name: 'test-app-staging-web', status: 'created' },
    ],
  };

  beforeEach(() => {
    // Create mock executor
    mockSSTExecutor = {
      executeSST: vi.fn(),
    } as unknown as SSTCLIExecutor;

    // Create mock GitHub client
    mockGitHubClient = {
      createOrUpdateComment: vi.fn(),
      createWorkflowSummary: vi.fn(),
      uploadArtifact: vi.fn(),
    } as unknown as GitHubClient;

    // Create operation instance with mocks
    deployOperation = new DeployOperation(mockSSTExecutor, mockGitHubClient);
  });

  describe('Operation Execution', () => {
    it('should deploy application successfully and integrate with GitHub', async () => {
      // Mock the parser
      const mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(mockDeployResult);

      // Mock CLI execution
      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);

      // Mock GitHub integration
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Act
      const result = await deployOperation.execute(mockOperationOptions);

      // Assert
      expect(result).toEqual(mockDeployResult);

      // Verify CLI execution
      expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith(
        'deploy',
        'staging',
        {
          timeout: 900_000,
          maxOutputSize: 50_000,
          runner: undefined,
        }
      );

      // Verify parsing
      expect(mockParse).toHaveBeenCalledWith(
        mockCLIResult.output,
        'staging',
        0,
        50_000
      );

      // Verify GitHub integration
      expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
        mockDeployResult,
        'on-success'
      );
      expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(
        mockDeployResult
      );
    });

    it('should propagate SST CLI execution failures', async () => {
      const cliError = new Error('SST command failed');

      vi.mocked(mockSSTExecutor.executeSST).mockRejectedValue(cliError);

      await expect(
        deployOperation.execute(mockOperationOptions)
      ).rejects.toThrow('SST command failed');
    });

    it('should continue deployment when GitHub integration fails', async () => {
      const _mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(mockDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockRejectedValue(
        new Error('GitHub API error')
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Should still return result despite GitHub integration failure
      const result = await deployOperation.execute(mockOperationOptions);
      expect(result).toEqual(mockDeployResult);
    });

    it('should report partial deployment when some resources fail', async () => {
      const partialCLIResult: SSTCommandResult = {
        output: SST_DEPLOY_PARTIAL_OUTPUT,
        exitCode: 0,
        duration: 120_000,
        command: 'sst deploy --stage staging',
        truncated: false,
        stdout: SST_DEPLOY_PARTIAL_OUTPUT,
        stderr: '',
        success: true,
        stage: 'staging',
        operation: 'deploy',
      };

      const partialDeployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'my-sst-app',
        rawOutput: SST_DEPLOY_PARTIAL_OUTPUT,
        exitCode: 0,
        truncated: false,
        completionStatus: 'partial',
        resourceChanges: 2,
        urls: [
          {
            name: 'Router',
            url: 'https://api.staging.example.com',
            type: 'api',
          },
        ],
        resources: [
          {
            type: 'Function',
            name: 'my-sst-app-staging-handler',
            status: 'created',
          },
          { type: 'Api', name: 'my-sst-app-staging-api', status: 'updated' },
        ],
        permalink:
          'https://console.sst.dev/my-sst-app/staging/deployments/def456',
      };

      // Mock parser to return partial result
      const _mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(partialDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(partialCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      const result = await deployOperation.execute(mockOperationOptions);

      expect(result).toEqual(partialDeployResult);
      expect(result.completionStatus).toBe('partial');
      expect(result.resourceChanges).toBe(2);
    });

    it('should report failed deployment with error details', async () => {
      const failureCLIResult: SSTCommandResult = {
        output: SST_DEPLOY_FAILURE_OUTPUT,
        exitCode: 1,
        duration: 30_000,
        command: 'sst deploy --stage staging',
        truncated: false,
        stdout: SST_DEPLOY_FAILURE_OUTPUT,
        stderr: 'Deployment failed due to permission errors',
        success: false,
        stage: 'staging',
        operation: 'deploy',
      };

      const failureDeployResult: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        app: 'my-sst-app',
        rawOutput: SST_DEPLOY_FAILURE_OUTPUT,
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        resourceChanges: 1,
        urls: [],
        resources: [
          {
            type: 'Function',
            name: 'my-sst-app-staging-handler',
            status: 'created',
          },
        ],
        permalink:
          'https://console.sst.dev/my-sst-app/staging/deployments/ghi789',
        error: 'Deployment failed due to permission errors',
      };

      // Mock parser to return failure result
      const _mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(failureDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(failureCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      const result = await deployOperation.execute(mockOperationOptions);

      expect(result).toEqual(failureDeployResult);
      expect(result.success).toBe(false);
      expect(result.completionStatus).toBe('failed');
      expect(result.error).toBe('Deployment failed due to permission errors');
    });

    it('should respect user-configured comment mode settings', async () => {
      const _mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(mockDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Test with 'always' comment mode
      const alwaysOptions = {
        ...mockOperationOptions,
        commentMode: 'always' as const,
      };
      await deployOperation.execute(alwaysOptions);

      expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
        mockDeployResult,
        'always'
      );
    });

    it('should truncate large CLI outputs while preserving key information', async () => {
      const largeCLIResult: SSTCommandResult = {
        ...mockCLIResult,
        truncated: true,
        output: `${mockCLIResult.output}... output truncated`,
      };

      const truncatedDeployResult: DeployResult = {
        ...mockDeployResult,
        truncated: true,
        rawOutput: largeCLIResult.output,
      };

      const _mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(truncatedDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(largeCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      const result = await deployOperation.execute(mockOperationOptions);

      expect(result.truncated).toBe(true);
      expect(result.rawOutput).toContain('output truncated');
    });
  });

  describe('Migration Compatibility', () => {
    it('should maintain same interface as composite action for seamless migration', async () => {
      // Verify that the operation interface matches what composite actions expect
      expect(deployOperation).toHaveProperty('execute');

      // Verify execute method signature
      expect(typeof deployOperation.execute).toBe('function');
      expect(deployOperation.execute.length).toBe(1); // Takes one parameter (options)

      // Mock successful execution
      const _mockParse = vi
        .spyOn(DeployParser.prototype, 'parse')
        .mockReturnValue(mockDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Execute with minimal options (as composite actions might)
      const minimalOptions: OperationOptions = {
        stage: 'staging',
      };

      const result = await deployOperation.execute(minimalOptions);

      // Verify result structure matches expected format for migration compatibility
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('operation', 'deploy');
      expect(result).toHaveProperty('stage', 'staging');
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('resourceChanges');
      expect(result).toHaveProperty('urls');
      expect(result).toHaveProperty('resources');
      expect(result).toHaveProperty('completionStatus');
    });
  });
});
