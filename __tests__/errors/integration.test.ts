import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandler } from '../../src/errors/error-handler';
import type { OperationOptions } from '../../src/types';
import { ValidationError } from '../../src/utils/validation';

describe('Error Handling Integration', () => {
  const mockError = vi.fn();
  const mockWarning = vi.fn();
  const mockInfo = vi.fn();
  const mockDebug = vi.fn();
  const mockSetFailed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(core, 'error').mockImplementation(mockError);
    vi.spyOn(core, 'warning').mockImplementation(mockWarning);
    vi.spyOn(core, 'info').mockImplementation(mockInfo);
    vi.spyOn(core, 'debug').mockImplementation(mockDebug);
    vi.spyOn(core, 'setFailed').mockImplementation(mockSetFailed);
  });

  describe('end-to-end error flow', () => {
    it('should handle input validation error from start to finish', async () => {
      const validationError = new ValidationError(
        'Invalid stage name provided',
        'stage',
        'prod-env-123',
        ['Use one of: staging, production, development']
      );

      const actionError = ErrorHandler.fromValidationError(validationError);

      expect(actionError.type).toBe('input_validation');
      expect(actionError.shouldFailAction).toBe(true);

      const options: OperationOptions = {
        stage: 'prod-env-123', // Invalid stage that caused the error
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockError).toHaveBeenCalledWith(
        '🔴 prod-env-123 input_validation: Invalid stage name provided'
      );
      expect(mockSetFailed).toHaveBeenCalledWith(
        'input validation in prod-env-123: Invalid stage name provided'
      );
    });

    it('should handle subprocess error from SST CLI failure', async () => {
      const actionError = ErrorHandler.createSubprocessError(
        'SST deploy failed with exit code 1',
        'deploy',
        'production',
        1,
        'Deploying stack...',
        'Error: AWS credentials not configured',
        new Error('Deploy failed')
      );

      expect(actionError.type).toBe('subprocess_error');
      expect(actionError.shouldFailAction).toBe(true);

      const options: OperationOptions = {
        stage: 'production',
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockError).toHaveBeenCalledWith(
        '🔴 production subprocess_error: SST deploy failed with exit code 1'
      );
      expect(mockInfo).toHaveBeenCalledWith('Exit Code: 1');
      expect(mockInfo).toHaveBeenCalledWith(
        'Error Output: Error: AWS credentials not configured'
      );
      expect(mockSetFailed).toHaveBeenCalledWith(
        'subprocess error in production deploy operation: SST deploy failed with exit code 1'
      );
    });

    it('should handle parsing error as warning without failing action', async () => {
      const actionError = ErrorHandler.createOutputParsingError(
        'Failed to parse JSON output from SST CLI',
        'diff',
        'staging',
        '{"invalid": json, "success": true}',
        new Error('JSON parse error')
      );

      expect(actionError.type).toBe('output_parsing');
      expect(actionError.shouldFailAction).toBe(false);

      const options: OperationOptions = {
        stage: 'staging',
        failOnError: true, // Even with fail on error, parsing errors don't fail
      };

      await ErrorHandler.handleError(actionError, options);

      expect(mockWarning).toHaveBeenCalledWith(
        '🟡 staging output_parsing: Failed to parse JSON output from SST CLI'
      );
      expect(mockSetFailed).not.toHaveBeenCalled();
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('Stack Trace:')
      );
    });
  });

  describe('error type classification', () => {
    it('should correctly identify parsing errors', () => {
      const parsingError = ErrorHandler.createOutputParsingError(
        'Parse failed',
        'diff',
        'staging'
      );
      const validationError =
        ErrorHandler.createInputValidationError('Invalid input');
      const subprocessError = ErrorHandler.createSubprocessError(
        'Command failed',
        'deploy',
        'prod',
        1
      );

      expect(ErrorHandler.isParsingError(parsingError)).toBe(true);
      expect(ErrorHandler.isParsingError(validationError)).toBe(false);
      expect(ErrorHandler.isParsingError(subprocessError)).toBe(false);
    });
  });

  describe('error creation methods', () => {
    it('should create appropriate error for each scenario', () => {
      // Input validation scenario
      const validationError = ErrorHandler.createInputValidationError(
        'Invalid stage',
        'stage',
        'bad-stage'
      );
      expect(validationError.type).toBe('input_validation');
      expect(validationError.shouldFailAction).toBe(true);

      // Subprocess failure scenario
      const subprocessError = ErrorHandler.createSubprocessError(
        'SST command failed',
        'deploy',
        'staging',
        127,
        'stdout',
        'stderr'
      );
      expect(subprocessError.type).toBe('subprocess_error');
      expect(subprocessError.shouldFailAction).toBe(true);

      // Output parsing scenario
      const parsingError = ErrorHandler.createOutputParsingError(
        'JSON parse error',
        'diff',
        'production',
        'malformed json'
      );
      expect(parsingError.type).toBe('output_parsing');
      expect(parsingError.shouldFailAction).toBe(false);
    });
  });

  describe('detailed error information', () => {
    it('should preserve context through error handling flow', async () => {
      const actionError = ErrorHandler.createSubprocessError(
        'Deploy failed due to permissions',
        'deploy',
        'production',
        1,
        'Deployment started...',
        'Permission denied for S3 bucket access',
        new Error('Deploy failed')
      );

      expect(actionError.details).toEqual({
        operation: 'deploy',
        stage: 'production',
        exitCode: 1,
        stdout: 'Deployment started...',
        stderr: 'Permission denied for S3 bucket access',
      });

      const options: OperationOptions = {
        stage: 'production',
        failOnError: true,
      };

      await ErrorHandler.handleError(actionError, options);

      // Verify context information was logged
      expect(mockInfo).toHaveBeenCalledWith('Exit Code: 1');
      expect(mockInfo).toHaveBeenCalledWith(
        'Error Output: Permission denied for S3 bucket access'
      );
    });
  });
});
