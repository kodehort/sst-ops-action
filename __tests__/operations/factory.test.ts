import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/github/client';
import { OperationFactory } from '../../src/operations/factory';
import type { SSTOperation } from '../../src/types';
import type { SSTCLIExecutor } from '../../src/utils/cli';

const mockSSTExecutor = {
  executeSST: vi.fn(),
} as unknown as SSTCLIExecutor;

const mockGitHubClient = {
  postPRComment: vi.fn(),
  createOrUpdateComment: vi.fn(),
  createWorkflowSummary: vi.fn(),
} as unknown as GitHubClient;

describe('OperationFactory', () => {
  let factory: OperationFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    factory = new OperationFactory(mockSSTExecutor, mockGitHubClient);
  });

  describe('createOperation', () => {
    it('should create DeployOperation for deploy operation type', () => {
      const operation = factory.createOperation('deploy');

      expect(operation).toBeDefined();
      expect(operation).toHaveProperty('execute');
      expect(typeof operation.execute).toBe('function');
    });

    it('should create DiffOperation for diff operation type', () => {
      const operation = factory.createOperation('diff');

      expect(operation).toBeDefined();
      expect(operation).toHaveProperty('execute');
      expect(typeof operation.execute).toBe('function');
    });

    it('should create RemoveOperation for remove operation type', () => {
      const operation = factory.createOperation('remove');

      expect(operation).toBeDefined();
      expect(operation).toHaveProperty('execute');
      expect(typeof operation.execute).toBe('function');
    });

    it('should throw error for unknown operation type', () => {
      expect(() => {
        factory.createOperation('unknown' as SSTOperation);
      }).toThrow(
        'Unknown operation type: unknown. Supported operations: deploy, diff, remove'
      );
    });

    it('should create different instances for each operation type', () => {
      const deploy = factory.createOperation('deploy');
      const diff = factory.createOperation('diff');
      const remove = factory.createOperation('remove');

      expect(deploy).not.toBe(diff);
      expect(diff).not.toBe(remove);
      expect(deploy).not.toBe(remove);
    });
  });

  describe('isValidOperationType', () => {
    it('should return true for valid operation types', () => {
      expect(OperationFactory.isValidOperationType('deploy')).toBe(true);
      expect(OperationFactory.isValidOperationType('diff')).toBe(true);
      expect(OperationFactory.isValidOperationType('remove')).toBe(true);
    });

    it('should return false for invalid operation types', () => {
      expect(OperationFactory.isValidOperationType('unknown')).toBe(false);
      expect(OperationFactory.isValidOperationType('build')).toBe(false);
      expect(OperationFactory.isValidOperationType('')).toBe(false);
      expect(OperationFactory.isValidOperationType('DEPLOY')).toBe(false);
    });

    it('should handle null and undefined gracefully', () => {
      expect(OperationFactory.isValidOperationType(null as any)).toBe(false);
      expect(OperationFactory.isValidOperationType(undefined as any)).toBe(
        false
      );
    });
  });

  describe('getSupportedOperations', () => {
    it('should return all supported operation types', () => {
      const supportedOps = OperationFactory.getSupportedOperations();

      expect(supportedOps).toEqual(['deploy', 'diff', 'remove']);
      expect(supportedOps).toHaveLength(3);
    });

    it('should return a new array each time (not mutate original)', () => {
      const ops1 = OperationFactory.getSupportedOperations();
      const ops2 = OperationFactory.getSupportedOperations();

      expect(ops1).toEqual(ops2);
      expect(ops1).not.toBe(ops2); // Different array instances

      ops1.push('test' as any);
      expect(ops2).not.toContain('test');
    });
  });

  describe('factory instance management', () => {
    it('should maintain separate instances for different operation types', () => {
      const deploy1 = factory.createOperation('deploy');
      const deploy2 = factory.createOperation('deploy');
      const diff1 = factory.createOperation('diff');

      // Each call should create a new instance
      expect(deploy1).not.toBe(deploy2);
      expect(deploy1).not.toBe(diff1);
    });
  });

  describe('integration with operation constructors', () => {
    it('should create operations with the provided dependencies', () => {
      const deployOp = factory.createOperation('deploy');
      const diffOp = factory.createOperation('diff');
      const removeOp = factory.createOperation('remove');

      // Verify all operations have required methods
      expect(deployOp).toHaveProperty('execute');
      expect(diffOp).toHaveProperty('execute');
      expect(removeOp).toHaveProperty('execute');
    });

    it('should create operations that can handle options', () => {
      const operation = factory.createOperation('deploy');

      // The operation should have an execute method that takes options
      expect(operation.execute).toBeDefined();
      expect(operation.execute.length).toBe(1); // Should take one parameter (options)
    });
  });

  describe('type safety', () => {
    it('should enforce correct operation types at compile time', () => {
      // These should compile without errors
      factory.createOperation('deploy');
      factory.createOperation('diff');
      factory.createOperation('remove');

      // This would cause TypeScript compile error if uncommented:
      // factory.createOperation('invalid');
    });

    it('should return operations with correct interfaces', () => {
      const deployOp = factory.createOperation('deploy');
      const diffOp = factory.createOperation('diff');
      const removeOp = factory.createOperation('remove');

      // All operations should have execute method
      expect(deployOp).toHaveProperty('execute');
      expect(diffOp).toHaveProperty('execute');
      expect(removeOp).toHaveProperty('execute');

      expect(typeof deployOp.execute).toBe('function');
      expect(typeof diffOp.execute).toBe('function');
      expect(typeof removeOp.execute).toBe('function');
    });
  });
});
