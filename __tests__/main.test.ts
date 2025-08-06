import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandler } from '../src/errors/error-handler';
import { run } from '../src/main';
import { executeOperation } from '../src/operations/router';
import { OutputFormatter } from '../src/outputs/formatter';
import { ValidationError } from '../src/utils/validation';

// Mock all dependencies
vi.mock('../src/operations/router');
vi.mock('../src/outputs/formatter');
vi.mock('../src/errors/error-handler');

const mockExecuteOperation = vi.mocked(executeOperation);
const mockOutputFormatter = vi.mocked(OutputFormatter);
const mockErrorHandler = vi.mocked(ErrorHandler);
const mockCore = vi.mocked(core);

describe('Main Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockCore.getInput.mockImplementation((name) => {
      const inputs: Record<string, string> = {
        operation: 'deploy',
        stage: 'staging',
        token: 'fake-token',
        'comment-mode': 'on-success',
        'max-output-size': '50000',
      };
      return inputs[name] || '';
    });

    mockCore.getBooleanInput.mockImplementation((name) => {
      if (name === 'fail-on-error') {
        return true;
      }
      return false;
    });

    mockOutputFormatter.formatForGitHubActions.mockReturnValue({
      success: 'true',
      operation: 'deploy',
      stage: 'staging',
      completion_status: 'complete',
      app: 'test-app',
      permalink: '',
      truncated: 'false',
      error: '',
      resource_changes: '3',
      urls: '[]',
      resources: '[]',
      diff_summary: '',
      planned_changes: '',
      resources_removed: '',
      removed_resources: '',
    });

    mockOutputFormatter.validateOutputs.mockImplementation(() => {});
  });

  describe('successful operations', () => {
    it('should handle successful deploy operation', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'complete',
        resourceChanges: 3,
        urls: [{ name: 'API', url: 'https://api.example.com', type: 'api' }],
        resources: [
          { type: 'Function', name: 'MyFunction', status: 'created' },
        ],
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockCore.info).toHaveBeenCalledWith(
        '🚀 Starting SST Operations Action'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '📝 Parsed inputs: deploy operation on stage "staging"'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '🔧 Executing deploy operation...'
      );
      expect(mockExecuteOperation).toHaveBeenCalledWith(
        'deploy',
        expect.objectContaining({
          operation: 'deploy',
          stage: 'staging',
          token: 'fake-token',
          commentMode: 'on-success',
          failOnError: true,
          maxOutputSize: 50_000,
        })
      );
      expect(mockOutputFormatter.formatForGitHubActions).toHaveBeenCalledWith(
        mockResult
      );
      expect(mockCore.setOutput).toHaveBeenCalledTimes(15); // All outputs
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ SST deploy operation completed successfully'
      );
    });

    it('should handle successful diff operation', async () => {
      mockCore.getInput.mockImplementation((name) => {
        if (name === 'operation') {
          return 'diff';
        }
        if (name === 'stage') {
          return 'production';
        }
        if (name === 'token') {
          return 'ghp_test123';
        }
        if (name === 'comment-mode') {
          return 'always';
        }
        return '';
      });

      const mockResult = {
        success: true,
        operation: 'diff',
        stage: 'production',
        app: 'test-app',
        completionStatus: 'complete',
        plannedChanges: 5,
        changeSummary: 'Found 5 planned changes',
        changes: [],
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockExecuteOperation).toHaveBeenCalledWith(
        'diff',
        expect.objectContaining({
          operation: 'diff',
          stage: 'production',
          token: 'ghp_test123',
          commentMode: 'always',
        })
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '📋 Found 5 planned change(s)'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ SST diff operation completed successfully'
      );
    });

    it('should handle successful remove operation', async () => {
      mockCore.getInput.mockImplementation((name) => {
        if (name === 'operation') {
          return 'remove';
        }
        if (name === 'stage') {
          return 'staging';
        }
        if (name === 'token') {
          return 'fake-token';
        }
        return '';
      });

      const mockResult = {
        success: true,
        operation: 'remove',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'complete',
        resourcesRemoved: 7,
        removedResources: [
          { type: 'Function', name: 'OldFunction', status: 'removed' },
        ],
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockExecuteOperation).toHaveBeenCalledWith(
        'remove',
        expect.objectContaining({
          operation: 'remove',
          stage: 'staging',
        })
      );
      expect(mockCore.info).toHaveBeenCalledWith('🗑️ Removed 7 resource(s)');
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ SST remove operation completed successfully'
      );
    });
  });

  describe('failed operations', () => {
    it('should handle operation failure with failOnError=true', async () => {
      const mockResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'failed',
        error: 'Authentication failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'SST deploy operation failed: Authentication failed'
      );
      expect(mockCore.info).not.toHaveBeenCalledWith(
        expect.stringMatching(/completed successfully/)
      );
    });

    it('should handle operation failure with failOnError=false', async () => {
      mockCore.getBooleanInput.mockImplementation((name) => {
        if (name === 'fail-on-error') {
          return false;
        }
        return false;
      });

      const mockResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'failed',
        error: 'Network timeout',
        resourceChanges: 0,
        urls: [],
        resources: [],
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'SST deploy operation failed: Network timeout'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '🔄 Continuing workflow as fail-on-error is disabled'
      );
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('should handle input validation errors', async () => {
      mockCore.getInput.mockImplementation((name) => {
        if (name === 'operation') {
          return 'invalid-operation';
        }
        if (name === 'stage') {
          return 'staging';
        }
        if (name === 'token') {
          return 'fake-token';
        }
        return '';
      });

      const validationError = new ValidationError(
        'Invalid operation: invalid-operation. Must be one of: deploy, diff, remove',
        'operation',
        'invalid-operation',
        ['Valid operations are: deploy, diff, remove']
      );

      mockErrorHandler.categorizeError.mockReturnValue({
        category: 'validation',
        severity: 'high',
        message: validationError.message,
        originalError: validationError,
        suggestions: validationError.suggestions,
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'configuration_update',
      });

      await run();

      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed')
      );
      expect(mockErrorHandler.categorizeError).toHaveBeenCalled();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should validate required inputs', async () => {
      mockCore.getInput.mockImplementation((name) => {
        if (name === 'stage') {
          return '';
        }
        if (name === 'token') {
          return 'fake-token';
        }
        return '';
      });

      await run();

      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed')
      );
      expect(mockErrorHandler.categorizeError).toHaveBeenCalled();
    });
  });

  describe('output handling', () => {
    it('should format and validate outputs correctly', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'complete',
        resourceChanges: 2,
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockOutputFormatter.formatForGitHubActions).toHaveBeenCalledWith(
        mockResult
      );
      expect(mockOutputFormatter.validateOutputs).toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('success', 'true');
      expect(mockCore.setOutput).toHaveBeenCalledWith('operation', 'deploy');
      expect(mockCore.setOutput).toHaveBeenCalledWith('stage', 'staging');
    });

    it('should handle output truncation warnings', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'complete',
        resourceChanges: 1,
        truncated: true,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        '⚠️ Output was truncated due to size limits'
      );
    });

    it('should handle output formatting errors', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'complete',
        resourceChanges: 1,
        truncated: false,
      };

      mockExecuteOperation.mockResolvedValueOnce(mockResult);
      mockOutputFormatter.formatForGitHubActions.mockImplementation(() => {
        throw new Error('Output formatting failed');
      });

      const mockActionError = {
        category: 'system',
        severity: 'high',
        message: 'Output formatting failed',
        originalError: new Error('Output formatting failed'),
        suggestions: [],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'manual_intervention',
      };

      mockErrorHandler.categorizeError.mockReturnValue(mockActionError);

      await run();

      expect(mockCore.error).toHaveBeenCalledWith(
        'Failed to set outputs: Output formatting failed'
      );
      expect(mockErrorHandler.categorizeError).toHaveBeenCalled();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should use enhanced error handling for operation failures', async () => {
      const operationError = new Error('SST CLI execution failed');
      mockExecuteOperation.mockRejectedValueOnce(operationError);

      const mockActionError = {
        category: 'cli_execution',
        severity: 'high',
        message: 'SST CLI execution failed',
        originalError: operationError,
        suggestions: ['Check AWS credentials'],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'manual_intervention',
      };

      mockErrorHandler.categorizeError.mockReturnValue(mockActionError);

      await run();

      expect(mockErrorHandler.categorizeError).toHaveBeenCalledWith(
        operationError
      );
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        mockActionError,
        expect.any(Object)
      );
    });

    it('should handle error handler failures gracefully', async () => {
      const operationError = new Error('Operation failed');
      mockExecuteOperation.mockRejectedValueOnce(operationError);

      mockErrorHandler.categorizeError.mockReturnValue({
        category: 'system',
        severity: 'high',
        message: 'Operation failed',
        originalError: operationError,
        suggestions: [],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'manual_intervention',
      });

      mockErrorHandler.handleError.mockRejectedValueOnce(
        new Error('Error handler failed')
      );

      await run();

      expect(mockCore.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling failed')
      );
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Action failed: Operation failed'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle end-to-end deploy workflow', async () => {
      // Simulate full deploy workflow
      mockCore.getInput.mockImplementation((name) => {
        const inputs: Record<string, string> = {
          operation: 'deploy',
          stage: 'production',
          token: 'ghp_real_token_123',
          'comment-mode': 'on-success',
          'max-output-size': '100000',
        };
        return inputs[name] || '';
      });

      const deployResult = {
        success: true,
        operation: 'deploy',
        stage: 'production',
        app: 'my-sst-app',
        completionStatus: 'complete',
        resourceChanges: 15,
        urls: [
          { name: 'API', url: 'https://api.myapp.com', type: 'api' },
          { name: 'Web', url: 'https://myapp.com', type: 'web' },
        ],
        resources: [
          { type: 'Function', name: 'ApiHandler', status: 'created' },
          { type: 'Database', name: 'MainDB', status: 'updated' },
        ],
        permalink:
          'https://console.sst.dev/my-sst-app/production/deployments/abc123',
        truncated: false,
      };

      // Override the formatter mock to return production-specific outputs
      mockOutputFormatter.formatForGitHubActions.mockReturnValue({
        success: 'true',
        operation: 'deploy',
        stage: 'production',
        completion_status: 'complete',
        app: 'my-sst-app',
        permalink:
          'https://console.sst.dev/my-sst-app/production/deployments/abc123',
        truncated: 'false',
        error: '',
        resource_changes: '15',
        urls: JSON.stringify(deployResult.urls),
        resources: JSON.stringify(deployResult.resources),
        diff_summary: '',
        planned_changes: '',
        resources_removed: '',
        removed_resources: '',
      });

      mockExecuteOperation.mockResolvedValueOnce(deployResult);

      await run();

      // Verify the complete workflow
      expect(mockCore.info).toHaveBeenCalledWith(
        '🚀 Starting SST Operations Action'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '📝 Parsed inputs: deploy operation on stage "production"'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '🔧 Executing deploy operation...'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ Operation: deploy (production)'
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        '📊 Status: SUCCESS (complete)'
      );
      expect(mockCore.info).toHaveBeenCalledWith('🚀 Deployed 15 resource(s)');
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ SST deploy operation completed successfully'
      );

      expect(mockExecuteOperation).toHaveBeenCalledWith(
        'deploy',
        expect.objectContaining({
          operation: 'deploy',
          stage: 'production',
          token: 'ghp_real_token_123',
          commentMode: 'on-success',
          failOnError: true,
          maxOutputSize: 100_000,
          environment: process.env,
        })
      );

      expect(mockCore.setOutput).toHaveBeenCalledWith('success', 'true');
      expect(mockCore.setOutput).toHaveBeenCalledWith('operation', 'deploy');
      expect(mockCore.setOutput).toHaveBeenCalledWith('stage', 'production');
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'completion_status',
        'complete'
      );
    });

    it('should handle partial success scenarios', async () => {
      const partialResult = {
        success: true,
        operation: 'remove',
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'partial',
        resourcesRemoved: 5,
        removedResources: [
          { type: 'Function', name: 'Func1', status: 'removed' },
          { type: 'Function', name: 'Func2', status: 'removed' },
          { type: 'Database', name: 'DB1', status: 'failed' },
        ],
        truncated: false,
      };

      mockCore.getInput.mockImplementation((name) => {
        if (name === 'operation') {
          return 'remove';
        }
        if (name === 'stage') {
          return 'staging';
        }
        if (name === 'token') {
          return 'fake-token';
        }
        return '';
      });

      mockExecuteOperation.mockResolvedValueOnce(partialResult);

      await run();

      expect(mockCore.info).toHaveBeenCalledWith(
        '📊 Status: SUCCESS (partial)'
      );
      expect(mockCore.info).toHaveBeenCalledWith('🗑️ Removed 5 resource(s)');
      expect(mockCore.info).toHaveBeenCalledWith(
        '✅ SST remove operation completed successfully'
      );
    });
  });
});
