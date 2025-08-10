import { describe, expect, it } from 'vitest';
import {
  ActionInputsSchema,
  createValidationContext,
  InputValidators,
  parseActionInputs,
  ValidationError,
  validateInput,
  validateWithContext,
} from '../../src/utils/validation.js';

describe('Input Validation', () => {
  describe('ActionInputsSchema', () => {
    it('should validate valid inputs with defaults', () => {
      const validInputs = {
        stage: 'staging',
        token: 'ghp_1234567890abcdef',
      };

      const result = ActionInputsSchema.parse(validInputs);

      expect(result.operation).toBe('deploy'); // default
      expect(result.stage).toBe('staging');
      expect(result.token).toBe('ghp_1234567890abcdef');
      expect(result.commentMode).toBe('on-success'); // default
      expect(result.failOnError).toBe(true); // default
      expect(result.maxOutputSize).toBe(50_000); // default
    });

    it('should validate all operation types', () => {
      const operations = ['deploy', 'diff', 'remove'];

      operations.forEach((operation) => {
        const inputs = {
          operation,
          stage: 'test',
          token: 'fake-token',
        };

        const result = ActionInputsSchema.parse(inputs);
        expect(result.operation).toBe(operation);
      });
    });

    it('should validate all comment modes', () => {
      const commentModes = ['always', 'on-success', 'on-failure', 'never'];

      commentModes.forEach((commentMode) => {
        const inputs = {
          stage: 'test',
          token: 'fake-token',
          commentMode,
        };

        const result = ActionInputsSchema.parse(inputs);
        expect(result.commentMode).toBe(commentMode);
      });
    });

    it('should handle boolean values for failOnError', () => {
      const testCases = [
        { input: true, expected: true },
        { input: false, expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const inputs = {
          stage: 'test',
          token: 'fake-token',
          failOnError: input,
        };

        const result = ActionInputsSchema.parse(inputs);
        expect(result.failOnError).toBe(expected);
      });
    });

    it('should handle string number conversion for maxOutputSize', () => {
      const testCases = [
        { input: '25000', expected: 25_000 },
        { input: 25_000, expected: 25_000 },
        { input: '1000', expected: 1000 },
        { input: '1000000', expected: 1_000_000 },
      ];

      testCases.forEach(({ input, expected }) => {
        const inputs = {
          stage: 'test',
          token: 'fake-token',
          maxOutputSize: input,
        };

        const result = ActionInputsSchema.parse(inputs);
        expect(result.maxOutputSize).toBe(expected);
      });
    });
  });

  describe('Input Validation Errors', () => {
    it('should reject invalid operations', () => {
      const inputs = {
        operation: 'invalid-operation',
        stage: 'test',
        token: 'fake-token',
      };

      expect(() => ActionInputsSchema.parse(inputs)).toThrow();
    });

    it('should accept empty stage (auto-computation)', () => {
      const inputs = {
        stage: '',
        token: 'fake-token',
      };

      const result = ActionInputsSchema.parse(inputs);
      expect(result.stage).toBe('');
    });

    it('should reject invalid stage characters', () => {
      const invalidStages = [
        'stage with spaces',
        'stage@special',
        'stage/slash',
      ];

      invalidStages.forEach((stage) => {
        const inputs = {
          stage,
          token: 'fake-token',
        };

        expect(() => ActionInputsSchema.parse(inputs)).toThrow();
      });
    });

    it('should accept valid stage formats', () => {
      const validStages = [
        'production',
        'staging',
        'dev-123',
        'test_env',
        'pr-456',
      ];

      validStages.forEach((stage) => {
        const inputs = {
          stage,
          token: 'fake-token',
        };

        const result = ActionInputsSchema.parse(inputs);
        expect(result.stage).toBe(stage);
      });
    });

    it('should reject empty token', () => {
      const inputs = {
        stage: 'test',
        token: '',
      };

      expect(() => ActionInputsSchema.parse(inputs)).toThrow(
        'Token cannot be empty'
      );
    });

    it('should accept any non-empty token', () => {
      const validTokens = [
        'ghp_1234567890abcdef',
        'github_pat_1234567890abcdef',
        'fake-token',
        'custom-token',
        'bearer_token',
        'any-token-value',
      ];

      validTokens.forEach((token) => {
        const inputs = {
          stage: 'test',
          token,
        };

        const result = ActionInputsSchema.parse(inputs);
        expect(result.token).toBe(token);
      });
    });

    it('should reject invalid comment modes', () => {
      const inputs = {
        stage: 'test',
        token: 'fake-token',
        commentMode: 'invalid-mode',
      };

      expect(() => ActionInputsSchema.parse(inputs)).toThrow();
    });

    it('should reject invalid boolean strings for failOnError', () => {
      const inputs = {
        stage: 'test',
        token: 'fake-token',
        failOnError: 'maybe',
      };

      expect(() => ActionInputsSchema.parse(inputs)).toThrow();
    });

    it('should reject invalid numbers for maxOutputSize', () => {
      const inputs = {
        stage: 'test',
        token: 'fake-token',
        maxOutputSize: 'not-a-number',
      };

      expect(() => ActionInputsSchema.parse(inputs)).toThrow(
        'max-output-size must be a valid number'
      );
    });

    it('should reject maxOutputSize out of bounds', () => {
      const testCases = [-1, 999, 1_048_577, 2_000_000]; // 1048577 is 1MB + 1 byte

      testCases.forEach((maxOutputSize) => {
        const inputs = {
          stage: 'test',
          token: 'fake-token',
          maxOutputSize,
        };

        expect(() => ActionInputsSchema.parse(inputs)).toThrow();
      });
    });

    it('should allow maxOutputSize of 0 for unlimited', () => {
      const inputs = {
        stage: 'test',
        token: 'fake-token',
        maxOutputSize: 0,
      };

      const result = ActionInputsSchema.parse(inputs);
      expect(result.maxOutputSize).toBe(0);
    });
  });

  describe('parseActionInputs', () => {
    it('should parse valid inputs successfully', () => {
      const rawInputs = {
        operation: 'deploy',
        stage: 'staging',
        token: 'ghp_1234567890abcdef',
        commentMode: 'always',
        failOnError: true,
        maxOutputSize: 100_000,
      };

      const result = parseActionInputs(rawInputs);

      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.token).toBe('ghp_1234567890abcdef');
      expect(result.commentMode).toBe('always');
      expect(result.failOnError).toBe(true);
      expect(result.maxOutputSize).toBe(100_000);
    });

    it('should throw ValidationError with suggestions on invalid input', () => {
      const rawInputs = {
        operation: 'invalid-operation',
        stage: 'test',
        token: 'fake-token',
      };

      expect(() => parseActionInputs(rawInputs)).toThrow(ValidationError);

      try {
        parseActionInputs(rawInputs);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.field).toBe('operation');
        expect(validationError.suggestions.length).toBeGreaterThan(0);
        expect(
          validationError.suggestions.some((s) =>
            s.includes('deploy, diff, remove')
          )
        ).toBe(true);
      }
    });
  });

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

  describe('validateInput', () => {
    it('should validate single input successfully', () => {
      const result = validateInput(
        'deploy',
        ActionInputsSchema.shape.operation,
        'operation'
      );
      expect(result).toBe('deploy');
    });

    it('should throw ValidationError for invalid input', () => {
      expect(() => {
        validateInput(
          'invalid',
          ActionInputsSchema.shape.operation,
          'operation'
        );
      }).toThrow(ValidationError);
    });
  });

  describe('InputValidators', () => {
    it('should validate operation', () => {
      expect(InputValidators.operation('deploy')).toBe('deploy');
      expect(InputValidators.operation('diff')).toBe('diff');
      expect(InputValidators.operation('remove')).toBe('remove');
    });

    it('should validate stage', () => {
      expect(InputValidators.stage('production')).toBe('production');
      expect(InputValidators.stage('  staging  ')).toBe('staging'); // trims whitespace
    });

    it('should validate token', () => {
      expect(InputValidators.token('ghp_1234567890abcdef')).toBe(
        'ghp_1234567890abcdef'
      );
      expect(InputValidators.token('fake-token')).toBe('fake-token');
      expect(InputValidators.token('custom-token')).toBe('custom-token');
      expect(InputValidators.token('any-value')).toBe('any-value');
    });

    it('should validate commentMode', () => {
      expect(InputValidators.commentMode('always')).toBe('always');
      expect(InputValidators.commentMode('never')).toBe('never');
    });

    it('should validate failOnError', () => {
      expect(InputValidators.failOnError(true)).toBe(true);
      expect(InputValidators.failOnError(false)).toBe(false);
    });

    it('should validate maxOutputSize', () => {
      expect(InputValidators.maxOutputSize(25_000)).toBe(25_000);
      expect(InputValidators.maxOutputSize('25000')).toBe(25_000);
    });
  });

  describe('validateWithContext', () => {
    it('should validate with basic context', () => {
      const rawInputs = {
        operation: 'deploy',
        stage: 'test',
        token: 'fake-token',
      };

      const result = validateWithContext(rawInputs);
      expect(result.operation).toBe('deploy');
    });

    it('should reject remove operation on production stage', () => {
      const rawInputs = {
        operation: 'remove',
        stage: 'production',
        token: 'fake-token',
      };

      const context = { isProduction: true };

      expect(() => validateWithContext(rawInputs, context)).toThrow(
        ValidationError
      );

      try {
        validateWithContext(rawInputs, context);
      } catch (error) {
        const validationError = error as ValidationError;
        expect(validationError.message).toContain(
          'production stage requires explicit confirmation'
        );
        expect(
          validationError.suggestions.some((s) =>
            s.includes('staging or development')
          )
        ).toBe(true);
      }
    });

    it('should reject fake token in production', () => {
      const rawInputs = {
        operation: 'deploy',
        stage: 'staging',
        token: 'fake-token',
      };

      const context = { isProduction: true, allowFakeTokens: false };

      expect(() => validateWithContext(rawInputs, context)).toThrow(
        ValidationError
      );

      try {
        validateWithContext(rawInputs, context);
      } catch (error) {
        const validationError = error as ValidationError;
        expect(validationError.message).toContain(
          'Production deployments require a real GitHub token'
        );
        expect(
          validationError.suggestions.some((s) => s.includes('GITHUB_TOKEN'))
        ).toBe(true);
      }
    });

    it('should validate diff operation requires valid stage', () => {
      const rawInputs = {
        operation: 'diff',
        stage: '   ',
        token: 'fake-token',
      };

      expect(() => validateWithContext(rawInputs)).toThrow();
    });
  });

  describe('createValidationContext', () => {
    it('should create context from environment variables', () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'staging',
        GITHUB_REF: 'refs/heads/main',
        NODE_ENV: 'test',
        CI: 'true',
      };

      const context = createValidationContext(env);

      expect(context.operation).toBe('deploy');
      expect(context.stage).toBe('staging');
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

      expect(context.operation).toBe('deploy');
      expect(context.stage).toBe('');
      expect(context.isProduction).toBe(false);
      expect(context.allowFakeTokens).toBe(true);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle trimmed stage values', () => {
      const inputs = {
        stage: '  production  ',
        token: 'fake-token',
      };

      const result = ActionInputsSchema.parse(inputs);
      expect(result.stage).toBe('production');
    });

    it('should handle all valid stage name patterns', () => {
      const validStagePatterns = [
        'prod',
        'production',
        'staging',
        'dev-123',
        'test_env',
        'pr-456',
        'feature-branch-name',
        'hotfix_2024_01_15',
        'v1-0-0',
        'USER_BRANCH_123',
      ];

      validStagePatterns.forEach((stage) => {
        const inputs = { stage, token: 'fake-token' };
        const result = ActionInputsSchema.parse(inputs);
        expect(result.stage).toBe(stage);
      });
    });

    it('should validate comprehensive input combinations', () => {
      const testCombinations = [
        {
          operation: 'deploy',
          stage: 'production',
          token: 'ghp_1234567890abcdef',
          commentMode: 'always',
          failOnError: true,
          maxOutputSize: 100_000,
        },
        {
          operation: 'diff',
          stage: 'staging',
          token: 'github_pat_1234567890abcdef',
          commentMode: 'on-failure',
          failOnError: false,
          maxOutputSize: 25_000,
        },
        {
          operation: 'remove',
          stage: 'pr-123',
          token: 'fake-token',
          commentMode: 'never',
          failOnError: true, // boolean
          maxOutputSize: '75000', // string number
        },
      ];

      testCombinations.forEach((inputs) => {
        const result = ActionInputsSchema.parse(inputs);
        expect(result.operation).toBe(inputs.operation);
        expect(result.stage).toBe(inputs.stage);
        expect(result.token).toBe(inputs.token);
        expect(result.commentMode).toBe(inputs.commentMode);
      });
    });
  });
});
