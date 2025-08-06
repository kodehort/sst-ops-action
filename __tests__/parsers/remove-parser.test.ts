import {
  SST_REMOVE_COMPLEX_OUTPUT,
  SST_REMOVE_EMPTY_OUTPUT,
  SST_REMOVE_ERROR_OUTPUT,
  SST_REMOVE_INCOMPLETE_OUTPUT,
  SST_REMOVE_LARGE_OUTPUT,
  SST_REMOVE_MALFORMED_OUTPUT,
  SST_REMOVE_MIXED_RESOURCES_OUTPUT,
  SST_REMOVE_NO_RESOURCES_OUTPUT,
  SST_REMOVE_ONLY_FAILURES_OUTPUT,
  SST_REMOVE_PARTIAL_OUTPUT,
  SST_REMOVE_SKIPPED_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
  SST_REMOVE_TIMEOUT_OUTPUT,
} from '@tests/fixtures/sst-remove-outputs';
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

    it('should parse partial removal with failures', () => {
      const result = parser.parse(SST_REMOVE_PARTIAL_OUTPUT, 'production', 0);

      expect(result.success).toBe(true); // Exit code 0 means overall success
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('production');
      expect(result.app).toBe('my-sst-app');
      expect(result.resourcesRemoved).toBe(2); // Only successful removals counted
      expect(result.removedResources).toHaveLength(3); // All attempted resources tracked
      expect(result.completionStatus).toBe('partial');

      // Check successful removals
      const successful = result.removedResources.filter(
        (r) => r.status === 'removed'
      );
      expect(successful).toHaveLength(2);

      // Check failed removal
      const failed = result.removedResources.filter(
        (r) => r.status === 'failed'
      );
      expect(failed).toHaveLength(1);
      expect(failed[0]).toEqual({
        type: 'Api',
        name: 'my-sst-app-production-api',
        status: 'failed',
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

    it('should parse complex removal with mixed outcomes', () => {
      const result = parser.parse(SST_REMOVE_COMPLEX_OUTPUT, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('production');
      expect(result.app).toBe('complex-app');
      expect(result.resourcesRemoved).toBe(8);
      expect(result.removedResources).toHaveLength(9);
      expect(result.completionStatus).toBe('partial');

      // Check resource types
      const types = result.removedResources.map((r) => r.type);
      expect(types).toContain('Function');
      expect(types).toContain('Database');
      expect(types).toContain('Topic');
      expect(types).toContain('Queue');
      expect(types).toContain('Api');
      expect(types).toContain('Website');

      // Check statuses
      const statuses = result.removedResources.map((r) => r.status);
      expect(statuses.filter((s) => s === 'removed')).toHaveLength(8);
      expect(statuses.filter((s) => s === 'failed')).toHaveLength(1);
    });

    it('should handle large remove outputs efficiently', () => {
      const startTime = Date.now();
      const result = parser.parse(SST_REMOVE_LARGE_OUTPUT, 'production', 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should parse in under 1 second
      expect(result.success).toBe(true);
      expect(result.resourcesRemoved).toBe(45);
      expect(result.removedResources).toHaveLength(50); // 45 removed + 5 failed
      expect(result.completionStatus).toBe('partial');

      // Verify distribution
      const removed = result.removedResources.filter(
        (r) => r.status === 'removed'
      );
      const failed = result.removedResources.filter(
        (r) => r.status === 'failed'
      );
      expect(removed).toHaveLength(45);
      expect(failed).toHaveLength(5);
    });

    it('should handle mixed resource types with details', () => {
      const result = parser.parse(
        SST_REMOVE_MIXED_RESOURCES_OUTPUT,
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
      const result = parser.parse(
        SST_REMOVE_ONLY_FAILURES_OUTPUT,
        'staging',
        1
      );

      expect(result.success).toBe(false);
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(3);
      expect(result.completionStatus).toBe('failed');
      expect(result.removedResources.every((r) => r.status === 'failed')).toBe(
        true
      );
    });

    it('should handle skipped resources', () => {
      const result = parser.parse(SST_REMOVE_SKIPPED_OUTPUT, 'staging', 0);

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

    it('should handle timeout scenarios', () => {
      const result = parser.parse(SST_REMOVE_TIMEOUT_OUTPUT, 'production', 1);

      expect(result.success).toBe(false);
      expect(result.resourcesRemoved).toBe(1);
      expect(result.removedResources).toHaveLength(2);
      expect(result.completionStatus).toBe('partial');

      const failedResource = result.removedResources.find(
        (r) => r.status === 'failed'
      );
      expect(failedResource?.name).toBe('timeout-app-production-api');
    });

    it('should handle malformed output gracefully', () => {
      const result = parser.parse(SST_REMOVE_MALFORMED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
      expect(result.completionStatus).toBe('failed');
    });

    it('should handle empty output', () => {
      const result = parser.parse(SST_REMOVE_EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success
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
      expect(result.removedResources?.[0]?.status).toBe('removed');
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
      expect(Array.isArray(result.removedResources)).toBe(true);
    });
  });

  describe('edge cases and performance', () => {
    it('should handle very large outputs without memory issues', () => {
      // Create a very large remove output
      const largeResources = Array.from(
        { length: 1000 },
        (_, i) => `- Function        large-app-test-func-${i + 1}`
      ).join('\n');

      const largeOutput = `
SST Remove
App: performance-test-app
Stage: test

${largeResources}

✓ Complete

1000 resources removed

Permalink: https://console.sst.dev/performance-test-app/test/removes/perf123
`;

      const startTime = Date.now();
      const result = parser.parse(largeOutput, 'test', 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.success).toBe(true);
      expect(result.resourcesRemoved).toBe(1000);
      expect(result.removedResources).toHaveLength(1000);
    });

    it('should handle unicode characters in resource names', () => {
      const unicodeOutput = `
SST Remove
App: unicode-app
Stage: test

- Function        unicode-app-test-函数-handler
× Database        unicode-app-test-数据库 (failed: not empty)
- Api             unicode-app-test-api-配置

⚠ Partial completion

2 resources removed, 1 failed

Permalink: https://console.sst.dev/unicode-app/test/removes/uni123
`;

      const result = parser.parse(unicodeOutput, 'test', 0);

      expect(result.success).toBe(true);
      expect(result.removedResources).toHaveLength(3);
      expect(result.removedResources?.[0]?.name).toBe(
        'unicode-app-test-函数-handler'
      );
      expect(result.removedResources?.[1]?.name).toBe(
        'unicode-app-test-数据库'
      );
      expect(result.removedResources?.[2]?.name).toBe(
        'unicode-app-test-api-配置'
      );
    });

    it('should handle mixed line endings', () => {
      const mixedLineEndings = SST_REMOVE_SUCCESS_OUTPUT.replace(/\n/g, '\r\n');

      const result = parser.parse(mixedLineEndings, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.resourcesRemoved).toBe(3);
      expect(result.removedResources).toHaveLength(3);
    });

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
