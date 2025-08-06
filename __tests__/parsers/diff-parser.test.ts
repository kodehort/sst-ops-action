import {
  SST_DIFF_BREAKING_OUTPUT,
  SST_DIFF_COMPLEX_OUTPUT,
  SST_DIFF_COSMETIC_OUTPUT,
  SST_DIFF_EMPTY_OUTPUT,
  SST_DIFF_ERROR_OUTPUT,
  SST_DIFF_INCOMPLETE_OUTPUT,
  SST_DIFF_LARGE_OUTPUT,
  SST_DIFF_MALFORMED_OUTPUT,
  SST_DIFF_MIXED_RESOURCES_OUTPUT,
  SST_DIFF_NO_CHANGES_OUTPUT,
  SST_DIFF_ONLY_ADDITIONS_OUTPUT,
  SST_DIFF_ONLY_DELETIONS_OUTPUT,
  SST_DIFF_ONLY_UPDATES_OUTPUT,
  SST_DIFF_SUCCESS_OUTPUT,
} from '@tests/fixtures/sst-diff-outputs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DiffParser } from '@/parsers/diff-parser';

describe('DiffParser', () => {
  let parser: DiffParser;

  beforeEach(() => {
    parser = new DiffParser();
  });

  describe('parse', () => {
    it('should parse basic diff output with mixed changes', () => {
      const result = parser.parse(SST_DIFF_SUCCESS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.permalink).toBe(
        'https://console.sst.dev/my-sst-app/staging/diffs/abc123'
      );
      expect(result.plannedChanges).toBe(3);
      expect(result.changeSummary).toContain('3 changes planned');
      expect(result.changes).toHaveLength(3);

      // Verify parsed changes
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
    });

    it('should handle no changes scenario', () => {
      const result = parser.parse(SST_DIFF_NO_CHANGES_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.plannedChanges).toBe(0);
      expect(result.changeSummary).toBe('No changes');
      expect(result.changes).toHaveLength(0);
    });

    it('should parse complex diff with cost and breaking changes', () => {
      const result = parser.parse(SST_DIFF_COMPLEX_OUTPUT, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('production');
      expect(result.app).toBe('my-complex-app');
      expect(result.plannedChanges).toBe(6);
      expect(result.changeSummary).toContain('6 changes planned');
      expect(result.changes).toHaveLength(6);

      // Check variety of resource types and actions
      const actions = result.changes.map((c) => c.action);
      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');

      // Check resource types
      const types = result.changes.map((c) => c.type);
      expect(types).toContain('Function');
      expect(types).toContain('Database');
      expect(types).toContain('Api');
      expect(types).toContain('Website');
      expect(types).toContain('Topic');
    });

    it('should handle breaking changes correctly', () => {
      const result = parser.parse(SST_DIFF_BREAKING_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(3);
      expect(result.changeSummary).toContain('3 changes planned');
      expect(result.changes).toHaveLength(3);

      // Verify function runtime change
      const functionChange = result.changes.find((c) => c.type === 'Function');
      expect(functionChange).toEqual({
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
      expect(result.changes).toHaveLength(2);

      // All should be updates
      expect(result.changes.every((c) => c.action === 'update')).toBe(true);
    });

    it('should handle large diff outputs efficiently', () => {
      const startTime = Date.now();
      const result = parser.parse(SST_DIFF_LARGE_OUTPUT, 'production', 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should parse in under 1 second
      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(50);
      expect(result.changes).toHaveLength(50);

      // Verify distribution of changes
      const creates = result.changes.filter((c) => c.action === 'create');
      const updates = result.changes.filter((c) => c.action === 'update');
      const deletes = result.changes.filter((c) => c.action === 'delete');

      expect(creates).toHaveLength(25);
      expect(updates).toHaveLength(15);
      expect(deletes).toHaveLength(10);
    });

    it('should handle mixed resource types', () => {
      const result = parser.parse(
        SST_DIFF_MIXED_RESOURCES_OUTPUT,
        'development',
        0
      );

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(10);
      expect(result.changes).toHaveLength(10);

      // Should have all different resource types
      const uniqueTypes = [...new Set(result.changes.map((c) => c.type))];
      expect(uniqueTypes).toContain('Function');
      expect(uniqueTypes).toContain('Database');
      expect(uniqueTypes).toContain('Topic');
      expect(uniqueTypes).toContain('Queue');
      expect(uniqueTypes).toContain('Api');
      expect(uniqueTypes).toContain('Website');

      // Check detailed changes with parenthetical info
      const dbCreate = result.changes.find(
        (c) => c.type === 'Database' && c.action === 'create'
      );
      expect(dbCreate?.details).toBe('RDS PostgreSQL 14.9');
    });

    it('should handle only additions', () => {
      const result = parser.parse(SST_DIFF_ONLY_ADDITIONS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(4);
      expect(result.changes).toHaveLength(4);
      expect(result.changes.every((c) => c.action === 'create')).toBe(true);
    });

    it('should handle only deletions', () => {
      const result = parser.parse(SST_DIFF_ONLY_DELETIONS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(4);
      expect(result.changes).toHaveLength(4);
      expect(result.changes.every((c) => c.action === 'delete')).toBe(true);
    });

    it('should handle only updates', () => {
      const result = parser.parse(
        SST_DIFF_ONLY_UPDATES_OUTPUT,
        'production',
        0
      );

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(3);
      expect(result.changes).toHaveLength(3);
      expect(result.changes.every((c) => c.action === 'update')).toBe(true);

      // Verify detailed update information
      const functionUpdate = result.changes.find((c) => c.type === 'Function');
      expect(functionUpdate?.details).toBe('timeout: 30s → 60s');
    });

    it('should handle error scenarios gracefully', () => {
      const result = parser.parse(SST_DIFF_ERROR_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('error-app');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('should handle malformed output gracefully', () => {
      const result = parser.parse(SST_DIFF_MALFORMED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
      // Should show error message when exitCode is 1 and contains error patterns
      expect(result.changeSummary).toBe(
        'Diff parsing failed - unable to determine changes'
      );
    });

    it('should handle empty output', () => {
      const result = parser.parse(SST_DIFF_EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
      expect(result.changeSummary).toBe('0 changes planned');
    });

    it('should handle incomplete output', () => {
      const result = parser.parse(SST_DIFF_INCOMPLETE_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.app).toBe('incomplete-app');
      expect(result.plannedChanges).toBe(1);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.action).toBe('create');
    });

    it('should provide consistent result structure', () => {
      const result = parser.parse(SST_DIFF_SUCCESS_OUTPUT, 'staging', 0);

      // All DiffResult properties should be present
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('operation');
      expect(result).toHaveProperty('stage');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('plannedChanges');
      expect(result).toHaveProperty('changeSummary');
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('rawOutput');
      expect(result).toHaveProperty('permalink');
      expect(result).toHaveProperty('completionStatus');
      expect(result).toHaveProperty('truncated');

      // Diff-specific defaults
      expect(result.truncated).toBe(false);
    });
  });

  describe('edge cases and performance', () => {
    it('should handle very large outputs without memory issues', () => {
      // Create a very large diff output
      const largeChanges = Array.from(
        { length: 1000 },
        (_, i) => `+ Function        large-app-test-func-${i + 1}`
      ).join('\n');

      const largeOutput = `
SST Diff
App: performance-test-app
Stage: test

${largeChanges}

1000 changes planned
`;

      const startTime = Date.now();
      const result = parser.parse(largeOutput, 'test', 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(1000);
      expect(result.changes).toHaveLength(1000);
    });

    it('should handle unicode characters in resource names', () => {
      const unicodeOutput = `
SST Diff
App: unicode-app
Stage: test

+ Function        unicode-app-test-函数-handler
~ Api            unicode-app-test-api-配置 (updated)
- Database        unicode-app-test-数据库

3 changes planned
`;

      const result = parser.parse(unicodeOutput, 'test', 0);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(3);
      expect(result.changes?.[0]?.name).toBe('unicode-app-test-函数-handler');
      expect(result.changes?.[1]?.name).toBe('unicode-app-test-api-配置');
      expect(result.changes?.[2]?.name).toBe('unicode-app-test-数据库');
    });

    it('should handle mixed line endings', () => {
      const mixedLineEndings = SST_DIFF_SUCCESS_OUTPUT.replace(/\n/g, '\r\n'); // Convert to Windows line endings

      const result = parser.parse(mixedLineEndings, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.plannedChanges).toBe(3);
      expect(result.changes).toHaveLength(3);
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
