import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ActionError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from '../../src/errors/categories';
import { ErrorHandler } from '../../src/errors/error-handler';
import type { OperationOptions } from '../../src/types';
import { ValidationError } from '../../src/utils/validation';

const mockIo = io as any;
const mockWriteFile = writeFile as any;
const _mockTmpdir = tmpdir as any;
const _mockJoin = join as any;
const mockCore = core as any;

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('categorizeError', () => {
    it('should categorize validation errors correctly', () => {
      const validationError = new ValidationError(
        'Invalid stage value',
        'stage',
        'invalid-stage',
        ['Use staging, production, or dev']
      );

      const result = ErrorHandler.categorizeError(validationError);

      expect(result).toEqual({
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.HIGH,
        message: 'Invalid stage value',
        originalError: validationError,
        suggestions: ['Use staging, production, or dev'],
        recoverable: false,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
        debugInfo: undefined,
        context: { field: 'stage', value: 'invalid-stage' },
      });
    });

    it('should categorize CLI execution errors', () => {
      const error = new Error('Deploy failed: Authentication error');
      const context = {
        operation: 'deploy' as const,
        stage: 'production',
        exitCode: 1,
        stderr: 'AWS credentials not found',
        duration: 5000,
      };

      const result = ErrorHandler.categorizeError(error, context);

      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.recoverable).toBe(true);
      expect(result.retryable).toBe(false);
      expect(result.debugInfo).toStrictEqual({
        ...context,
        operation: String(context.operation),
      });
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Operation timeout');
      const context = {
        operation: 'deploy' as const,
        stage: 'staging',
        stderr: 'timed out after 30 minutes',
        duration: 1_800_000,
      };

      const result = ErrorHandler.categorizeError(error, context);

      expect(result.category).toBe(ErrorCategory.TIMEOUT);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.retryable).toBe(true);
    });

    it('should categorize GitHub API errors', () => {
      const error = new Error('GitHub API rate limit exceeded');
      const context = {
        operation: 'diff' as const,
        stage: 'staging',
        stderr: 'API rate limit exceeded',
      };

      const result = ErrorHandler.categorizeError(error, context);

      expect(result.category).toBe(ErrorCategory.GITHUB_API);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.retryable).toBe(true);
    });

    it('should handle unknown errors with default categorization', () => {
      const error = new Error('Unknown system error');

      const result = ErrorHandler.categorizeError(error);

      expect(result).toEqual({
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        message: 'Unknown system error',
        originalError: error,
        suggestions: [
          'Review the full error message and stack trace for more details',
          'Check GitHub Actions logs for additional context',
          'Ensure all inputs and configuration are correct',
          'Contact support if the issue persists with error details',
        ],
        recoverable: true,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
        debugInfo: undefined,
      });
    });

    it('should use combined stderr and message for pattern matching', () => {
      const error = new Error('Deploy failed');
      const context = {
        operation: 'deploy' as const,
        stage: 'production',
        stderr: 'insufficient permissions to access s3 bucket',
      };

      const result = ErrorHandler.categorizeError(error, context);

      expect(result.category).toBe(ErrorCategory.PERMISSIONS);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('handleError', () => {
    const mockOptions: OperationOptions = {
      stage: 'staging',
      token: 'mock-token',
      failOnError: true,
      commentMode: 'always',
    };

    const mockError: ActionError = {
      category: ErrorCategory.CLI_EXECUTION,
      severity: ErrorSeverity.HIGH,
      message: 'Deploy command failed',
      originalError: new Error('Deploy failed'),
      suggestions: ['Check AWS credentials', 'Verify permissions'],
      recoverable: false,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      debugInfo: {
        operation: 'deploy',
        stage: 'staging',
        exitCode: 1,
        stderr: 'Permission denied',
        duration: 10_000,
      },
    };

    it('should handle non-recoverable errors with fail-on-error true', async () => {
      await ErrorHandler.handleError(mockError, mockOptions);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining(
          'cli execution error in staging deploy operation: Deploy command failed'
        )
      );
      expect(mockCore.error).toHaveBeenCalled();
      expect(mockCore.info).toHaveBeenCalledWith('🔄 Recoverable: No');
    });

    it('should handle recoverable errors with fail-on-error false', async () => {
      const recoverableError: ActionError = {
        ...mockError,
        recoverable: true,
        severity: ErrorSeverity.MEDIUM,
      };

      const optionsWithoutFail: OperationOptions = {
        ...mockOptions,
        failOnError: false,
      };

      await ErrorHandler.handleError(recoverableError, optionsWithoutFail);

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Recoverable cli_execution error: Deploy command failed'
      );
    });

    it('should create error artifacts and job summary', async () => {
      await ErrorHandler.handleError(mockError, mockOptions);

      expect(mockIo.mkdirP).toHaveBeenCalledWith('/tmp/sst-error-artifacts');

      // Check that error summary file was created
      const errorSummaryCalls = mockWriteFile.mock.calls.filter(
        ([path]: any[]) =>
          path.includes('error-summary-') && path.endsWith('.json')
      );
      expect(errorSummaryCalls).toHaveLength(1);
      expect(errorSummaryCalls[0][1]).toContain('"category": "cli_execution"');
      expect(mockCore.summary.addRaw).toHaveBeenCalled();
      expect(mockCore.summary.write).toHaveBeenCalled();
    });

    it('should handle artifact creation failures gracefully', async () => {
      mockIo.mkdirP.mockRejectedValueOnce(new Error('Permission denied'));

      await ErrorHandler.handleError(mockError, mockOptions);

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create error artifacts')
      );
    });

    it('should handle job summary creation failures gracefully', async () => {
      mockCore.summary.write.mockRejectedValueOnce(new Error('Network error'));

      await ErrorHandler.handleError(mockError, mockOptions);

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create job summary')
      );
    });
  });

  describe('createCLIError', () => {
    it('should create ActionError from CLI execution failure', () => {
      const result = ErrorHandler.createCLIError(
        'Deploy failed with exit code 1',
        1,
        'Deploy output',
        'Error: Permission denied',
        'deploy',
        'production',
        15_000
      );

      expect(result.message).toBe('Deploy failed with exit code 1');
      expect(result.debugInfo).toEqual({
        operation: 'deploy',
        stage: 'production',
        exitCode: 1,
        stdout: 'Deploy output',
        stderr: 'Error: Permission denied',
        duration: 15_000,
      });
    });
  });

  describe('createParsingError', () => {
    it('should create ActionError from parsing failure', () => {
      const result = ErrorHandler.createParsingError(
        'Invalid JSON in output',
        'diff',
        'staging',
        '{"invalid": json}'
      );

      expect(result.message).toBe(
        'Failed to parse diff output: Invalid JSON in output'
      );
      expect(result.debugInfo).toEqual({
        operation: 'diff',
        stage: 'staging',
        stdout: '{"invalid": json}',
      });
      expect(result.category).toBe(ErrorCategory.OUTPUT_PARSING);
    });
  });

  describe('createGitHubError', () => {
    it('should create ActionError from GitHub API failure', () => {
      const result = ErrorHandler.createGitHubError(
        'Rate limit exceeded',
        'deploy',
        'production'
      );

      expect(result.message).toBe('GitHub API error: Rate limit exceeded');
      expect(result.debugInfo).toEqual({
        operation: 'deploy',
        stage: 'production',
      });
      expect(result.category).toBe(ErrorCategory.GITHUB_API);
    });
  });

  describe('utility methods', () => {
    it('should identify partial success scenarios', () => {
      const parsingError: ActionError = {
        category: ErrorCategory.OUTPUT_PARSING,
        severity: ErrorSeverity.LOW,
        message: 'Failed to parse some output',
        originalError: new Error(),
        suggestions: [],
        recoverable: true,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.RETRY,
      };

      const recoverableError: ActionError = {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: 'Operation timeout',
        originalError: new Error(),
        suggestions: [],
        recoverable: true,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.RETRY,
      };

      const criticalError: ActionError = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.CRITICAL,
        message: 'Critical validation error',
        originalError: new Error(),
        suggestions: [],
        recoverable: true,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
      };

      expect(ErrorHandler.isPartialSuccess(parsingError)).toBe(true);
      expect(ErrorHandler.isPartialSuccess(recoverableError)).toBe(true);
      expect(ErrorHandler.isPartialSuccess(criticalError)).toBe(false);
    });

    it('should return appropriate exit codes', () => {
      const criticalError: ActionError = {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        message: 'Critical error',
        originalError: new Error(),
        suggestions: [],
        recoverable: false,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.NOT_RECOVERABLE,
      };

      const highError: ActionError = {
        ...criticalError,
        severity: ErrorSeverity.HIGH,
      };

      const recoverableError: ActionError = {
        ...criticalError,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
      };

      const nonRecoverableError: ActionError = {
        ...criticalError,
        severity: ErrorSeverity.LOW,
        recoverable: false,
      };

      expect(ErrorHandler.getExitCode(criticalError)).toBe(2);
      expect(ErrorHandler.getExitCode(highError)).toBe(1);
      expect(ErrorHandler.getExitCode(recoverableError)).toBe(0);
      expect(ErrorHandler.getExitCode(nonRecoverableError)).toBe(1);
    });
  });

  describe('error logging', () => {
    const mockError: ActionError = {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      message: 'Authentication failed',
      originalError: new Error('Auth error'),
      suggestions: ['Check credentials', 'Verify permissions'],
      recoverable: true,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
      debugInfo: {
        operation: 'deploy',
        stage: 'production',
        exitCode: 1,
        duration: 5000,
      },
    };

    it('should log structured error information', async () => {
      const options: OperationOptions = {
        stage: 'production',
        token: 'mock-token',
        failOnError: false,
      };

      await ErrorHandler.handleError(mockError, options);

      expect(mockCore.error).toHaveBeenCalledWith(
        '🔴 production authentication error: Authentication failed'
      );
      expect(mockCore.info).toHaveBeenCalledWith('🔄 Recoverable: Yes');
      expect(mockCore.info).toHaveBeenCalledWith('⏱️  Retryable: No');
      expect(mockCore.info).toHaveBeenCalledWith(
        '🔧 Recovery Strategy: configuration update'
      );
      expect(mockCore.info).toHaveBeenCalledWith('💡 Suggested solutions:');
      expect(mockCore.info).toHaveBeenCalledWith('   1. Check credentials');
      expect(mockCore.info).toHaveBeenCalledWith('   2. Verify permissions');
      expect(mockCore.info).toHaveBeenCalledWith(
        '📋 Operation: deploy (stage: production)'
      );
      expect(mockCore.info).toHaveBeenCalledWith('🚪 Exit Code: 1');
      expect(mockCore.info).toHaveBeenCalledWith('⏰ Duration: 5000ms');
    });

    it('should handle missing debug info gracefully', async () => {
      const minimalError: ActionError = {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.LOW,
        message: 'System error',
        originalError: new Error(),
        suggestions: [],
        recoverable: true,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      };

      const options: OperationOptions = {
        stage: 'staging',
        failOnError: false,
      };

      await ErrorHandler.handleError(minimalError, options);

      expect(mockCore.error).toHaveBeenCalledWith(
        '🟡 staging system error: System error'
      );
      expect(mockCore.info).toHaveBeenCalledWith('🔄 Recoverable: Yes');
    });
  });

  describe('artifact creation', () => {
    it('should create comprehensive error artifacts', async () => {
      const mockError: ActionError = {
        category: ErrorCategory.CLI_EXECUTION,
        severity: ErrorSeverity.HIGH,
        message: 'CLI execution failed',
        originalError: new Error('Exec error'),
        suggestions: ['Retry operation'],
        recoverable: true,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.RETRY,
        debugInfo: {
          operation: 'deploy',
          stage: 'staging',
          exitCode: 1,
          stdout: 'Deploy output',
          stderr: 'Error output',
          duration: 10_000,
        },
      };

      const options: OperationOptions = {
        stage: 'staging',
        token: 'mock-token',
        commentMode: 'always',
        failOnError: true,
      };

      await ErrorHandler.handleError(mockError, options);

      // Verify artifact directory creation
      expect(mockIo.mkdirP).toHaveBeenCalledWith('/tmp/sst-error-artifacts');

      // Verify error summary file
      const errorSummaryCalls = mockWriteFile.mock.calls.filter(
        ([path]: any[]) =>
          path.includes('error-summary-') && path.endsWith('.json')
      );
      expect(errorSummaryCalls).toHaveLength(1);
      expect(errorSummaryCalls[0][1]).toContain('"category": "cli_execution"');

      // Verify stdout file
      const stdoutCalls = mockWriteFile.mock.calls.filter(
        ([path]: any[]) => path.includes('stdout-') && path.endsWith('.txt')
      );
      expect(stdoutCalls).toHaveLength(1);
      expect(stdoutCalls[0][1]).toBe('Deploy output');

      // Verify stderr file
      const stderrCalls = mockWriteFile.mock.calls.filter(
        ([path]: any[]) => path.includes('stderr-') && path.endsWith('.txt')
      );
      expect(stderrCalls).toHaveLength(1);
      expect(stderrCalls[0][1]).toBe('Error output');

      // Verify environment context file
      const envCalls = mockWriteFile.mock.calls.filter(
        ([path]: any[]) =>
          path.includes('environment-') && path.endsWith('.json')
      );
      expect(envCalls).toHaveLength(1);
      expect(envCalls[0][1]).toContain('"nodeVersion":');
    });
  });

  describe('job summary creation', () => {
    it('should create comprehensive GitHub Actions job summary', async () => {
      const mockError: ActionError = {
        category: ErrorCategory.PERMISSIONS,
        severity: ErrorSeverity.HIGH,
        message: 'Permission denied',
        originalError: new Error('Permission error'),
        suggestions: ['Check IAM roles', 'Verify resource permissions'],
        recoverable: true,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
        debugInfo: {
          operation: 'remove',
          stage: 'production',
          exitCode: 1,
          stderr: 'Access denied to S3 bucket',
          duration: 3000,
        },
      };

      const options: OperationOptions = {
        stage: 'production',
        token: 'mock-token',
        failOnError: true,
      };

      await ErrorHandler.handleError(mockError, options);

      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('# 🔴 SST Operation Failed')
      );
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('| **Operation** | remove |')
      );
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('| **Stage** | `production` |')
      );
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('1. Check IAM roles')
      );
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('Access denied to S3 bucket')
      );
      expect(mockCore.summary.write).toHaveBeenCalled();
    });

    it('should handle different recovery strategies in summary', async () => {
      const retryError: ActionError = {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: 'Operation timeout',
        originalError: new Error(),
        suggestions: [],
        recoverable: true,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.RETRY,
        debugInfo: { operation: 'deploy', stage: 'staging' },
      };

      const options: OperationOptions = {
        stage: 'staging',
        failOnError: false,
      };

      await ErrorHandler.handleError(retryError, options);

      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining(
          '🔄 **Retry the operation** - This error is typically temporary and may resolve on retry.'
        )
      );
    });
  });
});
