import { describe, expect, it } from 'vitest';
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
  SSTError,
} from '../../src/types/index.js';
import {
  createSSTError,
  isDeployResult,
  isDiffResult,
  isRemoveResult,
  isSSTError,
  isValidCommentMode,
  isValidCompletionStatus,
  isValidOperation,
  validateCommentMode,
  validateMaxOutputSize,
  validateOperation,
  validateStage,
} from '../../src/types/index.js';

describe('Type Guards', () => {
  describe('Operation Result Type Guards', () => {
    it('should identify deploy results correctly', () => {
      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'test',
        app: 'test-app',
        rawOutput: 'test output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 5,
        outputs: [{ key: 'api', value: 'https://api.example.com' }],
        resources: [{ type: 'Function', name: 'handler', status: 'created' }],
      };

      expect(isDeployResult(deployResult)).toBe(true);
      expect(isDiffResult(deployResult)).toBe(false);
      expect(isRemoveResult(deployResult)).toBe(false);
    });

    it('should identify diff results correctly', () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'test',
        app: 'test-app',
        rawOutput: 'test output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 3,
        changeSummary: '3 resources to create',
        changes: [{ type: 'Function', name: 'handler', action: 'create' }],
      };

      expect(isDiffResult(diffResult)).toBe(true);
      expect(isDeployResult(diffResult)).toBe(false);
      expect(isRemoveResult(diffResult)).toBe(false);
    });

    it('should identify remove results correctly', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'test',
        app: 'test-app',
        rawOutput: 'test output',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourcesRemoved: 2,
        removedResources: [
          { type: 'Function', name: 'handler', status: 'removed' },
        ],
      };

      expect(isRemoveResult(removeResult)).toBe(true);
      expect(isDeployResult(removeResult)).toBe(false);
      expect(isDiffResult(removeResult)).toBe(false);
    });
  });

  describe('String Validation Type Guards', () => {
    it('should validate SST operations', () => {
      expect(isValidOperation('deploy')).toBe(true);
      expect(isValidOperation('diff')).toBe(true);
      expect(isValidOperation('remove')).toBe(true);
      expect(isValidOperation('invalid')).toBe(false);
      expect(isValidOperation('')).toBe(false);
    });

    it('should validate comment modes', () => {
      expect(isValidCommentMode('always')).toBe(true);
      expect(isValidCommentMode('on-success')).toBe(true);
      expect(isValidCommentMode('on-failure')).toBe(true);
      expect(isValidCommentMode('never')).toBe(true);
      expect(isValidCommentMode('invalid')).toBe(false);
      expect(isValidCommentMode('')).toBe(false);
    });

    it('should validate completion statuses', () => {
      expect(isValidCompletionStatus('complete')).toBe(true);
      expect(isValidCompletionStatus('partial')).toBe(true);
      expect(isValidCompletionStatus('failed')).toBe(true);
      expect(isValidCompletionStatus('invalid')).toBe(false);
      expect(isValidCompletionStatus('')).toBe(false);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateOperation', () => {
    it('should validate correct operations', () => {
      expect(validateOperation('deploy')).toBe('deploy');
      expect(validateOperation('diff')).toBe('diff');
      expect(validateOperation('remove')).toBe('remove');
    });

    it('should throw error for invalid operations', () => {
      expect(() => validateOperation('invalid')).toThrow('Invalid operation');
      expect(() => validateOperation('')).toThrow('Invalid operation');
      expect(() => validateOperation(123)).toThrow(
        'Operation must be a string'
      );
      expect(() => validateOperation(null)).toThrow(
        'Operation must be a string'
      );
    });
  });

  describe('validateCommentMode', () => {
    it('should validate correct comment modes', () => {
      expect(validateCommentMode('always')).toBe('always');
      expect(validateCommentMode('on-success')).toBe('on-success');
      expect(validateCommentMode('on-failure')).toBe('on-failure');
      expect(validateCommentMode('never')).toBe('never');
    });

    it('should throw error for invalid comment modes', () => {
      expect(() => validateCommentMode('invalid')).toThrow(
        'Invalid comment mode'
      );
      expect(() => validateCommentMode('')).toThrow('Invalid comment mode');
      expect(() => validateCommentMode(123)).toThrow(
        'Comment mode must be a string'
      );
    });
  });

  describe('validateStage', () => {
    it('should validate correct stage names', () => {
      expect(validateStage('production')).toBe('production');
      expect(validateStage('staging')).toBe('staging');
      expect(validateStage('dev-123')).toBe('dev-123');
      expect(validateStage('test_env')).toBe('test_env');
      expect(validateStage(' staging ')).toBe('staging'); // trims whitespace
    });

    it('should throw error for invalid stage names', () => {
      expect(() => validateStage('')).toThrow(
        'Stage must be a non-empty string'
      );
      expect(() => validateStage('  ')).toThrow(
        'Stage must be a non-empty string'
      );
      expect(() => validateStage('stage with spaces')).toThrow(
        'alphanumeric characters'
      );
      expect(() => validateStage('stage@special')).toThrow(
        'alphanumeric characters'
      );
      expect(() => validateStage(123)).toThrow(
        'Stage must be a non-empty string'
      );
    });
  });

  describe('validateMaxOutputSize', () => {
    it('should validate correct output sizes', () => {
      expect(validateMaxOutputSize(0)).toBe(0);
      expect(validateMaxOutputSize(50_000)).toBe(50_000);
      expect(validateMaxOutputSize('50000')).toBe(50_000);
      expect(validateMaxOutputSize(1_048_576)).toBe(1_048_576); // 1MB
    });

    it('should throw error for invalid output sizes', () => {
      expect(() => validateMaxOutputSize(-1)).toThrow('non-negative number');
      expect(() => validateMaxOutputSize('invalid')).toThrow(
        'non-negative number'
      );
      expect(() => validateMaxOutputSize(1_048_577)).toThrow(
        'cannot exceed 1MB'
      );
      expect(() => validateMaxOutputSize(null)).toThrow('non-negative number');
    });
  });
});

