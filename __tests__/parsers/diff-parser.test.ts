import {
  EMPTY_OUTPUT,
  MALFORMED_OUTPUT,
  SST_DIFF_ERROR_OUTPUT,
  SST_DIFF_NO_CHANGES_OUTPUT,
  SST_DIFF_REAL_WORLD_OUTPUT,
  SST_DIFF_SUCCESS_OUTPUT,
} from '@tests/fixtures/sst-outputs';
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
        name: 'NewHandler',
        action: 'create',
        details: undefined,
      });
      expect(result.changes[1]).toEqual({
        type: 'Api',
        name: 'Api',
        action: 'update',
        details: undefined,
      });
      expect(result.changes[2]).toEqual({
        type: 'StaticSite',
        name: 'Website',
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

    it('should parse real world SST output with environment variables', () => {
      const result = parser.parse(SST_DIFF_REAL_WORLD_OUTPUT, 'dev', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('dev');
      expect(result.app).toBe('kodehort-scratch');
      expect(result.permalink).toBe('https://sst.dev/u/31550ec5');

      // Should capture exactly one main resource change (the Web component)
      expect(result.plannedChanges).toBe(1);
      expect(result.changes.length).toBe(1);
      expect(result.changeSummary).toBe('1 changes planned');

      // Should find the Web resource with environment changes
      const webChange = result.changes.find(
        (c) => c.type === 'Astro' && c.name === 'Web'
      );
      expect(webChange).toBeDefined();
      expect(webChange?.action).toBe('create');
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
      const result = parser.parse(MALFORMED_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
      // Malformed output with exit code 1 still shows planned changes count
      expect(result.changeSummary).toBe('0 changes planned');
    });

    it('should handle empty output', () => {
      const result = parser.parse(EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success
      expect(result.operation).toBe('diff');
      expect(result.stage).toBe('staging');
      expect(result.plannedChanges).toBe(0);
      expect(result.changes).toHaveLength(0);
      expect(result.changeSummary).toBe('0 changes planned');
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

  describe('edge cases', () => {
    it('should handle unicode characters in resource names', () => {
      const unicodeOutput = `
SST 3.17.4  ready!

➜  App:        unicode-app
   Stage:      test

~  Diff

↗  Permalink   https://console.sst.dev/unicode-app/test/diffs/unicode123

✓  Generated

+  unicode-app-test pulumi:pulumi:Stack

+  函数Handler sst:aws:Function

*  ApiConfig配置 sst:aws:Api

-  数据库Database sst:aws:Aurora
`;

      const result = parser.parse(unicodeOutput, 'test', 0);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(3);
      expect(result.changes?.[0]?.name).toBe('函数Handler');
      expect(result.changes?.[1]?.name).toBe('ApiConfig配置');
      expect(result.changes?.[2]?.name).toBe('数据库Database');
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
