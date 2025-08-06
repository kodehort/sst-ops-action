import { describe, expect, it } from 'vitest';
import type {
  SSTDeployOutput,
  SSTDiffOutput,
  SSTRemoveOutput,
} from '../../src/types/index.js';
import { validateSSTOutput } from '../../src/types/index.js';

describe('SST Output Validation', () => {
  describe('validateSSTOutput', () => {
    it('should validate deploy output correctly', () => {
      const validDeployOutput: SSTDeployOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        resources: [
          {
            type: 'Function',
            name: 'api-handler',
            logicalId: 'ApiHandler',
            physicalId: 'test-app-test-api-handler-abc123',
            status: 'CREATE_COMPLETE',
            properties: {
              runtime: 'nodejs20.x',
              handler: 'index.handler',
              timeout: 30,
              memory: 1024,
            },
            outputs: {
              arn: 'arn:aws:lambda:us-east-1:123456789012:function:test-app-test-api-handler-abc123',
              name: 'test-app-test-api-handler-abc123',
            },
          },
        ],
        outputs: {
          ApiUrl: 'https://api.example.com',
        },
        urls: [
          {
            name: 'api',
            url: 'https://api.example.com',
            type: 'api',
          },
        ],
        duration: 45_000,
        status: 'success',
        permalink: 'https://console.sst.dev/test-app/test/deploy/123',
      };

      expect(() =>
        validateSSTOutput(validDeployOutput, 'deploy')
      ).not.toThrow();
      const result = validateSSTOutput(validDeployOutput, 'deploy');
      expect(result).toEqual(validDeployOutput);
    });

    it('should validate diff output correctly', () => {
      const validDiffOutput: SSTDiffOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        changes: [
          {
            action: 'create',
            type: 'Function',
            name: 'new-handler',
            logicalId: 'NewHandler',
            reason: 'New resource added',
            properties: {
              added: {
                runtime: 'nodejs20.x',
                handler: 'new.handler',
              },
              updated: {},
              removed: {},
            },
          },
          {
            action: 'update',
            type: 'Function',
            name: 'existing-handler',
            logicalId: 'ExistingHandler',
            reason: 'Memory configuration changed',
            properties: {
              added: {},
              updated: {
                memory: 512,
              },
              removed: {},
            },
          },
          {
            action: 'delete',
            type: 'Function',
            name: 'old-handler',
            logicalId: 'OldHandler',
            reason: 'Resource no longer needed',
          },
        ],
        summary: {
          toCreate: 1,
          toUpdate: 1,
          toDelete: 1,
          total: 3,
        },
        status: 'success',
      };

      expect(() => validateSSTOutput(validDiffOutput, 'diff')).not.toThrow();
      const result = validateSSTOutput(validDiffOutput, 'diff');
      expect(result).toEqual(validDiffOutput);
    });

    it('should validate remove output correctly', () => {
      const validRemoveOutput: SSTRemoveOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        removed: [
          {
            type: 'Function',
            name: 'api-handler',
            logicalId: 'ApiHandler',
            status: 'removed',
          },
          {
            type: 'Api',
            name: 'api',
            logicalId: 'Api',
            status: 'removed',
          },
          {
            type: 'Table',
            name: 'users',
            logicalId: 'UsersTable',
            status: 'failed',
            reason: 'Table has deletion protection enabled',
          },
        ],
        summary: {
          totalRemoved: 2,
          totalFailed: 1,
          totalSkipped: 0,
        },
        duration: 30_000,
        status: 'partial',
        errors: ['Failed to remove Table: users - deletion protection enabled'],
        warnings: ['Some resources may take time to fully delete'],
      };

      expect(() =>
        validateSSTOutput(validRemoveOutput, 'remove')
      ).not.toThrow();
      const result = validateSSTOutput(validRemoveOutput, 'remove');
      expect(result).toEqual(validRemoveOutput);
    });

    it('should throw error for invalid output structure', () => {
      expect(() => validateSSTOutput(null, 'deploy')).toThrow(
        'SST output must be an object'
      );
      expect(() => validateSSTOutput(undefined, 'deploy')).toThrow(
        'SST output must be an object'
      );
      expect(() => validateSSTOutput('string', 'deploy')).toThrow(
        'SST output must be an object'
      );
      expect(() => validateSSTOutput(123, 'deploy')).toThrow(
        'SST output must be an object'
      );
    });

    it('should throw error for missing required fields', () => {
      const invalidOutput = {};
      expect(() => validateSSTOutput(invalidOutput, 'deploy')).toThrow(
        'must include app and stage'
      );

      const partialOutput = { app: 'test-app' };
      expect(() => validateSSTOutput(partialOutput, 'deploy')).toThrow(
        'must include app and stage'
      );
    });

    it('should throw error for deploy output missing required fields', () => {
      const incompleteDeployOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        // missing: resources, outputs, urls, duration, status
      };

      expect(() => validateSSTOutput(incompleteDeployOutput, 'deploy')).toThrow(
        'Deploy output missing required field'
      );
    });

    it('should throw error for diff output missing required fields', () => {
      const incompleteDiffOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        // missing: changes, summary, status
      };

      expect(() => validateSSTOutput(incompleteDiffOutput, 'diff')).toThrow(
        'Diff output missing required field'
      );
    });

    it('should throw error for remove output missing required fields', () => {
      const incompleteRemoveOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        // missing: removed, summary, duration, status
      };

      expect(() => validateSSTOutput(incompleteRemoveOutput, 'remove')).toThrow(
        'Remove output missing required field'
      );
    });

    it('should throw error for unsupported operations', () => {
      const validOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
      };

      expect(() => validateSSTOutput(validOutput, 'invalid' as any)).toThrow(
        'Unsupported operation: invalid'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays in deploy output', () => {
      const deployWithEmptyArrays: SSTDeployOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        resources: [], // empty array
        outputs: {},
        urls: [], // empty array
        duration: 1000,
        status: 'success',
      };

      expect(() =>
        validateSSTOutput(deployWithEmptyArrays, 'deploy')
      ).not.toThrow();
    });

    it('should handle empty arrays in diff output', () => {
      const diffWithEmptyArrays: SSTDiffOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        changes: [], // empty array
        summary: {
          toCreate: 0,
          toUpdate: 0,
          toDelete: 0,
          total: 0,
        },
        status: 'success',
      };

      expect(() =>
        validateSSTOutput(diffWithEmptyArrays, 'diff')
      ).not.toThrow();
    });

    it('should handle empty arrays in remove output', () => {
      const removeWithEmptyArrays: SSTRemoveOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        removed: [], // empty array
        summary: {
          totalRemoved: 0,
          totalFailed: 0,
          totalSkipped: 0,
        },
        duration: 1000,
        status: 'success',
      };

      expect(() =>
        validateSSTOutput(removeWithEmptyArrays, 'remove')
      ).not.toThrow();
    });

    it('should handle optional fields correctly', () => {
      const deployWithOptionalFields: SSTDeployOutput = {
        app: 'test-app',
        stage: 'test',
        region: 'us-east-1',
        resources: [],
        outputs: {},
        urls: [],
        duration: 1000,
        status: 'success',
        permalink: 'https://console.sst.dev/test-app/test/deploy/123',
        warnings: ['This is a warning'],
        errors: [], // empty errors array
      };

      expect(() =>
        validateSSTOutput(deployWithOptionalFields, 'deploy')
      ).not.toThrow();
    });
  });
});
