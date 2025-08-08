import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandler } from '../../src/errors/error-handler';
import type { OperationOptions } from '../../src/types';
import { ValidationError } from '../../src/utils/validation';

describe('Error Handler - Error Processing', () => {
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

  describe('createInputValidationError', () => {
    it('should create validation error for input failures', () => {
      const error = ErrorHandler.createInputValidationError(
        'Invalid stage value',
        'stage',
        'invalid-stage'
      );

      expect(error).toEqual({
        type: 'input_validation',
        message: 'Invalid stage value',
        shouldFailAction: true,
        originalError: undefined,
        details: {
          field: 'stage',
          value: 'invalid-stage',
        },
      });
    });

    it('should create validation error without field details', () => {
      const originalError = new Error('Test error');
      const error = ErrorHandler.createInputValidationError(
        'General validation error',
        undefined,
        undefined,
        originalError
      );

      expect(error).toEqual({
        type: 'input_validation',
        message: 'General validation error',
        shouldFailAction: true,
        originalError,
        details: undefined,
      });
    });
  });

  describe('createSubprocessError', () => {
    it('should create subprocess error for SST CLI failures', () => {
      const error = ErrorHandler.createSubprocessError(
        'Deploy failed with exit code 1',
        'deploy',
        'production',
        1,
        'Deploy output',
        'Error: Permission denied'
      );

      expect(error).toEqual({
        type: 'subprocess_error',
        message: 'Deploy failed with exit code 1',
        shouldFailAction: true,
        originalError: undefined,
        details: {
          operation: 'deploy',
          stage: 'production',
          exitCode: 1,
          stdout: 'Deploy output',
          stderr: 'Error: Permission denied',
        },
      });
    });

    it('should create subprocess error with original error', () => {
      const originalError = new Error('Subprocess failed');
      const error = ErrorHandler.createSubprocessError(
        'SST command failed',
        'diff',
        'staging',
        127,
        undefined,
        undefined,
        originalError
      );

      expect(error.type).toBe('subprocess_error');
      expect(error.shouldFailAction).toBe(true);
      expect(error.originalError).toBe(originalError);
      expect(error.details?.exitCode).toBe(127);
    });
  });

  describe('createOutputParsingError', () => {
    it('should create parsing error that does not fail action', () => {
      const error = ErrorHandler.createOutputParsingError(
        'Invalid JSON in output',
        'diff',
        'staging',
        '{"invalid": json}'
      );

      expect(error).toEqual({
        type: 'output_parsing',
        message: 'Invalid JSON in output',
        shouldFailAction: false, // Parsing errors don't fail the action
        originalError: undefined,
        details: {
          operation: 'diff',
          stage: 'staging',
          stdout: '{"invalid": json}',
        },
      });
    });
  });

  describe('fromValidationError', () => {
    it('should create ActionError from ValidationError instance', () => {
      const validationError = new ValidationError(
        'Invalid stage value',
        'stage',
        'invalid-stage',
        ['Use staging, production, or dev']
      );

      const actionError = ErrorHandler.fromValidationError(validationError);

      expect(actionError.type).toBe('input_validation');
      expect(actionError.message).toBe(validationError.message);
      expect(actionError.shouldFailAction).toBe(true);
      expect(actionError.originalError).toBe(validationError);
      expect(actionError.details).toEqual({
        field: 'stage',
        value: 'invalid-stage',
      });
    });
  });

  describe('handleError', () => {
    const mockOptions: OperationOptions = {
      stage: 'staging',
      failOnError: true,
    };

    it('should fail action for validation errors', async () => {
      const error = ErrorHandler.createInputValidationError(
        'Invalid input',
        'stage',
        'bad-stage'
      );

      await ErrorHandler.handleError(error, mockOptions);

      expect(mockError).toHaveBeenCalledWith(
        '🔴 staging input_validation: Invalid input'
      );
      expect(mockInfo).toHaveBeenCalledWith('Invalid Field: stage = bad-stage');
      expect(mockSetFailed).toHaveBeenCalledWith(
        'input validation in staging: Invalid input'
      );
    });

    it('should fail action for subprocess errors', async () => {
      const error = ErrorHandler.createSubprocessError(
        'Deploy failed',
        'deploy',
        'production',
        1,
        'Output',
        'Error output'
      );

      const options: OperationOptions = {
        stage: 'production',
        failOnError: true,
      };

      await ErrorHandler.handleError(error, options);

      expect(mockError).toHaveBeenCalledWith(
        '🔴 production subprocess_error: Deploy failed'
      );
      expect(mockInfo).toHaveBeenCalledWith('Exit Code: 1');
      expect(mockInfo).toHaveBeenCalledWith('Error Output: Error output');
      expect(mockSetFailed).toHaveBeenCalledWith(
        'subprocess error in production deploy operation: Deploy failed'
      );
    });

    it('should log warning for parsing errors but not fail action', async () => {
      const error = ErrorHandler.createOutputParsingError(
        'Parse error',
        'diff',
        'staging',
        'bad json'
      );

      await ErrorHandler.handleError(error, mockOptions);

      expect(mockWarning).toHaveBeenCalledWith(
        '🟡 staging output_parsing: Parse error'
      );
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('should log stack trace in debug mode', async () => {
      const originalError = new Error('Original error');
      originalError.stack = 'Stack trace here';

      const error = ErrorHandler.createSubprocessError(
        'Command failed',
        'deploy',
        'staging',
        1,
        undefined,
        undefined,
        originalError
      );

      await ErrorHandler.handleError(error, mockOptions);

      expect(mockDebug).toHaveBeenCalledWith('Stack Trace: Stack trace here');
    });
  });

  describe('isParsingError', () => {
    it('should identify parsing errors', () => {
      const parsingError = ErrorHandler.createOutputParsingError(
        'Parse failed',
        'diff',
        'staging'
      );
      const validationError =
        ErrorHandler.createInputValidationError('Invalid input');

      expect(ErrorHandler.isParsingError(parsingError)).toBe(true);
      expect(ErrorHandler.isParsingError(validationError)).toBe(false);
    });
  });
});
