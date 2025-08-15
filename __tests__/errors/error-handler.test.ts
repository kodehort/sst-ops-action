import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInputValidationError,
  createOutputParsingError,
  createSubprocessError,
  fromValidationError,
  handleError,
  isParsingError,
} from '../../src/errors/error-handler';
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
      const error = createInputValidationError(
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
      const error = createInputValidationError(
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
      const error = createSubprocessError(
        'Deploy failed with exit code 1',
        'deploy',
        'production',
        1,
        'Deploy output',
        'Error: Permission denied'
      );

      expect(error.type).toBe('subprocess_error');
      expect(error.message).toBe('Deploy failed with exit code 1');
      expect(error.shouldFailAction).toBe(true);
      expect(error.details?.operation).toBe('deploy');
      expect(error.details?.stage).toBe('production');
      expect(error.details?.exitCode).toBe(1);
      expect(error.details?.stdout).toBe('Deploy output');
      expect(error.details?.stderr).toBe('Error: Permission denied');
      expect(error.details?.metadata).toBeDefined();
      expect(error.details?.metadata?.timestamp).toBeDefined();
    });

    it('should create subprocess error with original error', () => {
      const originalError = new Error('Subprocess failed');
      const error = createSubprocessError(
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
      const error = createOutputParsingError(
        'Invalid JSON in output',
        'diff',
        'staging',
        '{"invalid": json}'
      );

      expect(error.type).toBe('output_parsing');
      expect(error.message).toBe('Invalid JSON in output');
      expect(error.shouldFailAction).toBe(false);
      expect(error.details?.operation).toBe('diff');
      expect(error.details?.stage).toBe('staging');
      expect(error.details?.stdout).toBe('{"invalid": json}');
      expect(error.details?.metadata).toBeDefined();
      expect(error.details?.metadata?.timestamp).toBeDefined();
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

      const actionError = fromValidationError(validationError);

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

    it('should fail action for validation errors', () => {
      const error = createInputValidationError(
        'Invalid input',
        'stage',
        'bad-stage'
      );

      handleError(error, mockOptions);

      expect(mockError).toHaveBeenCalledWith(
        '🔴 staging input_validation: Invalid input'
      );
      expect(mockInfo).toHaveBeenCalledWith('Invalid Field: stage = bad-stage');
      expect(mockSetFailed).toHaveBeenCalledWith(
        'input validation in staging: Invalid input'
      );
    });

    it('should fail action for subprocess errors', () => {
      const error = createSubprocessError(
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

      handleError(error, options);

      expect(mockError).toHaveBeenCalledWith(
        '🔴 production subprocess_error: Deploy failed'
      );
      expect(mockInfo).toHaveBeenCalledWith('Exit Code: 1');
      expect(mockInfo).toHaveBeenCalledWith('Error Output: Error output');
      expect(mockSetFailed).toHaveBeenCalledWith(
        'subprocess error in production deploy operation: Deploy failed'
      );
    });

    it('should log warning for parsing errors but not fail action', () => {
      const error = createOutputParsingError(
        'Parse error',
        'diff',
        'staging',
        'bad json'
      );

      handleError(error, mockOptions);

      expect(mockWarning).toHaveBeenCalledWith(
        '🟡 staging output_parsing: Parse error'
      );
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('should log stack trace in debug mode', () => {
      const originalError = new Error('Original error');
      originalError.stack = 'Stack trace here';

      const error = createSubprocessError(
        'Command failed',
        'deploy',
        'staging',
        1,
        undefined,
        undefined,
        originalError
      );

      handleError(error, mockOptions);

      expect(mockDebug).toHaveBeenCalledWith('Stack Trace: Stack trace here');
    });
  });

  describe('isParsingError', () => {
    it('should identify parsing errors', () => {
      const parsingError = createOutputParsingError(
        'Parse failed',
        'diff',
        'staging'
      );
      const validationError = createInputValidationError('Invalid input');

      expect(isParsingError(parsingError)).toBe(true);
      expect(isParsingError(validationError)).toBe(false);
    });
  });
});
