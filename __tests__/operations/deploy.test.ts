/**
 * Test suite for DeployOperation
 * Tests deploy operation execution with SST CLI integration and GitHub integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeployOperation } from '../../src/operations/deploy';
import { DeployParser } from '../../src/parsers/deploy-parser';
import { GitHubClient } from '../../src/github/client';  
import { SSTCLIExecutor } from '../../src/utils/cli';
import type { OperationOptions, DeployResult } from '../../src/types';
import type { SSTCommandResult } from '../../src/utils/cli';

describe('DeployOperation', () => {
  let deployOperation: DeployOperation;
  let mockSSTExecutor: SSTCLIExecutor;
  let mockGitHubClient: GitHubClient;

  const mockOperationOptions: OperationOptions = {
    stage: 'staging',
    token: 'ghp_test_token',
    commentMode: 'on-success',
    failOnError: true,
    maxOutputSize: 50000,
  };

  const mockCLIResult: SSTCommandResult = {
    output: 'SST Deploy\nApp: test-app\nStage: staging\n\n✓ Complete\n',
    exitCode: 0,
    duration: 45000,
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

  describe('execute', () => {
    it('should execute successful deployment with complete workflow', async () => {
      // Mock the parser
      const mockParse = vi.spyOn(DeployParser.prototype, 'parse').mockReturnValue(mockDeployResult);
      
      // Mock CLI execution
      (mockSSTExecutor.executeSST as any).mockResolvedValue(mockCLIResult);
      
      // Mock GitHub integration
      (mockGitHubClient.createOrUpdateComment as any).mockResolvedValue(undefined);
      (mockGitHubClient.createWorkflowSummary as any).mockResolvedValue(undefined);

      // Act
      const result = await deployOperation.execute(mockOperationOptions);

      // Assert
      expect(result).toEqual(mockDeployResult);
      
      // Verify CLI execution
      expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith('deploy', 'staging', {
        env: expect.objectContaining({
          SST_TOKEN: 'ghp_test_token',
          NODE_ENV: 'production',
          CI: 'true',
          GITHUB_ACTIONS: 'true',
        }),
        timeout: 900000,
        maxOutputSize: 50000,
      });

      // Verify parsing
      expect(mockParse).toHaveBeenCalledWith(
        mockCLIResult.output,
        'staging',
        0,
        50000
      );

      // Verify GitHub integration
      expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
        mockDeployResult,
        'on-success'
      );
      expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(mockDeployResult);
    });

    it('should handle CLI execution failure', async () => {
      const cliError = new Error('SST command failed');
      
      (mockSSTExecutor.executeSST as any).mockRejectedValue(cliError);

      await expect(deployOperation.execute(mockOperationOptions)).rejects.toThrow(
        'SST command failed'
      );
    });

    it('should handle GitHub integration failures gracefully', async () => {
      const mockParse = vi.spyOn(DeployParser.prototype, 'parse').mockReturnValue(mockDeployResult);
      
      (mockSSTExecutor.executeSST as any).mockResolvedValue(mockCLIResult);
      (mockGitHubClient.createOrUpdateComment as any).mockRejectedValue(new Error('GitHub API error'));
      (mockGitHubClient.createWorkflowSummary as any).mockResolvedValue(undefined);

      // Should still return result despite GitHub integration failure
      const result = await deployOperation.execute(mockOperationOptions);
      expect(result).toEqual(mockDeployResult);
    });
  });

  describe('buildEnvironment', () => {
    it('should build correct environment variables', () => {
      const env = deployOperation.buildEnvironment(mockOperationOptions);

      expect(env).toEqual({
        SST_TOKEN: 'ghp_test_token',
        NODE_ENV: 'production',
        CI: 'true',
        GITHUB_ACTIONS: 'true',
      });
    });

    it('should handle missing token gracefully', () => {
      const optionsWithoutToken: OperationOptions = {
        ...mockOperationOptions,
        token: '',
      };

      const env = deployOperation.buildEnvironment(optionsWithoutToken);

      expect(env.SST_TOKEN).toBe('');
      expect(env.NODE_ENV).toBe('production');
    });
  });
});