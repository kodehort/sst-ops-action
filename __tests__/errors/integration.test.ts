import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActionError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from '../../src/errors/categories';
import { ErrorHandler } from '../../src/errors/error-handler';
import type { OperationOptions } from '../../src/types';
import { ValidationError } from '../../src/utils/validation';

const mockCore = core as any;

describe('Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('end-to-end error flow', () => {
    it('should handle authentication error from CLI to GitHub summary', async () => {
      const error = new Error('AWS credentials not configured');
      const context = {
        operation: 'deploy' as const,
        stage: 'production',
        exitCode: 1,
        stderr:
          'The AWS Access Key Id you provided does not exist in our records',
        duration: 3000,
      };

      const actionError = ErrorHandler.categorizeError(error, context);

      expect(actionError.category).toBe('authentication');
      expect(actionError.severity).toBe('high');
      expect(actionError.recoverable).toBe(true);
      expect(actionError.retryable).toBe(false);
      expect(actionError.recoveryStrategy).toBe(
        'configuration_update'
      );

      const options: OperationOptions = {
        stage: 'production',
        token: 'mock-token',
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      // Verify error was logged
      expect(mockCore.error).toHaveBeenCalledWith(
        '🔴 production authentication error: AWS credentials not configured'
      );

      // Verify suggestions were logged
      expect(mockCore.info).toHaveBeenCalledWith('💡 Suggested solutions:');

      // Verify job was failed
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining(
          'authentication error in production deploy operation'
        )
      );

      // Verify job summary was created
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('# 🔴 SST Operation Failed')
      );
    });

    it('should handle timeout error with retry logic', async () => {
      const error = new Error('Operation timed out after 30 minutes');
      const context = {
        operation: 'remove' as const,
        stage: 'staging',
        exitCode: 124,
        stderr: 'command timed out',
        duration: 1_800_000,
      };

      const actionError = ErrorHandler.categorizeError(error, context);

      expect(actionError.category).toBe('timeout');
      expect(actionError.retryable).toBe(true);
      expect(actionError.recoveryStrategy).toBe('retry');

      const options: OperationOptions = {
        stage: 'staging',
        token: 'mock-token',
        failOnError: false, // Don't fail on timeout
      };

      await ErrorHandler.handleError(actionError, options);

      // Should log as warning, not fail the job
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Recoverable timeout error: Operation timed out after 30 minutes'
      );
      expect(mockCore.setFailed).not.toHaveBeenCalled();

      // Verify retry strategy in summary
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('🔄 **Retry the operation**')
      );
    });

    it('should handle parsing error as partial success', async () => {
      const error = new Error('Failed to parse JSON output');
      const context = {
        operation: 'diff' as const,
        stage: 'staging',
        exitCode: 0, // Command succeeded but output was malformed
        stdout: '{"invalid": json, "success": true}',
        stderr: '',
        duration: 2000,
      };

      const actionError = ErrorHandler.categorizeError(error, context);

      expect(actionError.category).toBe('output_parsing');
      expect(actionError.severity).toBe('low');
      expect(actionError.recoverable).toBe(true);

      expect(ErrorHandler.isPartialSuccess(actionError)).toBe(true);

      const options: OperationOptions = {
        stage: 'staging',
        failOnError: true, // Even with fail on error, parsing errors might not fail
      };

      await ErrorHandler.handleError(actionError, options);

      // Low severity parsing error might not fail the job even with failOnError=true
      // This depends on the specific implementation logic
    });

    it('should handle validation error with immediate failure', async () => {
      const validationError = new ValidationError(
        'Invalid stage name provided',
        'stage',
        'prod-env-123',
        ['Use one of: staging, production, development']
      );

      const actionError = ErrorHandler.categorizeError(validationError);

      expect(actionError.category).toBe('validation');
      expect(actionError.severity).toBe('high');
      expect(actionError.recoverable).toBe(false);
      expect(actionError.retryable).toBe(false);

      const options: OperationOptions = {
        stage: 'prod-env-123', // Invalid stage that caused the error
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('validation error')
      );

      // Verify specific validation context
      expect(actionError.context).toEqual({
        field: 'stage',
        value: 'prod-env-123',
      });
    });

    it('should handle GitHub API rate limit with retry strategy', async () => {
      const error = new Error('GitHub API rate limit exceeded');
      const context = {
        operation: 'deploy' as const,
        stage: 'production',
        stderr: 'API rate limit exceeded. Please wait and try again later.',
      };

      const actionError = ErrorHandler.categorizeError(error, context);

      expect(actionError.category).toBe('github_api');
      expect(actionError.retryable).toBe(true);
      expect(actionError.recoveryStrategy).toBe('retry');

      const options: OperationOptions = {
        stage: 'production',
        token: 'mock-token',
        failOnError: false, // Rate limits shouldn't fail builds
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('github_api error')
      );

      // Verify rate limit specific suggestions
      const suggestions = actionError.suggestions;
      expect(suggestions.some((s) => s.includes('rate limit'))).toBe(true);
    });

    it('should handle permission error with manual intervention', async () => {
      const error = new Error('Insufficient permissions for S3 operations');
      const context = {
        operation: 'remove' as const,
        stage: 'production',
        exitCode: 1,
        stderr: 'Access Denied: User does not have s3:DeleteBucket permission',
        duration: 1000,
      };

      const actionError = ErrorHandler.categorizeError(error, context);

      expect(actionError.category).toBe('permissions');
      expect(actionError.severity).toBe('high');
      expect(actionError.recoverable).toBe(true);
      expect(actionError.retryable).toBe(false); // Need to fix permissions first
      expect(actionError.recoveryStrategy).toBe(
        'configuration_update'
      );

      const options: OperationOptions = {
        stage: 'production',
        token: 'mock-token',
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockCore.setFailed).toHaveBeenCalled();

      // Verify IAM-related suggestions
      const suggestions = actionError.suggestions;
      expect(suggestions.some((s) => s.toLowerCase().includes('iam'))).toBe(
        true
      );
    });
  });

  describe('error categorization accuracy', () => {
    const testCases = [
      {
        message: 'Command not found: sst',
        expected: 'cli_execution',
      },
      {
        message: 'Connection timeout to AWS services',
        expected: 'timeout',
      },
      {
        message: 'Network error: Connection refused',
        expected: 'network',
      },
      {
        message: 'Resource MyStack-Function-abc123 already exists',
        expected: 'resource_conflict',
      },
      {
        message: 'Failed to parse deployment output: Invalid JSON',
        expected: 'output_parsing',
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should categorize "${message}" as ${expected}`, () => {
        const error = new Error(message);
        const result = ErrorHandler.categorizeError(error);
        expect(result.category).toBe(expected);
      });
    });
  });

  describe('error severity impact', () => {
    it('should handle critical errors with immediate failure regardless of failOnError', async () => {
      const error = new Error('System corruption detected');
      const actionError: ActionError = {
        category: 'system' as const,
        severity: 'critical' as const,
        message: error.message,
        originalError: error,
        suggestions: ['Contact system administrator immediately'],
        recoverable: false,
        retryable: false,
        recoveryStrategy: 'not_recoverable' as const,
      };

      const options: OperationOptions = {
        stage: 'production',
        failOnError: false, // Even with false, critical errors should fail
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockCore.setFailed).toHaveBeenCalled();
      expect(ErrorHandler.getExitCode(actionError)).toBe(2);
    });

    it('should handle low severity errors gracefully', async () => {
      const error = new Error('Minor parsing issue in non-critical output');
      const actionError: ActionError = {
        category: 'output_parsing' as const,
        severity: 'low' as const,
        message: error.message,
        originalError: error,
        suggestions: ['Review output format', 'Update parsing logic'],
        recoverable: true,
        retryable: false,
        recoveryStrategy: 'manual_intervention' as const,
      };

      const options: OperationOptions = {
        stage: 'staging',
        failOnError: false,
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('output_parsing error')
      );
    });
  });

  describe('recovery strategy effectiveness', () => {
    it('should provide appropriate recovery strategies for different error types', () => {
      const scenarios = [
        {
          error: new Error('AWS credentials not found'),
          context: { stderr: 'aws credentials not configured' },
          expectedStrategy: 'configuration_update',
        },
        {
          error: new Error('Request timeout'),
          context: { stderr: 'operation timed out' },
          expectedStrategy: 'retry',
        },
        {
          error: new Error('System memory exhausted'),
          context: { stderr: 'out of memory' },
          expectedStrategy: 'not_recoverable',
        },
        {
          error: new Error('Deployment partially completed'),
          context: { stderr: 'some resources failed to deploy' },
          expectedStrategy: 'manual_intervention',
        },
      ];

      scenarios.forEach(({ error, context, expectedStrategy }) => {
        const result = ErrorHandler.categorizeError(error, context);
        expect(result.recoveryStrategy).toBe(expectedStrategy);
      });
    });
  });

  describe('error context preservation', () => {
    it('should preserve all context information through the error handling flow', async () => {
      const originalContext = {
        operation: 'deploy' as const,
        stage: 'production',
        exitCode: 1,
        stdout: 'Deployment started...',
        stderr: 'Permission denied for S3 bucket access',
        duration: 15_000,
      };

      const error = new Error('Deploy failed due to permissions');
      const actionError = ErrorHandler.categorizeError(error, originalContext);

      expect(actionError.debugInfo).toEqual(originalContext);

      const options: OperationOptions = {
        stage: 'production',
        token: 'mock-token',
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      // Verify context information was logged
      expect(mockCore.info).toHaveBeenCalledWith(
        '📋 Operation: deploy (stage: production)'
      );
      expect(mockCore.info).toHaveBeenCalledWith('🚪 Exit Code: 1');
      expect(mockCore.info).toHaveBeenCalledWith('⏰ Duration: 15000ms');
    });
  });

  describe('helper method integration', () => {
    it('should create CLI errors with proper categorization', () => {
      const cliError = ErrorHandler.createCLIError(
        'SST deploy failed',
        1,
        'Deploying stack...',
        'Error: Invalid credentials',
        'deploy',
        'staging',
        5000
      );

      expect(cliError.category).toBe('authentication');
      expect(cliError.message).toBe('SST deploy failed');
      expect(cliError.debugInfo?.exitCode).toBe(1);
      expect(cliError.debugInfo?.operation).toBe('deploy');
    });

    it('should create parsing errors with correct category', () => {
      const parsingError = ErrorHandler.createParsingError(
        'Malformed JSON',
        'diff',
        'production',
        '{"incomplete": '
      );

      expect(parsingError.category).toBe('output_parsing');
      expect(parsingError.message).toBe(
        'Failed to parse diff output: Malformed JSON'
      );
      expect(parsingError.severity).toBe('low');
    });

    it('should create GitHub errors with API category', () => {
      const githubError = ErrorHandler.createGitHubError(
        'Token expired',
        'remove',
        'staging'
      );

      expect(githubError.category).toBe('github_api');
      expect(githubError.message).toBe('GitHub API error: Token expired');
      expect(githubError.retryable).toBe(true);
    });
  });
});
