/**
 * Test suite for RemoveParser
 * Tests parsing of SST remove command outputs focusing on resource cleanup
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { RemoveParser } from '../../src/parsers/remove-parser';
import {
  EMPTY_OUTPUT,
  INCOMPLETE_OUTPUT,
  SST_REMOVE_COMPLETE_OUTPUT,
  SST_REMOVE_EMPTY_STACK_OUTPUT,
  SST_REMOVE_FAILED_OUTPUT,
  SST_REMOVE_LARGE_OUTPUT,
  SST_REMOVE_MALFORMED_OUTPUT,
  SST_REMOVE_PARTIAL_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
  SST_REMOVE_TIMEOUT_OUTPUT,
} from '../fixtures/sst-outputs';

describe('RemoveParser', () => {
  let parser: RemoveParser;

  beforeEach(() => {
    parser = new RemoveParser();
  });

  describe('parse', () => {
    it('should parse successful removal output', () => {
      const result = parser.parse(SST_REMOVE_SUCCESS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);

      // Check removed resources count
      expect(result.resourcesRemoved).toBe(3);
      expect(result.removedResources).toHaveLength(3);

      // Verify specific removed resources
      expect(result.removedResources[0]).toEqual({
        type: 'Website',
        name: 'my-sst-app-staging-web',
        status: 'removed',
      });
      expect(result.removedResources[1]).toEqual({
        type: 'Api',
        name: 'my-sst-app-staging-api',
        status: 'removed',
      });
      expect(result.removedResources[2]).toEqual({
        type: 'Function',
        name: 'my-sst-app-staging-handler',
        status: 'removed',
      });

      expect(result.completionStatus).toBe('complete');
    });

    it('should parse partial removal output with failed resources', () => {
      const result = parser.parse(SST_REMOVE_PARTIAL_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success even if partial
      expect(result.operation).toBe('remove');
      expect(result.app).toBe('my-sst-app');
      expect(result.completionStatus).toBe('partial');
      expect(result.resourcesRemoved).toBe(3); // Total resources processed

      // Check mixed resource statuses
      expect(result.removedResources).toHaveLength(3);
      expect(result.removedResources[0]).toEqual({
        type: 'Website',
        name: 'my-sst-app-staging-web',
        status: 'removed',
      });
      expect(result.removedResources[1]).toEqual({
        type: 'Function',
        name: 'my-sst-app-staging-handler',
        status: 'removed',
      });
      expect(result.removedResources[2]).toEqual({
        type: 'Api',
        name: 'my-sst-app-staging-api',
        status: 'failed',
      });
    });

    it('should parse complete removal with cost savings and permalink', () => {
      const result = parser.parse(SST_REMOVE_COMPLETE_OUTPUT, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.app).toBe('complex-app');
      expect(result.stage).toBe('production');
      expect(result.resourcesRemoved).toBe(6);
      expect(result.removedResources).toHaveLength(6);
      expect(result.permalink).toBe(
        'https://console.sst.dev/complex-app/production/removals/abc123'
      );

      // Verify all resources were removed successfully
      const allRemoved = result.removedResources.every(
        (r) => r.status === 'removed'
      );
      expect(allRemoved).toBe(true);

      // Check specific resource types
      const resourceTypes = result.removedResources.map((r) => r.type);
      expect(resourceTypes).toContain('Function');
      expect(resourceTypes).toContain('Database');
      expect(resourceTypes).toContain('Api');
      expect(resourceTypes).toContain('Website');
      expect(resourceTypes).toContain('Topic');
      expect(resourceTypes).toContain('Queue');
    });

    it('should handle failed removal with non-zero exit code', () => {
      const result = parser.parse(SST_REMOVE_FAILED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.completionStatus).toBe('failed');
      expect(result.error).toContain('Remove operation failed');
      expect(result.resourcesRemoved).toBe(4); // Total resources processed

      // Check mixed resource statuses
      const removedCount = result.removedResources.filter(
        (r) => r.status === 'removed'
      ).length;
      const failedCount = result.removedResources.filter(
        (r) => r.status === 'failed'
      ).length;

      expect(removedCount).toBe(1); // Website was deleted
      expect(failedCount).toBe(3); // Function, Database, Api failed
    });

    it('should handle timeout scenarios', () => {
      const result = parser.parse(SST_REMOVE_TIMEOUT_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0
      expect(result.completionStatus).toBe('partial');
      expect(result.resourcesRemoved).toBe(3);

      // Check that timeout is handled as failed status
      const timedOutResource = result.removedResources.find((r) =>
        r.name.includes('db')
      );
      expect(timedOutResource?.status).toBe('failed');
    });

    it('should handle empty stack scenario', () => {
      const result = parser.parse(SST_REMOVE_EMPTY_STACK_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.app).toBe('empty-app');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
      expect(result.completionStatus).toBe('complete');
    });

    it('should handle malformed removal output gracefully', () => {
      const result = parser.parse(SST_REMOVE_MALFORMED_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe(''); // No app found in malformed output
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
    });

    it('should handle failed removal with non-zero exit code properly', () => {
      const result = parser.parse(SST_REMOVE_MALFORMED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.completionStatus).toBe('failed');
      expect(result.resourcesRemoved).toBe(0);
    });

    it('should handle empty output', () => {
      const result = parser.parse(EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('remove');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('');
      expect(result.resourcesRemoved).toBe(0);
      expect(result.removedResources).toHaveLength(0);
    });

    it('should properly set truncated flag based on output size', () => {
      const result = parser.parse(
        SST_REMOVE_COMPLETE_OUTPUT,
        'staging',
        0,
        500
      ); // max size 500 bytes

      expect(result.truncated).toBe(true);
      expect(result.rawOutput.length).toBeLessThanOrEqual(500);
    });

    it('should count removed resources correctly in large removal', () => {
      const result = parser.parse(SST_REMOVE_LARGE_OUTPUT, 'development', 0);

      expect(result.success).toBe(true);
      expect(result.resourcesRemoved).toBe(100);
      expect(result.removedResources).toHaveLength(100);

      // Verify resource type distribution
      const functionCount = result.removedResources.filter(
        (r) => r.type === 'Function'
      ).length;
      const apiCount = result.removedResources.filter(
        (r) => r.type === 'Api'
      ).length;
      const websiteCount = result.removedResources.filter(
        (r) => r.type === 'Website'
      ).length;

      expect(functionCount).toBe(50);
      expect(apiCount).toBe(30);
      expect(websiteCount).toBe(20);

      // All should be successfully removed
      const allRemoved = result.removedResources.every(
        (r) => r.status === 'removed'
      );
      expect(allRemoved).toBe(true);
    });

    it('should extract resource details from removal lines', () => {
      const detailsOutput = `
SST Remove
App: details-app
Stage: test

✓ All resources removed
| Deleted         Function      details-app-test-auth (Node.js runtime)
| Deleted         Database      details-app-test-users-db (PostgreSQL)
! Api            details-app-test-api could not be removed: external references

3 resources processed
`;

      const result = parser.parse(detailsOutput, 'test', 0);

      expect(result.resourcesRemoved).toBe(3);
      expect(result.removedResources).toHaveLength(3);

      // Check that details are not included in name (simplified parsing)
      const authFunction = result.removedResources.find((r) =>
        r.name.includes('auth')
      );
      expect(authFunction).toEqual({
        type: 'Function',
        name: 'details-app-test-auth',
        status: 'removed',
      });

      const failedApi = result.removedResources.find((r) =>
        r.name.includes('api')
      );
      expect(failedApi?.status).toBe('failed');
    });
  });

  describe('error handling', () => {
    it('should not throw on invalid removal patterns', () => {
      expect(() => {
        const result = parser.parse(
          'Invalid removal format with special chars: $#@!',
          'staging',
          0
        );
        expect(result.resourcesRemoved).toBe(0);
      }).not.toThrow();
    });

    it('should handle very long removal outputs', () => {
      const longOutput = `${'A'.repeat(100_000)}\nSST Remove\nApp: test-app\n\n✓ All resources removed\n| Deleted Function test-function\n\n1 resources removed`;
      expect(() => {
        const result = parser.parse(longOutput, 'staging', 0);
        expect(result.app).toBe('test-app');
        expect(result.resourcesRemoved).toBe(1);
      }).not.toThrow();
    });

    it('should handle output with unusual line endings', () => {
      const windowsOutput =
        'SST Remove\r\nApp: test-app\r\n\r\n✓ All resources removed\r\n| Deleted Function test-func\r\n\r\n1 resources removed\r\n';
      const result = parser.parse(windowsOutput, 'staging', 0);
      expect(result.app).toBe('test-app');
      expect(result.resourcesRemoved).toBe(1);
    });

    it('should handle mixed success and failure patterns', () => {
      const mixedOutput = `
SST Remove
App: mixed-app
Stage: staging

⚠ Partial removal completed
| Deleted         Website       mixed-app-staging-web
| Deleted         Function      mixed-app-staging-handler
! Database       mixed-app-staging-db could not be removed: active connections
! Queue          mixed-app-staging-jobs removal failed: permission denied

Warning: 2 resources could not be removed
`;

      const result = parser.parse(mixedOutput, 'staging', 0);
      expect(result.success).toBe(true);
      expect(result.completionStatus).toBe('partial');
      expect(result.resourcesRemoved).toBe(4);

      const removedCount = result.removedResources.filter(
        (r) => r.status === 'removed'
      ).length;
      const failedCount = result.removedResources.filter(
        (r) => r.status === 'failed'
      ).length;

      expect(removedCount).toBe(2);
      expect(failedCount).toBe(2);
    });
  });

  describe('performance', () => {
    it('should parse large removals efficiently', () => {
      const startTime = Date.now();

      parser.parse(SST_REMOVE_LARGE_OUTPUT, 'staging', 0);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle repeated parsing efficiently', () => {
      const startTime = Date.now();

      // Parse same removal 100 times
      for (let i = 0; i < 100; i++) {
        parser.parse(SST_REMOVE_COMPLETE_OUTPUT, 'staging', 0);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete all in under 2 seconds
    });
  });
});