describe('Error Utilities', () => {
  describe('createSSTError', () => {
    it('should create SST error objects', () => {
      const error = createSSTError('TEST_ERROR', 'Test error message');

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.details).toBeUndefined();
      expect(error.context).toBeUndefined();
    });

    it('should create SST error objects with details', () => {
      const error = createSSTError(
        'TEST_ERROR',
        'Test error message',
        'Additional details'
      );

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.details).toBe('Additional details');
    });
  });

  describe('isSSTError', () => {
    it('should identify valid SST errors', () => {
      const error: SSTError = {
        code: 'TEST_ERROR',
        message: 'Test message',
      };

      expect(isSSTError(error)).toBe(true);
    });

    it('should reject invalid SST errors', () => {
      expect(isSSTError(null)).toBe(false);
      expect(isSSTError(undefined)).toBe(false);
      expect(isSSTError('string')).toBe(false);
      expect(isSSTError({})).toBe(false);
      expect(isSSTError({ code: 'TEST' })).toBe(false); // missing message
      expect(isSSTError({ message: 'Test' })).toBe(false); // missing code
      expect(isSSTError({ code: 123, message: 'Test' })).toBe(false); // invalid code type
      expect(isSSTError({ code: 'TEST', message: 123 })).toBe(false); // invalid message type
    });
  });
});

describe('Type System Integration', () => {
  it('should work with all operation types in a unified way', () => {
    const operations = ['deploy', 'diff', 'remove'] as const;

    operations.forEach((operation) => {
      expect(isValidOperation(operation)).toBe(true);
      expect(validateOperation(operation)).toBe(operation);
    });
  });

  it('should provide consistent error handling across all validators', () => {
    const validators = [
      () => validateOperation('invalid'),
      () => validateCommentMode('invalid'),
      () => validateStage(''),
      () => validateMaxOutputSize(-1),
    ];

    validators.forEach((validator) => {
      expect(() => validator()).toThrow();
    });
  });

  it('should handle type narrowing correctly', () => {
    const operation: string = 'deploy';

    if (isValidOperation(operation)) {
      // TypeScript should narrow the type here
      expect(['deploy', 'diff', 'remove']).toContain(operation);
    }
  });
});
