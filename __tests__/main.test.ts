import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActionError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from '../src/errors/categories';
import { ErrorHandler } from '../src/errors/error-handler';
import { run } from '../src/main';

// Import modules to spy on - these will be mocked in beforeEach
import * as operationRouter from '../src/operations/router';
import { OutputFormatter } from '../src/outputs/formatter';
import { ValidationError } from '../src/utils/validation';

describe('Main Entry Point', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear all mocks first
    vi.clearAllMocks();

    // Mock process.env to control environment variables in tests
    process.env = {
      NODE_ENV: 'test',
      CI: 'true',
      GITHUB_ACTIONS: 'true',
    };

    // Set up default input values using vi.spyOn to work with cleared mocks
    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        operation: 'deploy',
        stage: 'staging',
        token: 'fake-token',
        'comment-mode': 'on-success',
        'max-output-size': '50000',
      };
      return inputs[name] || '';
    });

    vi.spyOn(core, 'getBooleanInput').mockImplementation((name: string) => {
      if (name === 'fail-on-error') {
        return true;
      }
      return false;
    });

    // Spy on and mock the operation router
    vi.spyOn(operationRouter, 'executeOperation').mockResolvedValue({
      success: true,
      operation: 'deploy' as const,
      stage: 'staging',
      app: 'test-app',
      completionStatus: 'complete',
      resourceChanges: 3,
      urls: [],
      resources: [],
      truncated: false,
      rawOutput: 'Deploy successful',
      exitCode: 0,
    } as any);

    // Spy on and mock the output formatter
    vi.spyOn(OutputFormatter, 'formatForGitHubActions').mockReturnValue({
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

    vi.spyOn(OutputFormatter, 'validateOutputs').mockImplementation(() => {});

    // Spy on and mock the error handler
    vi.spyOn(ErrorHandler, 'categorizeError').mockReturnValue({
      category: 'cli_execution',
      severity: 'high',
      message: 'Test error',
      originalError: new Error('Test error'),
      suggestions: [],
      recoverable: false,
      retryable: false,
      recoveryStrategy: 'manual_intervention' as const,
    } as any);

    vi.spyOn(ErrorHandler, 'handleError').mockResolvedValue();

    // Mock all core functions with spies
    vi.spyOn(core, 'info').mockImplementation(() => {});
    vi.spyOn(core, 'warning').mockImplementation(() => {});
    vi.spyOn(core, 'error').mockImplementation(() => {});
    vi.spyOn(core, 'setOutput').mockImplementation(() => {});
    vi.spyOn(core, 'setFailed').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  describe('successful operations', () => {
    it('should handle successful deploy operation', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Deploy completed successfully',
        exitCode: 0,
        completionStatus: 'complete' as const,
        resourceChanges: 3,
        urls: [
          { name: 'API', url: 'https://api.example.com', type: 'api' as const },
        ],
        resources: [
          { type: 'Function', name: 'MyFunction', status: 'created' as const },
        ],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.info).toHaveBeenCalledWith(
        '🚀 Starting SST Operations Action'
      );
      expect(core.info).toHaveBeenCalledWith(
        '📝 Parsed inputs: deploy operation on stage "staging"'
      );
      expect(core.info).toHaveBeenCalledWith(
        '🔧 Executing deploy operation...'
      );
      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        'deploy',
        expect.objectContaining({
          stage: 'staging',
          token: 'fake-token',
          commentMode: 'on-success',
          failOnError: true,
          maxOutputSize: 50_000,
          environment: expect.objectContaining({
            NODE_ENV: 'test',
            CI: 'true',
            GITHUB_ACTIONS: 'true',
          }),
        })
      );
      expect(OutputFormatter.formatForGitHubActions).toHaveBeenCalledWith(
        mockResult
      );
      expect(core.setOutput).toHaveBeenCalledTimes(15); // All outputs
      expect(core.info).toHaveBeenCalledWith(
        '✅ SST deploy operation completed successfully'
      );
    });

    it('should handle successful diff operation', async () => {
      vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
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
        operation: 'diff' as const,
        stage: 'production',
        app: 'test-app',
        rawOutput: 'Diff analysis completed',
        exitCode: 0,
        completionStatus: 'complete' as const,
        plannedChanges: 5,
        changeSummary: 'Found 5 planned changes',
        changes: [],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        'diff',
        expect.objectContaining({
          stage: 'production',
          token: 'ghp_test123',
          commentMode: 'always',
          environment: expect.objectContaining({
            NODE_ENV: 'test',
            CI: 'true',
            GITHUB_ACTIONS: 'true',
          }),
        })
      );
      expect(core.info).toHaveBeenCalledWith('📋 Found 5 planned change(s)');
      expect(core.info).toHaveBeenCalledWith(
        '✅ SST diff operation completed successfully'
      );
    });

    it('should handle successful remove operation', async () => {
      vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
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
        operation: 'remove' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Resources removed successfully',
        exitCode: 0,
        completionStatus: 'complete' as const,
        resourcesRemoved: 7,
        removedResources: [
          { type: 'Function', name: 'OldFunction', status: 'removed' as const },
        ],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        'remove',
        expect.objectContaining({
          stage: 'staging',
          environment: expect.objectContaining({
            NODE_ENV: 'test',
            CI: 'true',
            GITHUB_ACTIONS: 'true',
          }),
        })
      );
      expect(core.info).toHaveBeenCalledWith('🗑️ Removed 7 resource(s)');
      expect(core.info).toHaveBeenCalledWith(
        '✅ SST remove operation completed successfully'
      );
    });
  });

  describe('failed operations', () => {
    it('should handle operation failure with failOnError=true', async () => {
      const mockResult = {
        success: false,
        operation: 'deploy' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Deploy failed',
        exitCode: 1,
        completionStatus: 'failed' as const,
        error: 'Authentication failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        'SST deploy operation failed: Authentication failed'
      );
      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringMatching(/completed successfully/)
      );
    });

    it('should handle operation failure with failOnError=false', async () => {
      vi.spyOn(core, 'getBooleanInput').mockImplementation((name: string) => {
        if (name === 'fail-on-error') {
          return false;
        }
        return false;
      });

      const mockResult = {
        success: false,
        operation: 'deploy' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Deploy failed due to network timeout',
        exitCode: 1,
        completionStatus: 'failed' as const,
        error: 'Network timeout',
        resourceChanges: 0,
        urls: [],
        resources: [],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.warning).toHaveBeenCalledWith(
        'SST deploy operation failed: Network timeout'
      );
      expect(core.info).toHaveBeenCalledWith(
        '🔄 Continuing workflow as fail-on-error is disabled'
      );
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('should handle input validation errors', async () => {
      vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
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

      vi.spyOn(ErrorHandler, 'categorizeError').mockReturnValue({
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

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed')
      );
      expect(ErrorHandler.categorizeError).toHaveBeenCalled();
      expect(ErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should validate required inputs', async () => {
      vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
        if (name === 'stage') {
          return '';
        }
        if (name === 'token') {
          return 'fake-token';
        }
        return '';
      });

      await run();

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed')
      );
      expect(ErrorHandler.categorizeError).toHaveBeenCalled();
    });
  });

  describe('output handling', () => {
    it('should format and validate outputs correctly', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Deploy completed',
        exitCode: 0,
        completionStatus: 'complete' as const,
        resourceChanges: 2,
        urls: [],
        resources: [],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(OutputFormatter.formatForGitHubActions).toHaveBeenCalledWith(
        mockResult
      );
      expect(OutputFormatter.validateOutputs).toHaveBeenCalled();
      expect(core.setOutput).toHaveBeenCalledWith('success', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('operation', 'deploy');
      expect(core.setOutput).toHaveBeenCalledWith('stage', 'staging');
    });

    it('should handle output truncation warnings', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Deploy completed with large output',
        exitCode: 0,
        completionStatus: 'complete' as const,
        resourceChanges: 1,
        urls: [],
        resources: [],
        truncated: true,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.warning).toHaveBeenCalledWith(
        '⚠️ Output was truncated due to size limits'
      );
    });

    it('should handle output formatting errors', async () => {
      const mockResult = {
        success: true,
        operation: 'deploy' as const,
        stage: 'staging',
        app: 'test-app',
        rawOutput: 'Deploy completed',
        exitCode: 0,
        completionStatus: 'complete' as const,
        resourceChanges: 1,
        urls: [],
        resources: [],
        truncated: false,
      };

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        mockResult
      );
      vi.spyOn(OutputFormatter, 'formatForGitHubActions').mockImplementation(
        () => {
          throw new Error('Output formatting failed');
        }
      );

      const mockActionError: ActionError = {
        category: 'system' as const,
        severity: 'high' as const,
        message: 'Output formatting failed',
        originalError: new Error('Output formatting failed'),
        suggestions: [],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'manual_intervention' as const,
      };

      vi.spyOn(ErrorHandler, 'categorizeError').mockReturnValue(
        mockActionError
      );

      await run();

      expect(core.error).toHaveBeenCalledWith(
        'Failed to set outputs: Output formatting failed'
      );
      expect(ErrorHandler.categorizeError).toHaveBeenCalled();
      expect(ErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should use enhanced error handling for operation failures', async () => {
      const operationError = new Error('SST CLI execution failed');
      vi.spyOn(operationRouter, 'executeOperation').mockRejectedValueOnce(
        operationError
      );

      const mockActionError: ActionError = {
        category: 'cli_execution' as const,
        severity: 'high' as const,
        message: 'SST CLI execution failed',
        originalError: operationError,
        suggestions: ['Check AWS credentials'],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'manual_intervention' as const,
      };

      vi.spyOn(ErrorHandler, 'categorizeError').mockReturnValue(
        mockActionError
      );

      await run();

      expect(ErrorHandler.categorizeError).toHaveBeenCalledWith(operationError);
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        mockActionError,
        expect.any(Object)
      );
    });

    it('should handle error handler failures gracefully', async () => {
      const operationError = new Error('Operation failed');
      vi.spyOn(operationRouter, 'executeOperation').mockRejectedValueOnce(
        operationError
      );

      vi.spyOn(ErrorHandler, 'categorizeError').mockReturnValue({
        category: 'system',
        severity: 'high',
        message: 'Operation failed',
        originalError: operationError,
        suggestions: [],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'manual_intervention',
      });

      vi.spyOn(ErrorHandler, 'handleError').mockRejectedValueOnce(
        new Error('Error handler failed')
      );

      await run();

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling failed')
      );
      expect(core.setFailed).toHaveBeenCalledWith(
        'Action failed: Operation failed'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle end-to-end deploy workflow', async () => {
      // Simulate full deploy workflow
      vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
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
        operation: 'deploy' as const,
        stage: 'production',
        app: 'my-sst-app',
        completionStatus: 'complete' as const,
        resourceChanges: 15,
        urls: [
          { name: 'API', url: 'https://api.myapp.com', type: 'api' as const },
          { name: 'Web', url: 'https://myapp.com', type: 'web' as const },
        ],
        resources: [
          { type: 'Function', name: 'ApiHandler', status: 'created' as const },
          { type: 'Database', name: 'MainDB', status: 'updated' as const },
        ],
        permalink:
          'https://console.sst.dev/my-sst-app/production/deployments/abc123',
        truncated: false,
        rawOutput: 'Deploy completed successfully',
        exitCode: 0,
      };

      // Override the formatter mock to return production-specific outputs
      vi.spyOn(OutputFormatter, 'formatForGitHubActions').mockReturnValue({
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

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        deployResult
      );

      await run();

      // Verify the complete workflow
      expect(core.info).toHaveBeenCalledWith(
        '🚀 Starting SST Operations Action'
      );
      expect(core.info).toHaveBeenCalledWith(
        '📝 Parsed inputs: deploy operation on stage "production"'
      );
      expect(core.info).toHaveBeenCalledWith(
        '🔧 Executing deploy operation...'
      );
      expect(core.info).toHaveBeenCalledWith(
        '✅ Operation: deploy (production)'
      );
      expect(core.info).toHaveBeenCalledWith('📊 Status: SUCCESS (complete)');
      expect(core.info).toHaveBeenCalledWith('🚀 Deployed 15 resource(s)');
      expect(core.info).toHaveBeenCalledWith(
        '✅ SST deploy operation completed successfully'
      );

      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        'deploy',
        expect.objectContaining({
          stage: 'production',
          token: 'ghp_real_token_123',
          commentMode: 'on-success',
          failOnError: true,
          maxOutputSize: 100_000,
          environment: expect.objectContaining({
            NODE_ENV: 'test',
            CI: 'true',
            GITHUB_ACTIONS: 'true',
          }),
        })
      );

      expect(core.setOutput).toHaveBeenCalledWith('success', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('operation', 'deploy');
      expect(core.setOutput).toHaveBeenCalledWith('stage', 'production');
      expect(core.setOutput).toHaveBeenCalledWith(
        'completion_status',
        'complete'
      );
    });

    it('should handle partial success scenarios', async () => {
      const partialResult = {
        success: true,
        operation: 'remove' as const,
        stage: 'staging',
        app: 'test-app',
        completionStatus: 'partial' as const,
        resourcesRemoved: 5,
        removedResources: [
          { type: 'Function', name: 'Func1', status: 'removed' as const },
          { type: 'Function', name: 'Func2', status: 'removed' as const },
          { type: 'Database', name: 'DB1', status: 'failed' as const },
        ],
        truncated: false,
        rawOutput: 'Remove completed with partial success',
        exitCode: 0,
      };

      vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
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

      vi.spyOn(operationRouter, 'executeOperation').mockResolvedValueOnce(
        partialResult
      );

      await run();

      expect(core.info).toHaveBeenCalledWith('📊 Status: SUCCESS (partial)');
      expect(core.info).toHaveBeenCalledWith('🗑️ Removed 5 resource(s)');
      expect(core.info).toHaveBeenCalledWith(
        '✅ SST remove operation completed successfully'
      );
    });
  });
});
