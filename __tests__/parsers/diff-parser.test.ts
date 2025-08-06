/**
 * Test suite for DiffParser
 * Tests parsing of SST diff command outputs focusing on planned changes
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DiffParser } from '../../src/parsers/diff-parser';
import {
  EMPTY_OUTPUT,
  INCOMPLETE_OUTPUT,
  SST_DIFF_BREAKING_OUTPUT,
  SST_DIFF_COMPLEX_OUTPUT,
  SST_DIFF_COSMETIC_OUTPUT,
  SST_DIFF_LARGE_OUTPUT,
  SST_DIFF_MALFORMED_OUTPUT,
  SST_DIFF_NO_CHANGES_OUTPUT,
  SST_DIFF_OUTPUT,
} from '../fixtures/sst-outputs';

describe('DiffParser', () => {
  let parser: DiffParser;

  beforeEach(() => {
    parser = new DiffParser();
  });

  describe('parse', () => {
    it('should parse basic diff output with planned changes', () => {
      const result = parser.parse(SST_DIFF_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);

      // Check planned changes
      expect(result.plannedChanges).toBe(3);
      expect(result.changes).toHaveLength(3);

      // Verify specific changes
      expect(result.changes[0]).toEqual({
        type: 'Function',
        name: 'my-sst-app-staging-new-handler',
        action: 'create',
        details: undefined,
      });
      expect(result.changes[1]).toEqual({
        type: 'Api',
        name: 'my-sst-app-staging-api',
        action: 'update',
        details: 'environment updated',
      });
      expect(result.changes[2]).toEqual({
        type: 'Website',
        name: 'my-sst-app-staging-old-site',
        action: 'delete',
        details: undefined,
      });

      // Check change summary
      expect(result.changeSummary).toContain('3 changes planned');
      expect(result.changeSummary).toContain('1 created, 1 updated, 1 deleted');
    });

    it('should handle no changes scenario', () => {
      const result = parser.parse(SST_DIFF_NO_CHANGES_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.app).toBe('my-sst-app');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
      expect(result.changeSummary).toContain('No changes');
    });

    it('should parse complex diff output with costs and breaking changes', () => {
      const result = parser.parse(SST_DIFF_COMPLEX_OUTPUT, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.app).toBe('my-complex-app');
      expect(result.stage).toBe('production');
      expect(result.plannedChanges).toBe(6);
      expect(result.changes).toHaveLength(6);
      expect(result.permalink).toBe(
        'https://console.sst.dev/my-complex-app/production/diffs/xyz789'
      );

      // Check for different change types
      const createChanges = result.changes.filter((c) => c.action === 'create');
      const updateChanges = result.changes.filter((c) => c.action === 'update');
      const deleteChanges = result.changes.filter((c) => c.action === 'delete');

      expect(createChanges).toHaveLength(2);
      expect(updateChanges).toHaveLength(2);
      expect(deleteChanges).toHaveLength(2);

      // Verify database creation with details
      const dbCreate = result.changes.find(
        (c) => c.type === 'Database' && c.action === 'create'
      );
      expect(dbCreate).toEqual({
        type: 'Database',
        name: 'my-complex-app-production-users-db',
        action: 'create',
        details: 'RDS MySQL 8.0',
      });

      // Check change summary includes cost and breaking changes
      expect(result.changeSummary).toContain('6 changes planned');
      expect(result.changeSummary).toContain('Breaking changes detected');
      expect(result.changeSummary).toContain('Cost: +$22.30');
    });

    it('should detect breaking changes correctly', () => {
      const result = parser.parse(SST_DIFF_BREAKING_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(3);
      expect(result.changeSummary).toContain('Breaking changes');
      expect(result.changeSummary).toContain('Data migration required');
      expect(result.changeSummary).toContain('Cost: -$25.00');

      // Verify runtime change detection
      const runtimeChange = result.changes.find((c) => c.type === 'Function');
      expect(runtimeChange).toEqual({
        type: 'Function',
        name: 'breaking-app-staging-handler',
        action: 'update',
        details: 'runtime changed: node16 → node20',
      });
    });

    it('should handle cosmetic changes', () => {
      const result = parser.parse(SST_DIFF_COSMETIC_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(2);
      expect(result.changeSummary).toContain('Cosmetic changes only');
      expect(result.changeSummary).toContain('No functional impact');

      // Verify cosmetic changes
      expect(result.changes[0]).toEqual({
        type: 'Function',
        name: 'cosmetic-app-staging-handler',
        action: 'update',
        details: 'description updated',
      });
    });

    it('should handle failed diff with non-zero exit code', () => {
      const result = parser.parse(SST_DIFF_MALFORMED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
      expect(result.changeSummary).toContain('Diff parsing failed');
    });

    it('should handle malformed diff output gracefully', () => {
      const result = parser.parse(SST_DIFF_MALFORMED_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe(''); // No app found in malformed output
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('should handle empty output', () => {
      const result = parser.parse(EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('should properly set truncated flag based on output size', () => {
      const result = parser.parse(SST_DIFF_COMPLEX_OUTPUT, 'staging', 0, 500); // max size 500 bytes

      expect(result.truncated).toBe(true);
      expect(result.rawOutput.length).toBeLessThanOrEqual(500);
    });

    it('should count planned changes correctly in large diff', () => {
      const result = parser.parse(SST_DIFF_LARGE_OUTPUT, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(100);
      expect(result.changes).toHaveLength(100);

      // Verify change type distribution
      const createChanges = result.changes.filter((c) => c.action === 'create');
      const updateChanges = result.changes.filter((c) => c.action === 'update');
      const deleteChanges = result.changes.filter((c) => c.action === 'delete');

      expect(createChanges).toHaveLength(50);
      expect(updateChanges).toHaveLength(30);
      expect(deleteChanges).toHaveLength(20);
    });

    it('should extract change details correctly', () => {
      const detailsOutput = `
SST Diff
App: details-app
Stage: test

+ Function        details-app-test-new-auth (Node.js 20, 1GB memory)
~ Api            details-app-test-api (rate limiting added, cors updated)
- Website        details-app-test-old-site (deprecated)

3 changes planned
`;

      const result = parser.parse(detailsOutput, 'test', 0);

      expect(result.plannedChanges).toBe(3);
      expect(result.changes[0]).toEqual({
        type: 'Function',
        name: 'details-app-test-new-auth',
        action: 'create',
        details: 'Node.js 20, 1GB memory',
      });
      expect(result.changes[1]).toEqual({
        type: 'Api',
        name: 'details-app-test-api',
        action: 'update',
        details: 'rate limiting added, cors updated',
      });
      expect(result.changes[2]).toEqual({
        type: 'Website',
        name: 'details-app-test-old-site',
        action: 'delete',
        details: 'deprecated',
      });
    });
  });

  describe('error handling', () => {
    it('should not throw on invalid diff patterns', () => {
      expect(() => {
        const result = parser.parse(
          'Invalid diff format with special chars: $#@!',
          'staging',
          0
        );
        expect(result.plannedChanges).toBe(0);
      }).not.toThrow();
    });

    it('should handle very long diff outputs', () => {
      const longOutput = `${'A'.repeat(100_000)}\nSST Diff\nApp: test-app\n\n+ Function test-function\n\n1 changes planned`;
      expect(() => {
        const result = parser.parse(longOutput, 'staging', 0);
        expect(result.app).toBe('test-app');
        expect(result.plannedChanges).toBe(1);
      }).not.toThrow();
    });

    it('should handle output with unusual line endings', () => {
      const windowsOutput =
        'SST Diff\r\nApp: test-app\r\n\r\n+ Function test-func\r\n\r\n1 changes planned\r\n';
      const result = parser.parse(windowsOutput, 'staging', 0);
      expect(result.app).toBe('test-app');
      expect(result.plannedChanges).toBe(1);
    });
  });

  describe('performance', () => {
    it('should parse large diffs efficiently', () => {
      const startTime = Date.now();

      parser.parse(SST_DIFF_LARGE_OUTPUT, 'staging', 0);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle repeated parsing efficiently', () => {
      const startTime = Date.now();

      // Parse same diff 100 times
      for (let i = 0; i < 100; i++) {
        parser.parse(SST_DIFF_COMPLEX_OUTPUT, 'staging', 0);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete all in under 2 seconds
    });
  });
});
