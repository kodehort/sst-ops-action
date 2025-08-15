import { beforeEach, describe, expect, it } from 'vitest';
import { OperationParser } from '@/parsers/operation-parser';
import type { BaseOperationResult } from '@/types/operations';

// Concrete implementation for testing the abstract OperationParser
class TestOperationParser extends OperationParser<BaseOperationResult> {
  parse(output: string, stage: string, exitCode: number): BaseOperationResult {
    const lines = output.split('\n');
    const commonInfo = this.parseCommonInfo(lines);

    return {
      success: this.isSuccessfulOperation(output, exitCode),
      operation: 'test' as any,
      stage,
      app: commonInfo.app || 'test-app',
      rawOutput: output,
      exitCode,
      truncated: false,
      completionStatus: commonInfo.completionStatus || 'failed',
      ...commonInfo,
    };
  }

  // Expose protected methods for testing
  testCleanText(text: string): string {
    return this.cleanText(text);
  }

  testExtractSectionAfterMarker(
    lines: string[],
    startPattern: RegExp
  ): string[] {
    return this.extractSectionAfterMarker(lines, startPattern);
  }

  testCountLines(output: string): number {
    return this.countLines(output);
  }

  testExtractMatches(output: string, pattern: RegExp): RegExpMatchArray[] {
    return this.extractMatches(output, pattern);
  }

  testExtractResourceLines(lines: string[]): string[] {
    return this.extractResourceLines(lines);
  }

  testExtractUrlLines(lines: string[]): Array<{ type: string; url: string }> {
    return this.extractUrlLines(lines);
  }

  testSafeExtract(text: string, pattern: RegExp): string | null {
    return this.safeExtract(text, pattern);
  }

  testIsSuccessfulOperation(output: string, exitCode: number): boolean {
    return this.isSuccessfulOperation(output, exitCode);
  }

  testExtractDiffSection(output: string): string {
    return this.extractDiffSection(output);
  }

  testSplitIntoSections(output: string): string[] {
    return this.splitIntoSections(output);
  }

  testParseCommonInfo(lines: string[]): Partial<BaseOperationResult> {
    return this.parseCommonInfo(lines);
  }
}

