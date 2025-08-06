import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
} from '../../src/types/index.js';
import {
  createActionSummary,
  getActionInputs,
  handleOperationFailure,
  logOperationComplete,
  logOperationStart,
  logValidationError,
  maskSensitiveValues,
  setActionOutputs,
  validateGitHubActionsEnvironment,
} from '../../src/utils/github-actions.js';
import { ValidationError } from '../../src/utils/validation.js';

// Mock @actions/core
vi.mock('@actions/core');

describe('GitHub Actions Integration', () => {
  const mockedCore = vi.mocked(core);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default core mocks
    mockedCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        operation: 'deploy',
        stage: 'staging',
        token: 'ghp_1234567890abcdef',
        'comment-mode': 'on-success',
        'fail-on-error': 'true',
        'max-output-size': '50000',
      };
      return inputs[name] || '';
    });

    mockedCore.getBooleanInput.mockImplementation((name: string) => {
      if (name === 'fail-on-error') {
        return true;
      }
      return false;
    });

    mockedCore.setOutput.mockImplementation(() => {});
    mockedCore.setFailed.mockImplementation(() => {});
    mockedCore.info.mockImplementation(() => {});
    mockedCore.error.mockImplementation(() => {});
    mockedCore.warning.mockImplementation(() => {});
    mockedCore.debug.mockImplementation(() => {});
    mockedCore.setSecret.mockImplementation(() => {});

    // Mock summary
    const mockSummary = {
      addRaw: vi.fn().mockReturnThis(),
      write: vi.fn().mockResolvedValue(undefined),
    };
    mockedCore.summary = mockSummary as any;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getActionInputs', () => {
    it('should parse and validate GitHub Actions inputs successfully', () => {
      const result = getActionInputs();

      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.token).toBe('ghp_1234567890abcdef');
      expect(result.commentMode).toBe('on-success');
      expect(result.failOnError).toBe(true);
      expect(result.maxOutputSize).toBe(50_000);
    });

    it('should handle missing optional inputs with defaults', () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          stage: 'test',
          token: 'fake-token',
        };
        return inputs[name] || '';
      });

      mockedCore.getBooleanInput.mockReturnValue(false);

      const result = getActionInputs();

      expect(result.operation).toBe('deploy'); // default
      expect(result.commentMode).toBe('on-success'); // default
      expect(result.failOnError).toBe(true); // default
      expect(result.maxOutputSize).toBe(50_000); // default
    });

    it('should handle validation errors and set failure', () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          operation: 'invalid-operation',
          stage: 'test',
          token: 'fake-token',
        };
        return inputs[name] || '';
      });

      expect(() => getActionInputs()).toThrow(ValidationError);
      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining("Input validation failed for 'operation'")
      );
    });

    it('should include suggestions in failure message', () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          operation: 'invalid-operation',
          stage: 'test',
          token: 'fake-token',
        };
        return inputs[name] || '';
      });

      expect(() => getActionInputs()).toThrow();

      const failedCall = mockedCore.setFailed.mock.calls[0][0];
      expect(failedCall).toContain('Suggestions:');
      expect(failedCall).toContain('deploy, diff, remove');
    });
  });

  describe('setActionOutputs', () => {
    it('should set all required outputs for deploy operation', () => {
      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'deploy output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        permalink: 'https://console.sst.dev/test/staging',
        resourceChanges: 3,
        urls: [
          { name: 'api', url: 'https://api.example.com', type: 'api' },
          { name: 'web', url: 'https://web.example.com', type: 'web' },
        ],
        resources: [{ type: 'Function', name: 'handler', status: 'created' }],
      };

      setActionOutputs(deployResult);

      // Check required outputs
      expect(mockedCore.setOutput).toHaveBeenCalledWith('success', 'true');
      expect(mockedCore.setOutput).toHaveBeenCalledWith('operation', 'deploy');
      expect(mockedCore.setOutput).toHaveBeenCalledWith('stage', 'staging');
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'completion_status',
        'complete'
      );
      expect(mockedCore.setOutput).toHaveBeenCalledWith('app', 'test-app');
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'permalink',
        'https://console.sst.dev/test/staging'
      );
      expect(mockedCore.setOutput).toHaveBeenCalledWith('truncated', 'false');
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'resource_changes',
        '3'
      );

      // Check deploy-specific outputs
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'urls',
        JSON.stringify(deployResult.urls)
      );
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'resources',
        JSON.stringify(deployResult.resources)
      );
    });

    it('should set all required outputs for diff operation', () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'diff output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 0,
        plannedChanges: 2,
        changeSummary: '2 resources to be updated',
        changes: [{ type: 'Function', name: 'handler', action: 'update' }],
      };

      setActionOutputs(diffResult);

      // Check diff-specific outputs
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'diff_summary',
        '2 resources to be updated'
      );
      expect(mockedCore.setOutput).toHaveBeenCalledWith('planned_changes', '2');
    });

    it('should set all required outputs for remove operation', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'remove output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 2,
        resourcesRemoved: 2,
        removedResources: [
          { type: 'Function', name: 'handler', status: 'removed' },
        ],
      };

      setActionOutputs(removeResult);

      // Check remove-specific outputs
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'resources_removed',
        '2'
      );
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'removed_resources',
        JSON.stringify(removeResult.removedResources)
      );
    });

    it('should handle missing optional values', () => {
      const minimalResult: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'test',
        rawOutput: 'output',
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        error: 'Deploy failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
      };

      setActionOutputs(minimalResult);

      expect(mockedCore.setOutput).toHaveBeenCalledWith('app', '');
      expect(mockedCore.setOutput).toHaveBeenCalledWith('permalink', '');
      expect(mockedCore.setOutput).toHaveBeenCalledWith(
        'error',
        'Deploy failed'
      );
    });
  });

  describe('logValidationError', () => {
    it('should log validation error with suggestions', () => {
      const error = new ValidationError(
        'Invalid operation',
        'operation',
        'invalid-op',
        ['Use deploy, diff, or remove', 'Check spelling']
      );

      logValidationError(error);

      expect(mockedCore.error).toHaveBeenCalledWith(
        "Input validation failed for field 'operation'"
      );
      expect(mockedCore.error).toHaveBeenCalledWith(
        'Value provided: "invalid-op"'
      );
      expect(mockedCore.error).toHaveBeenCalledWith('Error: Invalid operation');
      expect(mockedCore.info).toHaveBeenCalledWith(
        'Suggestions to fix this error:'
      );
      expect(mockedCore.info).toHaveBeenCalledWith(
        '  • Use deploy, diff, or remove'
      );
      expect(mockedCore.info).toHaveBeenCalledWith('  • Check spelling');
    });
  });

  describe('logOperationStart', () => {
    it('should log operation start with input summary', () => {
      const inputs = {
        operation: 'deploy' as const,
        stage: 'staging',
        token: 'ghp_1234567890abcdef',
        commentMode: 'always' as const,
        failOnError: true,
        maxOutputSize: 75_000,
      };

      logOperationStart(inputs);

      expect(mockedCore.info).toHaveBeenCalledWith(
        '🚀 Starting SST deploy operation'
      );
      expect(mockedCore.info).toHaveBeenCalledWith('📍 Stage: staging');
      expect(mockedCore.info).toHaveBeenCalledWith('💬 Comment mode: always');
      expect(mockedCore.info).toHaveBeenCalledWith('⚠️  Fail on error: true');
      expect(mockedCore.debug).toHaveBeenCalledWith(
        'Max output size: 75000 bytes'
      );
      expect(mockedCore.debug).toHaveBeenCalledWith(
        'Token type: Personal Access Token'
      );
    });

    it('should detect different token types', () => {
      const testCases = [
        { token: 'ghp_1234567890abcdef', expected: 'Personal Access Token' },
        { token: 'github_pat_1234567890abcdef', expected: 'GitHub App Token' },
        { token: 'fake-token', expected: 'Test Token' },
      ];

      testCases.forEach(({ token, expected }) => {
        const inputs = {
          operation: 'deploy' as const,
          stage: 'test',
          token,
          commentMode: 'on-success' as const,
          failOnError: true,
          maxOutputSize: 50_000,
        };

        logOperationStart(inputs);

        expect(mockedCore.debug).toHaveBeenCalledWith(
          `Token type: ${expected}`
        );
        vi.clearAllMocks();
      });
    });
  });

  describe('logOperationComplete', () => {
    it('should log successful operation completion', () => {
      const result: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        rawOutput: 'output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 3,
        urls: [{ name: 'api', url: 'https://api.example.com', type: 'api' }],
        resources: [],
        permalink: 'https://console.sst.dev/test/staging',
      };

      logOperationComplete(result);

      expect(mockedCore.info).toHaveBeenCalledWith('✅ SST deploy complete');
      expect(mockedCore.info).toHaveBeenCalledWith('📊 Resource changes: 3');
      expect(mockedCore.info).toHaveBeenCalledWith('🌐 Deployed URLs: 1');
      expect(mockedCore.info).toHaveBeenCalledWith(
        '🔗 Console: https://console.sst.dev/test/staging'
      );
    });

    it('should log failed operation', () => {
      const result: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        rawOutput: 'output',
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        error: 'Deployment failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
      };

      logOperationComplete(result);

      expect(mockedCore.info).toHaveBeenCalledWith('❌ SST deploy failed');
      expect(mockedCore.error).toHaveBeenCalledWith(
        '❌ Operation failed: Deployment failed'
      );
    });

    it('should warn about truncated output', () => {
      const result: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        rawOutput: 'output',
        exitCode: 0,
        truncated: true,
        completionStatus: 'complete',
        resourceChanges: 1,
        urls: [],
        resources: [],
      };

      logOperationComplete(result);

      expect(mockedCore.warning).toHaveBeenCalledWith(
        '⚠️ Output was truncated due to size limits'
      );
    });
  });

  describe('handleOperationFailure', () => {
    it('should set failed status when failOnError is true', () => {
      const result: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        rawOutput: 'output',
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        error: 'Deployment failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
      };

      handleOperationFailure(result, true);

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'deploy failed: Deployment failed'
      );
    });

    it('should warn when failOnError is false', () => {
      const result: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        rawOutput: 'output',
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        error: 'Deployment failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
      };

      handleOperationFailure(result, false);

      expect(mockedCore.warning).toHaveBeenCalledWith(
        'deploy failed but continuing due to fail-on-error: false'
      );
      expect(mockedCore.warning).toHaveBeenCalledWith(
        'Error: Deployment failed'
      );
      expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('createActionSummary', () => {
    it('should create summary for successful deploy', () => {
      const result: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 2,
        urls: [
          { name: 'api', url: 'https://api.example.com', type: 'api' },
          { name: 'web', url: 'https://web.example.com', type: 'web' },
        ],
        resources: [],
        permalink: 'https://console.sst.dev/test/staging',
      };

      createActionSummary(result);

      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('✅ SST Deploy Operation')
      );
      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('🌐 Deployed URLs')
      );
      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('api.example.com')
      );
      expect(mockedCore.summary.write).toHaveBeenCalled();
    });

    it('should create summary for diff operation', () => {
      const result: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 0,
        plannedChanges: 3,
        changeSummary: '2 to create, 1 to update',
        changes: [],
      };

      createActionSummary(result);

      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('📋 Change Summary')
      );
      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('2 to create, 1 to update')
      );
    });

    it('should create summary for failed operation with error', () => {
      const result: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        rawOutput: 'output',
        exitCode: 1,
        truncated: true,
        completionStatus: 'failed',
        error: 'Network timeout',
        resourceChanges: 0,
        urls: [],
        resources: [],
      };

      createActionSummary(result);

      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error Details')
      );
      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('Network timeout')
      );
      expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ **Note**: Output was truncated')
      );
    });
  });

  describe('maskSensitiveValues', () => {
    it('should mask real tokens', () => {
      const inputs = {
        operation: 'deploy' as const,
        stage: 'test',
        token: 'ghp_1234567890abcdef',
        commentMode: 'on-success' as const,
        failOnError: true,
        maxOutputSize: 50_000,
      };

      maskSensitiveValues(inputs);

      expect(mockedCore.setSecret).toHaveBeenCalledWith('ghp_1234567890abcdef');
    });

    it('should not mask fake tokens', () => {
      const inputs = {
        operation: 'deploy' as const,
        stage: 'test',
        token: 'fake-token',
        commentMode: 'on-success' as const,
        failOnError: true,
        maxOutputSize: 50_000,
      };

      maskSensitiveValues(inputs);

      expect(mockedCore.setSecret).not.toHaveBeenCalled();
    });
  });

  describe('validateGitHubActionsEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should validate required environment variables', () => {
      process.env.GITHUB_REPOSITORY = 'test/repo';
      process.env.GITHUB_SHA = 'abc123';
      process.env.GITHUB_ACTIONS = 'true';

      expect(() => validateGitHubActionsEnvironment()).not.toThrow();
    });

    it('should throw for missing required environment variables', () => {
      process.env.GITHUB_REPOSITORY = undefined;
      process.env.GITHUB_SHA = undefined;

      expect(() => validateGitHubActionsEnvironment()).toThrow(
        'Missing required environment variables: GITHUB_REPOSITORY, GITHUB_SHA'
      );
    });

    it('should warn when not in GitHub Actions', () => {
      process.env.GITHUB_REPOSITORY = 'test/repo';
      process.env.GITHUB_SHA = 'abc123';
      process.env.GITHUB_ACTIONS = undefined;

      validateGitHubActionsEnvironment();

      expect(mockedCore.warning).toHaveBeenCalledWith(
        'Not running in GitHub Actions environment'
      );
    });

    it('should validate Node.js version', () => {
      // Mock process.version for older Node.js
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v18.0.0',
        writable: true,
      });

      process.env.GITHUB_REPOSITORY = 'test/repo';
      process.env.GITHUB_SHA = 'abc123';

      expect(() => validateGitHubActionsEnvironment()).toThrow(
        'Node.js v18.0.0 is not supported. Requires Node.js 20 or higher.'
      );

      // Restore original version
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
      });
    });
  });
});
