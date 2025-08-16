import { beforeEach, describe, expect, it } from 'vitest';
import type { BaseOperationResult } from '../../src/types/operations';
import {
  EMPTY_OUTPUT,
  INCOMPLETE_OUTPUT,
  MALFORMED_OUTPUT,
  SST_DEPLOY_FAILURE_OUTPUT,
  SST_DEPLOY_PARTIAL_OUTPUT,
  SST_DEPLOY_SUCCESS_OUTPUT,
} from '../fixtures/sst-outputs';

// Top-level regex patterns for performance - updated for SST v3 format
const APP_INFO_PATTERN = /^(?:➜\s+)?App:\s+(.+)$/m;
const STAGE_INFO_PATTERN = /^\s*Stage:\s+(.+)$/m;
const PERMALINK_PATTERN = /^(?:↗\s+)?Permalink:?\s+(https?:\/\/.+)$/m;
const COMPLETION_SUCCESS_PATTERN = /^✓\s+Complete\s*$/m;
const COMPLETION_PARTIAL_PATTERN = /^⚠\s+Partial\s*$/m;
const COMPLETION_FAILED_PATTERN = /^✗\s+Failed\s*$/m;
const SECTION_SPLIT_PATTERN = /\n\n+/;
const LINE_ENDING_PATTERN = /\r?\n/;

// Mock implementation for testing the abstract base parser
class TestParser {
  protected readonly patterns = {
    APP_INFO: APP_INFO_PATTERN,
    STAGE_INFO: STAGE_INFO_PATTERN,
    PERMALINK: PERMALINK_PATTERN,
    COMPLETION_SUCCESS: COMPLETION_SUCCESS_PATTERN,
    COMPLETION_PARTIAL: COMPLETION_PARTIAL_PATTERN,
    COMPLETION_FAILED: COMPLETION_FAILED_PATTERN,
  };

  parse(output: string, stage: string, exitCode: number): BaseOperationResult {
    const commonInfo = this.parseCommonInfo(output.split('\n'));

    return {
      success: exitCode === 0,
      operation: 'deploy',
      stage,
      exitCode,
      app: commonInfo.app || '',
      completionStatus: commonInfo.completionStatus || 'failed',
      permalink: commonInfo.permalink || '',
      truncated: false,
      rawOutput: output,
    };
  }

  protected parseCommonInfo(lines: string[]): Partial<BaseOperationResult> {
    const fullOutput = lines.join('\n');
    const result: Partial<BaseOperationResult> = {};

    // Extract app name
    const appMatch = fullOutput.match(this.patterns.APP_INFO);
    if (appMatch?.[1]) {
      result.app = appMatch[1].trim();
    }

    // Extract permalink
    const permalinkMatch = fullOutput.match(this.patterns.PERMALINK);
    if (permalinkMatch?.[1]) {
      result.permalink = permalinkMatch[1].trim();
    }

    // Extract completion status
    if (this.patterns.COMPLETION_SUCCESS.test(fullOutput)) {
      result.completionStatus = 'complete';
    } else if (this.patterns.COMPLETION_PARTIAL.test(fullOutput)) {
      result.completionStatus = 'partial';
    } else if (this.patterns.COMPLETION_FAILED.test(fullOutput)) {
      result.completionStatus = 'failed';
    } else {
      result.completionStatus = 'failed';
    }

    return result;
  }

  protected splitIntoSections(output: string): string[] {
    // Split by double newlines or specific SST section markers
    const sections = output
      .split(SECTION_SPLIT_PATTERN)
      .filter((section) => section.trim().length > 0);
    return sections;
  }

  // Test utilities - expose protected methods for testing
  testParseCommonInfo(lines: string[]): Partial<BaseOperationResult> {
    return this.parseCommonInfo(lines);
  }

  testSplitIntoSections(output: string): string[] {
    return this.splitIntoSections(output);
  }
}

