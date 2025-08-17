import {
  EMPTY_OUTPUT,
  SST_REMOVE_ALL_FAILURES_OUTPUT,
  SST_REMOVE_ERROR_OUTPUT,
  SST_REMOVE_INCOMPLETE_OUTPUT,
  SST_REMOVE_MALFORMED_OUTPUT,
  SST_REMOVE_NO_RESOURCES_OUTPUT,
  SST_REMOVE_PARTIAL_WITH_FAILURES_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
  SST_REMOVE_SUCCESS_WITH_DETAILS_OUTPUT,
  SST_REMOVE_WITH_SKIPPED_OUTPUT,
} from '@tests/fixtures/sst-outputs';
import { beforeEach, describe, expect, it } from 'vitest';
import { RemoveParser } from '@/parsers/remove-parser';

describe('RemoveParser', () => {
  let parser: RemoveParser;

  beforeEach(() => {
    parser = new RemoveParser();
  });

  describe('parse', () => {
    it('should parse basic remove output with successful removals', () => {
      const result = parser.parse(SST_REMOVE_SUCCESS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.permalink).toBe(
        'https://console.sst.dev/my-sst-app/staging/removes/abc123'
      );
      expect(result.resourcesRemoved).toBe(3);
      expect(result.removedResources).toHaveLength(3);

      // Verify parsed resources
      expect(result.removedResources[0]).toEqual({
        type: 'Function',
        name: 'my-sst-app-staging-handler',
        status: 'removed',
      });
      expect(result.removedResources[1]).toEqual({
        type: 'Api',
        name: 'my-sst-app-staging-api',
        status: 'removed',
      });
      expect(result.removedResources[2]).toEqual({
        type: 'Website',
        name: 'my-sst-app-staging-site',
        status: 'removed',
      });
    });

    it('should handle no resources to remove scenario', () => {
      const result = parser.parse(SST_REMOVE_NO_RESOURCES_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
      expect(result.completionStatus).toBe('complete');
    });

    it('should parse complex removal with mixed outcomes', () => {
      const result = parser.parse(
        SST_REMOVE_SUCCESS_WITH_DETAILS_OUTPUT,
        'production',
        0
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('production');
      expect(result.app).toBe('complex-app');
      expect(result.resourcesRemoved).toBe(8);
      expect(result.removedResources).toHaveLength(8);
      expect(result.completionStatus).toBe('complete');

      // Check resource types
      const types = result.removedResources.map((r) => r.type);
      expect(types).toContain('Function');
      expect(types).toContain('Database');
      expect(types).toContain('Topic');
      expect(types).toContain('Queue');
      expect(types).toContain('Api');
      expect(types).toContain('Website');

      // All should be successful removals
      const statuses = result.removedResources.map((r) => r.status);
      expect(statuses.every((s) => s === 'removed')).toBe(true);
    });

    it('should handle mixed resource types with failures', () => {
      const result = parser.parse(
        SST_REMOVE_PARTIAL_WITH_FAILURES_OUTPUT,
        'development',
        0
      );

      expect(result.success).toBe(true);
      expect(result.resourcesRemoved).toBe(7);
      expect(result.removedResources).toHaveLength(8);
      expect(result.completionStatus).toBe('partial');

      // Should have all different resource types
      const uniqueTypes = [
        ...new Set(result.removedResources.map((r) => r.type)),
      ];
      expect(uniqueTypes).toContain('Function');
      expect(uniqueTypes).toContain('Database');
      expect(uniqueTypes).toContain('Topic');
      expect(uniqueTypes).toContain('Queue');
      expect(uniqueTypes).toContain('Api');
      expect(uniqueTypes).toContain('Website');
      expect(uniqueTypes).toContain('Bucket');

      // Check for failed resource
      const failedResource = result.removedResources.find(
        (r) => r.status === 'failed'
      );
      expect(failedResource).toEqual({
        type: 'Api',
        name: 'mixed-app-dev-graphql-api',
        status: 'failed',
      });
    });

    it('should handle only failures scenario', () => {
      const result = parser.parse(SST_REMOVE_ALL_FAILURES_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(3);
      expect(result.completionStatus).toBe('failed');

      // All should be failed
      expect(result.removedResources.every((r) => r.status === 'failed')).toBe(
        true
      );
    });

    it('should handle skipped resources', () => {
      const result = parser.parse(SST_REMOVE_WITH_SKIPPED_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.resourcesRemoved).toBe(2);
      expect(result.removedResources).toHaveLength(3);
      expect(result.completionStatus).toBe('complete');

      // Check for skipped resource
      const skippedResource = result.removedResources.find(
        (r) => r.status === 'skipped'
      );
      expect(skippedResource).toEqual({
        type: 'Database',
        name: 'skipped-app-staging-db',
        status: 'skipped',
      });
    });

    it('should handle complete failure scenarios', () => {
      const result = parser.parse(SST_REMOVE_ERROR_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('error-app');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
      expect(result.completionStatus).toBe('failed');
    });

    it('should handle malformed output gracefully', () => {
      const result = parser.parse(SST_REMOVE_MALFORMED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
    });

    it('should handle empty output', () => {
      const result = parser.parse(EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
      expect(result.completionStatus).toBe('complete');
    });

    it('should handle incomplete output', () => {
      const result = parser.parse(SST_REMOVE_INCOMPLETE_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.app).toBe('incomplete-app');
      expect(result.resourcesRemoved).toBe(1);
      expect(result.removedResources).toHaveLength(1);
      expect(result.removedResources[0]).toEqual({
        type: 'Function',
        name: 'incomplete-app-staging-handler',
        status: 'removed',
      });
    });

    it('should provide consistent result structure', () => {
      const result = parser.parse(SST_REMOVE_SUCCESS_OUTPUT, 'staging', 0);

      // All RemoveResult properties should be present
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('operation');
      expect(result).toHaveProperty('stage');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('resourcesRemoved');
      expect(result).toHaveProperty('removedResources');
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('rawOutput');
      expect(result).toHaveProperty('permalink');
      expect(result).toHaveProperty('completionStatus');
      expect(result).toHaveProperty('truncated');

      // Remove-specific defaults
      expect(result.truncated).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should be null-safe with undefined inputs', () => {
      expect(() => {
        // @ts-expect-error - testing runtime behavior
        parser.parse(null, 'staging', 0);
      }).not.toThrow();

      expect(() => {
        // @ts-expect-error - testing runtime behavior
        parser.parse(undefined, 'staging', 0);
      }).not.toThrow();
    });
  });
});
