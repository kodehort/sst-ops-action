import { describe, expect, it } from 'vitest';
import type { ActionError, ErrorType } from '../../src/errors/categories';

describe('Error Categories', () => {
  describe('ErrorType', () => {
    it('should support all required error types', () => {
      const inputValidation: ErrorType = 'input_validation';
      const subprocessError: ErrorType = 'subprocess_error';
      const outputParsing: ErrorType = 'output_parsing';

      expect(inputValidation).toBe('input_validation');
      expect(subprocessError).toBe('subprocess_error');
      expect(outputParsing).toBe('output_parsing');
    });
  });

  describe('ActionError interface', () => {
    it('should create valid ActionError for input validation', () => {
      const error: ActionError = {
        type: 'input_validation',
        message: 'Invalid stage value',
        shouldFailAction: true,
        details: {
          field: 'stage',
          value: 'invalid-stage',
        },
      };

      expect(error.type).toBe('input_validation');
      expect(error.shouldFailAction).toBe(true);
      expect(error.details?.field).toBe('stage');
      expect(error.details?.value).toBe('invalid-stage');
    });

    it('should create valid ActionError for subprocess failure', () => {
      const originalError = new Error('Command failed');
      const error: ActionError = {
        type: 'subprocess_error',
        message: 'SST deploy failed',
        shouldFailAction: true,
        originalError,
        details: {
          operation: 'deploy',
          stage: 'production',
          exitCode: 1,
          stdout: 'Deployment output',
          stderr: 'Error: Permission denied',
        },
      };

      expect(error.type).toBe('subprocess_error');
      expect(error.shouldFailAction).toBe(true);
      expect(error.originalError).toBe(originalError);
      expect(error.details?.operation).toBe('deploy');
      expect(error.details?.exitCode).toBe(1);
    });

    it('should create valid ActionError for parsing failure', () => {
      const error: ActionError = {
        type: 'output_parsing',
        message: 'Failed to parse JSON output',
        shouldFailAction: false, // Parsing errors don't fail the action
        details: {
          operation: 'diff',
          stage: 'staging',
          stdout: '{"invalid": json}',
        },
      };

      expect(error.type).toBe('output_parsing');
      expect(error.shouldFailAction).toBe(false);
      expect(error.details?.stdout).toBe('{"invalid": json}');
    });

    it('should support optional fields', () => {
      const minimalError: ActionError = {
        type: 'input_validation',
        message: 'Simple error',
        shouldFailAction: true,
      };

      expect(minimalError.originalError).toBeUndefined();
      expect(minimalError.details).toBeUndefined();
    });
  });
});