describe('OperationParser', () => {
  let parser: TestOperationParser;

  beforeEach(() => {
    parser = new TestOperationParser();
  });

  describe('cleanText', () => {
    it('should normalize line endings', () => {
      const input = 'line1\r\nline2\r\nline3';
      const result = parser.testCleanText(input);
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should remove trailing whitespace from lines', () => {
      const input = 'line1   \nline2\t\nline3  ';
      const result = parser.testCleanText(input);
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should remove excessive blank lines', () => {
      const input = 'line1\n\n\n\nline2\n\n\n\nline3';
      const result = parser.testCleanText(input);
      expect(result).toBe('line1\n\nline2\n\nline3');
    });

    it('should handle empty string', () => {
      const result = parser.testCleanText('');
      expect(result).toBe('');
    });

    it('should handle null input gracefully', () => {
      const result = parser.testCleanText(null as any);
      expect(result).toBe('');
    });

    it('should handle non-string input gracefully', () => {
      const result = parser.testCleanText(123 as any);
      expect(result).toBe('');
    });

    it('should handle text cleaning errors gracefully', () => {
      // Mock a scenario where regex operations might fail
      const originalReplace = String.prototype.replace;
      String.prototype.replace = () => {
        throw new Error('Regex error');
      };

      const input = 'test text';
      const result = parser.testCleanText(input);
      expect(result).toBe(input); // Should return original text on error

      // Restore original function
      String.prototype.replace = originalReplace;
    });
  });

  describe('extractSectionAfterMarker', () => {
    it('should extract lines after marker pattern', () => {
      const lines = ['header', '✓ Generated', 'content1', 'content2'];
      const pattern = /^✓\s+Generated\s*$/;
      const result = parser.testExtractSectionAfterMarker(lines, pattern);
      expect(result).toEqual(['content1', 'content2']);
    });

    it('should return empty array when marker not found', () => {
      const lines = ['header', 'content1', 'content2'];
      const pattern = /^✓\s+Generated\s*$/;
      const result = parser.testExtractSectionAfterMarker(lines, pattern);
      expect(result).toEqual([]);
    });

    it('should handle marker at end of lines', () => {
      const lines = ['header', 'content1', '✓ Generated'];
      const pattern = /^✓\s+Generated\s*$/;
      const result = parser.testExtractSectionAfterMarker(lines, pattern);
      expect(result).toEqual([]);
    });

    it('should handle regex errors gracefully', () => {
      const lines = ['test line'];
      const invalidPattern = null as any;
      const result = parser.testExtractSectionAfterMarker(
        lines,
        invalidPattern
      );
      expect(result).toEqual([]);
    });
  });

  describe('countLines', () => {
    it('should count lines correctly', () => {
      const output = 'line1\nline2\nline3';
      const result = parser.testCountLines(output);
      expect(result).toBe(3);
    });

    it('should handle empty string', () => {
      const result = parser.testCountLines('');
      expect(result).toBe(0);
    });

    it('should handle single line', () => {
      const result = parser.testCountLines('single line');
      expect(result).toBe(1);
    });

    it('should handle null input', () => {
      const result = parser.testCountLines(null as any);
      expect(result).toBe(0);
    });
  });

  describe('extractMatches', () => {
    it('should extract all matches from global regex', () => {
      const output = 'func1() and func2() and func3()';
      const pattern = /func\d+\(\)/g;
      const result = parser.testExtractMatches(output, pattern);
      expect(result).toHaveLength(3);
      expect(result[0]?.[0]).toBe('func1()');
      expect(result[1]?.[0]).toBe('func2()');
      expect(result[2]?.[0]).toBe('func3()');
    });

    it('should handle pattern with capture groups', () => {
      const output =
        'Resource: Lambda, Type: Function, Resource: S3, Type: Bucket';
      const pattern = /Resource:\s*([^,]+)/g;
      const result = parser.testExtractMatches(output, pattern);
      expect(result).toHaveLength(2);
      expect(result[0]?.[1]).toBe('Lambda');
      expect(result[1]?.[1]).toBe('S3');
    });

    it('should return empty array when no matches', () => {
      const output = 'no matches here';
      const pattern = /func\d+\(\)/g;
      const result = parser.testExtractMatches(output, pattern);
      expect(result).toEqual([]);
    });

    it('should handle regex execution errors gracefully', () => {
      const output = 'test text';
      const invalidPattern = null as any;
      const result = parser.testExtractMatches(output, invalidPattern);
      expect(result).toEqual([]);
    });
  });

  describe('extractResourceLines', () => {
    it('should extract lines matching resource pattern', () => {
      const lines = [
        'Header line',
        '| Function: handler',
        '| Bucket: assets',
        'Footer line',
        '| Table: users',
      ];
      const result = parser.testExtractResourceLines(lines);
      expect(result).toEqual([
        'Function: handler',
        'Bucket: assets',
        'Table: users',
      ]);
    });

    it('should handle malformed resource lines', () => {
      const lines = ['| incomplete line', '|', '| valid: resource'];
      const result = parser.testExtractResourceLines(lines);
      expect(result).toEqual(['incomplete line', 'valid: resource']);
    });

    it('should return empty array when no resource lines', () => {
      const lines = ['normal line', 'another line'];
      const result = parser.testExtractResourceLines(lines);
      expect(result).toEqual([]);
    });
  });

  describe('extractUrlLines', () => {
    it('should extract URL information from lines', () => {
      const lines = [
        'Router: https://api.example.com',
        'Web: https://web.example.com',
        'Api: https://api2.example.com',
        'normal line',
      ];
      const result = parser.testExtractUrlLines(lines);
      expect(result).toEqual([
        { type: 'router', url: 'https://api.example.com' },
        { type: 'web', url: 'https://web.example.com' },
        { type: 'api', url: 'https://api2.example.com' },
      ]);
    });

    it('should handle malformed URL lines', () => {
      const lines = ['Router:', 'Web: ', 'Api: https://valid.com'];
      const result = parser.testExtractUrlLines(lines);
      expect(result).toEqual([{ type: 'api', url: 'https://valid.com' }]);
    });

    it('should return empty array when no URL lines', () => {
      const lines = ['normal line', 'another line'];
      const result = parser.testExtractUrlLines(lines);
      expect(result).toEqual([]);
    });
  });

  describe('safeExtract', () => {
    it('should extract capture group from pattern', () => {
      const text = 'App: my-application';
      const pattern = /App:\s+(.+)/;
      const result = parser.testSafeExtract(text, pattern);
      expect(result).toBe('my-application');
    });

    it('should return null when no match', () => {
      const text = 'no match here';
      const pattern = /App:\s+(.+)/;
      const result = parser.testSafeExtract(text, pattern);
      expect(result).toBe(null);
    });

    it('should return null when no capture group', () => {
      const text = 'App: my-application';
      const pattern = /App:/; // No capture group
      const result = parser.testSafeExtract(text, pattern);
      expect(result).toBe(null);
    });

    it('should trim extracted text', () => {
      const text = 'App:   my-application   ';
      const pattern = /App:\s*(.+)/;
      const result = parser.testSafeExtract(text, pattern);
      expect(result).toBe('my-application');
    });

    it('should handle regex errors gracefully', () => {
      const text = 'test text';
      const invalidPattern = null as any;
      const result = parser.testSafeExtract(text, invalidPattern);
      expect(result).toBe(null);
    });
  });

  describe('isSuccessfulOperation', () => {
    it('should return false for non-zero exit code', () => {
      const result = parser.testIsSuccessfulOperation('✓ Complete', 1);
      expect(result).toBe(false);
    });

    it('should return false when output contains failed pattern', () => {
      const result = parser.testIsSuccessfulOperation('✗ Failed', 0);
      expect(result).toBe(false);
    });

    it('should return true for zero exit code without failed pattern', () => {
      const result = parser.testIsSuccessfulOperation('✓ Complete', 0);
      expect(result).toBe(true);
    });

    it('should return true for partial completion', () => {
      const result = parser.testIsSuccessfulOperation('⚠ Partial', 0);
      expect(result).toBe(true);
    });
  });

  describe('extractDiffSection', () => {
    it('should extract content after "✓ Generated" marker', () => {
      const output = `Building...
✓ Generated
diff content here
more diff content`;
      const result = parser.testExtractDiffSection(output);
      expect(result).toBe('diff content here\nmore diff content');
    });

    it('should return original output when marker not found', () => {
      const output = 'no marker here\ndiff content';
      const result = parser.testExtractDiffSection(output);
      expect(result).toBe(output);
    });

    it('should handle marker at end of output', () => {
      const output = 'Building...\n✓ Generated';
      const result = parser.testExtractDiffSection(output);
      expect(result).toBe('Building...\n✓ Generated'); // Returns original when marker is at end
    });

    it('should handle empty lines after marker', () => {
      const output = 'Building...\n✓ Generated\n\n\ndiff content';
      const result = parser.testExtractDiffSection(output);
      expect(result).toBe('diff content'); // trim() removes leading whitespace
    });
  });

  describe('splitIntoSections', () => {
    it('should split output into sections by double newlines', () => {
      const output = 'section1\n\nsection2\n\nsection3';
      const result = parser.testSplitIntoSections(output);
      expect(result).toEqual(['section1', 'section2', 'section3']);
    });

    it('should filter out empty sections', () => {
      const output = 'section1\n\n\nsection2\n\n';
      const result = parser.testSplitIntoSections(output);
      expect(result).toEqual(['section1', 'section2']);
    });

    it('should handle splitting errors gracefully', () => {
      // Mock split to throw error
      const originalSplit = String.prototype.split;
      String.prototype.split = () => {
        throw new Error('Split error');
      };

      const output = 'test output';
      const result = parser.testSplitIntoSections(output);
      expect(result).toEqual([output]);

      // Restore original function
      String.prototype.split = originalSplit;
    });
  });

  describe('parseCommonInfo error handling', () => {
    it('should handle parsing errors gracefully', () => {
      // Test with malformed input that might cause regex issues
      const lines = ['Invalid input with null bytes \0', 'App: test'];
      const result = parser.testParseCommonInfo(lines);
      expect(result).toBeDefined();
      expect(result.app).toBe('test');
    });

    it('should handle very large input arrays', () => {
      const lines = new Array(10_000).fill('test line');
      lines.push('App: large-app');
      const result = parser.testParseCommonInfo(lines);
      expect(result.app).toBe('large-app');
    });
  });

  describe('integration with parse method', () => {
    it('should use all utility methods correctly', () => {
      const output = `SST Deploy
✓ Generated

App: integration-test
Stage: production
✓ Complete
Permalink: https://console.sst.dev/123

| Function: handler
| Bucket: assets
Router: https://api.example.com`;

      const result = parser.parse(output, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.app).toBe('integration-test');
      expect(result.stage).toBe('production');
      expect(result.completionStatus).toBe('complete');
    });

    it('should handle error conditions in parse method', () => {
      const malformedOutput = 'Invalid\0output\nwith\x00null\nbytes';
      const result = parser.parse(malformedOutput, 'test', 1);

      expect(result.success).toBe(false);
      expect(result.stage).toBe('test');
      expect(result.exitCode).toBe(1);
    });
  });
});