describe('Base Parser - Common Output Processing', () => {
  let parser: TestParser;

  beforeEach(() => {
    parser = new TestParser();
  });

  describe('Pattern Matching', () => {
    it('should extract app name from SST output', () => {
      const result = parser.testParseCommonInfo(
        SST_DEPLOY_SUCCESS_OUTPUT.split('\n')
      );
      expect(result.app).toBe('www-kodehort-com');
    });

    it('should extract permalink from SST output', () => {
      const result = parser.testParseCommonInfo(
        SST_DEPLOY_SUCCESS_OUTPUT.split('\n')
      );
      expect(result.permalink).toBe('https://sst.dev/u/1a3e112e');
    });

    it('should detect successful completion status', () => {
      const result = parser.testParseCommonInfo(
        SST_DEPLOY_SUCCESS_OUTPUT.split('\n')
      );
      expect(result.completionStatus).toBe('complete');
    });

    it('should detect partial completion status', () => {
      const result = parser.testParseCommonInfo(
        SST_DEPLOY_PARTIAL_OUTPUT.split('\n')
      );
      expect(result.completionStatus).toBe('partial');
    });

    it('should detect failed completion status', () => {
      const result = parser.testParseCommonInfo(
        SST_DEPLOY_FAILURE_OUTPUT.split('\n')
      );
      expect(result.completionStatus).toBe('failed');
    });

    it('should handle unknown completion status for malformed output', () => {
      const result = parser.testParseCommonInfo(MALFORMED_OUTPUT.split('\n'));
      expect(result.completionStatus).toBe('failed');
    });

    it('should handle missing app name gracefully', () => {
      const outputWithoutApp = 'Stage: staging\n✓ Complete';
      const result = parser.testParseCommonInfo(outputWithoutApp.split('\n'));
      expect(result.app).toBeUndefined();
    });

    it('should handle missing permalink gracefully', () => {
      const outputWithoutPermalink = 'App: my-app\n✓ Complete';
      const result = parser.testParseCommonInfo(
        outputWithoutPermalink.split('\n')
      );
      expect(result.permalink).toBeUndefined();
    });
  });

  describe('Section Splitting', () => {
    it('should split output into logical sections', () => {
      const sections = parser.testSplitIntoSections(SST_DEPLOY_SUCCESS_OUTPUT);
      expect(sections.length).toBeGreaterThan(1);
      expect(sections[0]).toContain('SST 3.17.10');
    });

    it('should handle output with no clear sections', () => {
      const singleLineOutput = 'SST Deploy Complete';
      const sections = parser.testSplitIntoSections(singleLineOutput);
      expect(sections).toEqual(['SST Deploy Complete']);
    });

    it('should filter out empty sections', () => {
      const outputWithEmptySections = 'Section 1\n\n\n\nSection 2\n\n';
      const sections = parser.testSplitIntoSections(outputWithEmptySections);
      expect(sections).toEqual(['Section 1', 'Section 2']);
    });

    it('should handle empty output', () => {
      const sections = parser.testSplitIntoSections(EMPTY_OUTPUT);
      expect(sections).toEqual([]);
    });
  });

  describe('Parse Method Integration', () => {
    it('should successfully parse valid SST deploy output', () => {
      const result = parser.parse(SST_DEPLOY_SUCCESS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.exitCode).toBe(0);
      expect(result.app).toBe('www-kodehort-com');
      expect(result.completionStatus).toBe('complete');
      expect(result.permalink).toBe('https://sst.dev/u/1a3e112e');
      expect(result.truncated).toBe(false);
    });

    it('should handle failed deployment with non-zero exit code', () => {
      const result = parser.parse(SST_DEPLOY_FAILURE_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.completionStatus).toBe('failed');
      expect(result.app).toBe('kodehort-scratch');
    });

    it('should handle partial deployment gracefully', () => {
      const result = parser.parse(SST_DEPLOY_PARTIAL_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.completionStatus).toBe('partial');
      expect(result.app).toBe('partial-app');
    });

    it('should handle malformed output without throwing', () => {
      expect(() => {
        const result = parser.parse(MALFORMED_OUTPUT, 'staging', 1);
        expect(result.completionStatus).toBe('failed');
        expect(result.success).toBe(false);
      }).not.toThrow();
    });

    it('should handle empty output without throwing', () => {
      expect(() => {
        const result = parser.parse(EMPTY_OUTPUT, 'staging', 1);
        expect(result.completionStatus).toBe('failed');
        expect(result.success).toBe(false);
      }).not.toThrow();
    });

    it('should handle incomplete output gracefully', () => {
      const result = parser.parse(INCOMPLETE_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.app).toBe('my-sst-app');
      expect(result.completionStatus).toBe('complete');
    });
  });

  describe('Error Handling', () => {
    it('should not throw on invalid regex patterns', () => {
      expect(() => {
        parser.testParseCommonInfo(['Invalid input with special chars: $#@!']);
      }).not.toThrow();
    });

    it('should handle very long output strings', () => {
      const longOutput = `${'A'.repeat(100_000)}\nApp: test-app\n✓ Complete`;
      expect(() => {
        const result = parser.testParseCommonInfo(longOutput.split('\n'));
        expect(result.app).toBe('test-app');
      }).not.toThrow();
    });

    it('should handle output with unusual line endings', () => {
      const windowsOutput = 'App: test-app\r\n✓ Complete\r\n';
      const result = parser.testParseCommonInfo(
        windowsOutput.split(LINE_ENDING_PATTERN)
      );
      expect(result.app).toBe('test-app');
      expect(result.completionStatus).toBe('complete');
    });
  });

  describe('Performance', () => {
    it('should parse large outputs efficiently', () => {
      const startTime = Date.now();
      const largeOutput = SST_DEPLOY_SUCCESS_OUTPUT.repeat(100);

      parser.parse(largeOutput, 'staging', 0);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
