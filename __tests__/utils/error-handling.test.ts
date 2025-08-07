import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categorizeError,
  createErrorSummary,
  ErrorCategory,
  ErrorSeverity,
  handleOperationalError,
  handleValidationError,
  isRecoverableError,
  isTemporaryError,
  withErrorHandling,
  withValidationHandling,
} from '../../src/utils/error-handling.js';
import { ValidationError } from '../../src/utils/validation.js';

// Mock @actions/core
vi.mock('@actions/core');

describe('Error Handling', () => {
  const mockedCore = vi.mocked(core);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockedCore.error.mockImplementation(() => {});
    mockedCore.info.mockImplementation(() => {});
    mockedCore.debug.mockImplementation(() => {});
    mockedCore.setFailed.mockImplementation(() => {});

    const mockSummary = {
      addRaw: vi.fn().mockReturnThis(),
      write: vi.fn().mockResolvedValue(undefined),
    };
    mockedCore.summary = mockSummary as any;
  });

  describe('categorizeError', () => {
    it('should categorize validation errors', () => {
      const error = new ValidationError(
        'Invalid operation',
        'operation',
        'invalid',
        ['Use deploy, diff, or remove']
      );

      const errorInfo = categorizeError(error);

      expect(errorInfo.category).toBe(ErrorCategory.VALIDATION);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.message).toBe('Invalid operation');
      expect(errorInfo.suggestions).toEqual(['Use deploy, diff, or remove']);
      expect(errorInfo.recoverable).toBe(false);
      expect(errorInfo.retryable).toBe(false);
    });

    it('should categorize authentication errors', () => {
      const testCases = [
        'Authentication failed',
        'Unauthorized access',
        'HTTP 401 error',
      ];

      testCases.forEach((message) => {
        const error = new Error(message);
        const errorInfo = categorizeError(error);

        expect(errorInfo.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(errorInfo.severity).toBe(ErrorSeverity.CRITICAL);
        expect(
          errorInfo.suggestions.some((s) => s.includes('GitHub token'))
        ).toBe(true);
        expect(errorInfo.recoverable).toBe(false);
        expect(errorInfo.retryable).toBe(false);
      });
    });

    it('should categorize permission errors', () => {
      const testCases = [
        'Permission denied',
        'Forbidden resource',
        'HTTP 403 error',
      ];

      testCases.forEach((message) => {
        const error = new Error(message);
        const errorInfo = categorizeError(error);

        expect(errorInfo.category).toBe(ErrorCategory.PERMISSION);
        expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
        expect(
          errorInfo.suggestions.some((s) => s.includes('permissions'))
        ).toBe(true);
        expect(errorInfo.recoverable).toBe(false);
      });
    });

    it('should categorize network errors', () => {
      const testCases = ['Network error', 'ENOTFOUND hostname', 'ECONNREFUSED'];

      testCases.forEach((message) => {
        const error = new Error(message);
        const errorInfo = categorizeError(error);

        expect(errorInfo.category).toBe(ErrorCategory.NETWORK);
        expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
        expect(
          errorInfo.suggestions.some((s) => s.includes('connectivity'))
        ).toBe(true);
        expect(errorInfo.recoverable).toBe(true);
        expect(errorInfo.retryable).toBe(true);
      });
    });

    it('should categorize parsing errors', () => {
      const testCases = ['Parse error', 'Invalid JSON', 'YAML syntax error'];

      testCases.forEach((message) => {
        const error = new Error(message);
        const errorInfo = categorizeError(error);

        expect(errorInfo.category).toBe(ErrorCategory.PARSING);
        expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
        expect(
          errorInfo.suggestions.some((s) => s.includes('output format'))
        ).toBe(true);
        expect(errorInfo.recoverable).toBe(false);
        expect(errorInfo.retryable).toBe(false);
      });
    });

    it('should categorize system errors', () => {
      const testCases = [
        'ENOENT: file not found',
        'Command not found: sst',
        'No such file or directory',
      ];

      testCases.forEach((message) => {
        const error = new Error(message);
        const errorInfo = categorizeError(error);

        expect(errorInfo.category).toBe(ErrorCategory.SYSTEM);
        expect(errorInfo.severity).toBe(ErrorSeverity.CRITICAL);
        expect(errorInfo.suggestions.some((s) => s.includes('installed'))).toBe(
          true
        );
        expect(errorInfo.recoverable).toBe(false);
      });
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Something unexpected happened');
      const errorInfo = categorizeError(error);

      expect(errorInfo.category).toBe(ErrorCategory.UNKNOWN);
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorInfo.suggestions.length).toBeGreaterThan(0);
      expect(errorInfo.recoverable).toBe(true);
      expect(errorInfo.retryable).toBe(false);
    });

    it('should include context in error info', () => {
      const error = new Error('Test error');
      const context = { operation: 'deploy', stage: 'test' };

      const errorInfo = categorizeError(error, context);

      expect(errorInfo.context).toEqual(context);
    });
  });

  describe('handleValidationError', () => {
    it('should log validation error details', () => {
      const error = new ValidationError(
        'Invalid operation',
        'operation',
        'invalid-op',
        ['Use deploy, diff, or remove', 'Check spelling']
      );

      handleValidationError(error);

      expect(mockedCore.error).toHaveBeenCalledWith(
        "❌ Input validation failed for 'operation'"
      );
      expect(mockedCore.error).toHaveBeenCalledWith('   Value: "invalid-op"');
      expect(mockedCore.error).toHaveBeenCalledWith(
        '   Error: Invalid operation'
      );
      expect(mockedCore.info).toHaveBeenCalledWith(
        '💡 Suggestions to fix this error:'
      );
      expect(mockedCore.info).toHaveBeenCalledWith(
        '   1. Use deploy, diff, or remove'
      );
      expect(mockedCore.info).toHaveBeenCalledWith('   2. Check spelling');
      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        "Input validation failed for 'operation': Invalid operation"
      );
    });
  });

  describe('handleOperationalError', () => {
    it('should log operational error with suggestions', () => {
      const error = new Error('Network timeout');

      handleOperationalError(error, 'deploy', { stage: 'test' });

      expect(mockedCore.error).toHaveBeenCalledWith(
        '❌ deploy operation failed [timeout:medium]'
      );
      expect(mockedCore.error).toHaveBeenCalledWith('   Network timeout');
      expect(mockedCore.info).toHaveBeenCalledWith(
        '💡 Suggestions to resolve this timeout error:'
      );
      expect(mockedCore.info).toHaveBeenCalledWith(
        '🔄 This error may be recoverable - consider retrying the operation'
      );
      expect(mockedCore.info).toHaveBeenCalledWith(
        '⏱️  This error appears to be temporary and may resolve on retry'
      );
      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'deploy operation failed: Network timeout'
      );
    });

    it('should log context when provided', () => {
      const error = new Error('Test error');
      const context = { stage: 'test', verbose: true };

      handleOperationalError(error, 'deploy', context);

      expect(mockedCore.debug).toHaveBeenCalledWith(
        `Context: ${JSON.stringify({ ...context, operation: 'deploy' }, null, 2)}`
      );
    });
  });

  describe('createErrorSummary', () => {
    it('should create comprehensive error summary', () => {
      const error = new Error('Network timeout');
      const context = { stage: 'test', attempts: 1 };

      createErrorSummary(error, 'deploy', context);

      const summaryCall = vi.mocked(mockedCore.summary.addRaw).mock
        .calls[0]?.[0];

      expect(summaryCall).toContain('❌ SST Deploy Failed');
      expect(summaryCall).toContain('🟠 Severity | MEDIUM');
      expect(summaryCall).toContain('🏷️ Category | timeout');
      expect(summaryCall).toContain('🔄 Recoverable | Yes');
      expect(summaryCall).toContain('⏱️ Retryable | Yes');
      expect(summaryCall).toContain('🚫 Error Message');
      expect(summaryCall).toContain('Network timeout');
      expect(summaryCall).toContain('💡 Suggested Solutions');
      expect(summaryCall).toContain('📋 Additional Context');
      expect(summaryCall).toContain('🔧 Next Steps');
      expect(summaryCall).toContain('- **Retry**: This error may be temporary');

      expect(mockedCore.summary.write).toHaveBeenCalled();
    });

    it('should create different summary for non-retryable errors', () => {
      const error = new Error('Command not found: sst');

      createErrorSummary(error, 'deploy');

      const summaryCall = vi.mocked(mockedCore.summary.addRaw).mock
        .calls[0]?.[0];

      expect(summaryCall).toContain('🚨 Severity | CRITICAL');
      expect(summaryCall).toContain('🏷️ Category | system');
      expect(summaryCall).toContain('🔄 Recoverable | No');
      expect(summaryCall).toContain('⏱️ Retryable | No');
      expect(summaryCall).toContain(
        '- **Investigation Required**: This error requires manual investigation'
      );
    });

    it('should handle different operation types in title', () => {
      const operations: Array<'deploy' | 'diff' | 'remove'> = [
        'deploy',
        'diff',
        'remove',
      ];

      operations.forEach((operation) => {
        createErrorSummary(new Error('Test'), operation);

        const summaryCall = vi.mocked(mockedCore.summary.addRaw).mock
          .calls[0]?.[0];
        const expectedTitle = `❌ SST ${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`;
        expect(summaryCall).toContain(expectedTitle);

        vi.clearAllMocks();
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should execute operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withErrorHandling(operation, 'deploy');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle errors and re-throw', async () => {
      const error = new Error('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(withErrorHandling(operation, 'deploy')).rejects.toThrow(
        'Operation failed'
      );

      expect(mockedCore.error).toHaveBeenCalledWith(
        '❌ deploy operation failed [unknown:medium]'
      );
      expect(mockedCore.setFailed).toHaveBeenCalled();
    });

    it('should include context in error handling', async () => {
      const error = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(error);
      const context = { stage: 'test' };

      await expect(
        withErrorHandling(operation, 'deploy', context)
      ).rejects.toThrow();

      expect(mockedCore.debug).toHaveBeenCalledWith(
        expect.stringContaining('"stage": "test"')
      );
    });
  });

  describe('withValidationHandling', () => {
    it('should execute operation successfully', () => {
      const operation = vi.fn().mockReturnValue('success');

      const result = withValidationHandling(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle validation errors', () => {
      const error = new ValidationError('Invalid input', 'field', 'value');
      const operation = vi.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => withValidationHandling(operation)).toThrow(ValidationError);
      expect(mockedCore.error).toHaveBeenCalledWith(
        "❌ Input validation failed for 'field'"
      );
    });

    it('should re-throw non-validation errors', () => {
      const error = new Error('Other error');
      const operation = vi.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => withValidationHandling(operation)).toThrow('Other error');
    });
  });

  describe('isTemporaryError', () => {
    it('should identify temporary errors', () => {
      const temporaryErrors = [
        new Error('Network timeout'),
        new Error('ETIMEDOUT'),
        new Error('ECONNRESET'),
        new Error('Network error'),
      ];

      temporaryErrors.forEach((error) => {
        expect(isTemporaryError(error)).toBe(true);
      });
    });

    it('should identify non-temporary errors', () => {
      const nonTemporaryErrors = [
        new Error('Command not found'),
        new Error('Permission denied'),
        new ValidationError('Invalid input', 'field', 'value'),
      ];

      nonTemporaryErrors.forEach((error) => {
        expect(isTemporaryError(error)).toBe(false);
      });
    });
  });

  describe('isRecoverableError', () => {
    it('should identify recoverable errors', () => {
      const recoverableErrors = [
        new Error('Network timeout'),
        new Error('Parse error'),
        new Error('Unknown error'),
      ];

      recoverableErrors.forEach((error) => {
        expect(isRecoverableError(error)).toBe(true);
      });
    });

    it('should identify non-recoverable errors', () => {
      const nonRecoverableErrors = [
        new Error('Command not found'),
        new Error('Authentication failed'),
        new ValidationError('Invalid input', 'field', 'value'),
      ];

      nonRecoverableErrors.forEach((error) => {
        expect(isRecoverableError(error)).toBe(false);
      });
    });
  });

  describe('Error Categorization Edge Cases', () => {
    it('should handle error messages with mixed case', () => {
      const error = new Error('AUTHENTICATION Failed');
      const errorInfo = categorizeError(error);

      expect(errorInfo.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should handle empty error messages', () => {
      const error = new Error('');
      const errorInfo = categorizeError(error);

      expect(errorInfo.category).toBe(ErrorCategory.UNKNOWN);
      expect(errorInfo.suggestions.length).toBeGreaterThan(0);
    });

    it('should include original error reference', () => {
      const originalError = new Error('Original error');
      const errorInfo = categorizeError(originalError);

      expect(errorInfo.originalError).toBe(originalError);
    });

    it('should generate appropriate severity levels', () => {
      const severityTests = [
        {
          message: 'Authentication failed',
          expectedSeverity: ErrorSeverity.CRITICAL,
        },
        {
          message: 'Command not found',
          expectedSeverity: ErrorSeverity.CRITICAL,
        },
        { message: 'Permission denied', expectedSeverity: ErrorSeverity.HIGH },
        { message: 'Network timeout', expectedSeverity: ErrorSeverity.MEDIUM },
        { message: 'Parse error', expectedSeverity: ErrorSeverity.MEDIUM },
        { message: 'Unknown error', expectedSeverity: ErrorSeverity.MEDIUM },
      ];

      severityTests.forEach(({ message, expectedSeverity }) => {
        const error = new Error(message);
        const errorInfo = categorizeError(error);
        expect(errorInfo.severity).toBe(expectedSeverity);
      });
    });
  });
});
