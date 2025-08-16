import { describe, expect, it } from 'vitest';
import {
  createValidationContext,
  OperationInputsSchema,
  parseOperationInputs,
  ValidationError,
  validateOperationWithContext,
} from '../../src/utils/validation.js';

describe('Input Validation', () => {
  describe('ValidationError', () => {
    it('should create validation error with all properties', () => {
      const error = new ValidationError(
        'Invalid value',
        'testField',
        'invalidValue',
        ['Suggestion 1', 'Suggestion 2']
      );

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid value');
      expect(error.field).toBe('testField');
      expect(error.value).toBe('invalidValue');
      expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
    });
  });

  describe('createValidationContext', () => {
    it('should create context from environment variables', () => {
      const env = {
        GITHUB_REF: 'refs/heads/main',
        NODE_ENV: 'test',
        CI: 'true',
      };

      const context = createValidationContext(env);

      expect(context.isProduction).toBe(true); // main branch
      expect(context.allowFakeTokens).toBe(true); // NODE_ENV=test
    });

    it('should detect production from tag refs', () => {
      const env = {
        GITHUB_REF: 'refs/tags/v1.0.0',
        CI: 'true',
      };

      const context = createValidationContext(env);
      expect(context.isProduction).toBe(true);
    });

    it('should allow fake tokens in non-CI environment', () => {
      const env = {
        NODE_ENV: 'development',
        // CI not set
      };

      const context = createValidationContext(env);
      expect(context.allowFakeTokens).toBe(true);
    });

    it('should use defaults for missing environment variables', () => {
      const context = createValidationContext({});

      expect(context.isProduction).toBe(false);
      expect(context.allowFakeTokens).toBe(true);
    });
  });

  describe('Operation-Specific Schemas (Discriminated Unions)', () => {
    describe('Deploy Operation', () => {
      it('should validate deploy operation with auto-computed stage', () => {
        const inputs = {
          operation: 'deploy',
          token: 'ghp_test_token',
        };

        const result = OperationInputsSchema.parse(inputs);

        expect(result.operation).toBe('deploy');
        if (result.operation === 'deploy') {
          expect(result.token).toBe('ghp_test_token');
          expect(result.stage).toBe(''); // Optional and auto-computed
          expect(result.commentMode).toBe('on-success'); // Default
          expect(result.failOnError).toBe(true); // Default
        }
      });

      it('should validate deploy operation with explicit stage', () => {
        const inputs = {
          operation: 'deploy',
          token: 'ghp_test_token',
          stage: 'production',
          commentMode: 'always',
          failOnError: false,
          maxOutputSize: 100_000,
          runner: 'npm',
        };

        const result = OperationInputsSchema.parse(inputs);

        expect(result.operation).toBe('deploy');
        if (result.operation === 'deploy') {
          expect(result.token).toBe('ghp_test_token');
          expect(result.stage).toBe('production');
          expect(result.commentMode).toBe('always');
          expect(result.failOnError).toBe(false);
          expect(result.maxOutputSize).toBe(100_000);
          expect(result.runner).toBe('npm');
        }
      });

      it('should reject deploy operation without token', () => {
        const inputs = {
          operation: 'deploy',
        };

        expect(() => OperationInputsSchema.parse(inputs)).toThrow();
      });
    });

    describe('Diff Operation', () => {
      it('should validate diff operation with required stage', () => {
        const inputs = {
          operation: 'diff',
          token: 'ghp_test_token',
          stage: 'staging',
        };

        const result = OperationInputsSchema.parse(inputs);

        expect(result.operation).toBe('diff');
        if (result.operation === 'diff') {
          expect(result.token).toBe('ghp_test_token');
          expect(result.stage).toBe('staging');
        }
      });

      it('should reject diff operation without stage', () => {
        const inputs = {
          operation: 'diff',
          token: 'ghp_test_token',
        };

        expect(() => OperationInputsSchema.parse(inputs)).toThrow();
      });

      it('should reject diff operation with empty stage', () => {
        const inputs = {
          operation: 'diff',
          token: 'ghp_test_token',
          stage: '',
        };

        expect(() => OperationInputsSchema.parse(inputs)).toThrow();
      });
    });

    describe('Remove Operation', () => {
      it('should validate remove operation with required stage', () => {
        const inputs = {
          operation: 'remove',
          token: 'ghp_test_token',
          stage: 'pr-123',
        };

        const result = OperationInputsSchema.parse(inputs);

        expect(result.operation).toBe('remove');
        if (result.operation === 'remove') {
          expect(result.token).toBe('ghp_test_token');
          expect(result.stage).toBe('pr-123');
        }
      });

      it('should reject remove operation without stage', () => {
        const inputs = {
          operation: 'remove',
          token: 'ghp_test_token',
        };

        expect(() => OperationInputsSchema.parse(inputs)).toThrow();
      });

      it('should reject remove operation with empty stage', () => {
        const inputs = {
          operation: 'remove',
          token: 'ghp_test_token',
          stage: '',
        };

        expect(() => OperationInputsSchema.parse(inputs)).toThrow();
      });
    });

    describe('Stage Operation', () => {
      it('should validate stage operation with only stage-specific parameters', () => {
        const inputs = {
          operation: 'stage',
          truncationLength: 20,
          prefix: 'feat-',
        };

        const result = OperationInputsSchema.parse(inputs);

        expect(result.operation).toBe('stage');
        if (result.operation === 'stage') {
          expect(result.truncationLength).toBe(20);
          expect(result.prefix).toBe('feat-');
        }
      });

      it('should validate stage operation with defaults', () => {
        const inputs = {
          operation: 'stage',
        };

        const result = OperationInputsSchema.parse(inputs);

        expect(result.operation).toBe('stage');
        if (result.operation === 'stage') {
          expect(result.truncationLength).toBe(26); // Default
          expect(result.prefix).toBe('pr-'); // Default
        }
      });

      it('should reject stage operation with infrastructure fields', () => {
        const inputs = {
          operation: 'stage',
          token: 'should-not-be-allowed',
        };

        // This should fail because stage operations don't accept token
        expect(() => OperationInputsSchema.parse(inputs)).toThrow();
      });

      it('should validate stage operation prefix constraints', () => {
        const invalidInputs = {
          operation: 'stage',
          prefix: 'UPPER-CASE', // Should be lowercase
        };

        expect(() => OperationInputsSchema.parse(invalidInputs)).toThrow();
      });
    });

    describe('parseOperationInputs', () => {
      it('should parse valid operation inputs successfully', () => {
        const rawInputs = {
          operation: 'deploy',
          token: 'ghp_test_token',
          stage: 'production',
        };

        const result = parseOperationInputs(rawInputs);

        expect(result.operation).toBe('deploy');
        if (result.operation === 'deploy') {
          expect(result.token).toBe('ghp_test_token');
          expect(result.stage).toBe('production');
        }
      });

      it('should provide operation-specific error messages', () => {
        const rawInputs = {
          operation: 'diff',
          token: 'ghp_test_token',
          // Missing required stage for diff operation
        };

        expect(() => parseOperationInputs(rawInputs)).toThrow(ValidationError);

        try {
          parseOperationInputs(rawInputs);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationError = error as ValidationError;
          expect(validationError.suggestions.length).toBeGreaterThan(0);
        }
      });
    });

    describe('validateOperationWithContext', () => {
      it('should validate operation inputs with context', () => {
        const rawInputs = {
          operation: 'deploy',
          token: 'ghp_test_token',
          stage: 'staging',
        };

        const result = validateOperationWithContext(rawInputs);
        expect(result.operation).toBe('deploy');
        if (result.operation === 'deploy') {
          expect(result.stage).toBe('staging');
        }
      });

      it('should reject production remove without confirmation', () => {
        const rawInputs = {
          operation: 'remove',
          token: 'ghp_test_token',
          stage: 'production',
        };

        const context = { isProduction: true };

        expect(() => validateOperationWithContext(rawInputs, context)).toThrow(
          ValidationError
        );
      });

      it('should reject fake tokens in production for deploy', () => {
        const rawInputs = {
          operation: 'deploy',
          token: 'fake-token',
          stage: 'production',
        };

        const context = { isProduction: true, allowFakeTokens: false };

        expect(() => validateOperationWithContext(rawInputs, context)).toThrow(
          ValidationError
        );
      });

      it('should allow stage operations without token validation', () => {
        const rawInputs = {
          operation: 'stage',
        };

        const result = validateOperationWithContext(rawInputs);
        expect(result.operation).toBe('stage');
      });
    });
  });
});
