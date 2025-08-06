import type { BaseOperationResult } from '../types/operations';

/**
 * Abstract base parser for SST CLI outputs
 * Provides common parsing patterns and utilities shared across all operation types
 */
export abstract class BaseParser<T extends BaseOperationResult> {
  /**
   * Common regex patterns for extracting information from SST outputs
   */
  protected readonly patterns = {
    // App and stage information
    APP_INFO: /^App:\s+(.+)$/m,
    STAGE_INFO: /^Stage:\s+(.+)$/m,

    // Permalink for SST console
    PERMALINK: /^(?:↗\s+)?Permalink:?\s+(https?:\/\/.+)$/m,

    // Completion status patterns
    COMPLETION_SUCCESS: /^✓\s+Complete\s*$/m,
    COMPLETION_PARTIAL: /^⚠\s+Partial\s*$/m,
    COMPLETION_FAILED: /^✗\s+Failed\s*$/m,

    // Duration and timing
    DURATION: /^Duration:\s+(\d+)s$/m,

    // Generic resource patterns (to be extended by subclasses)
    RESOURCE_LINE: /^\|\s+(.+)$/m,
    URL_LINE: /^\s*(Router|Api|Web|Website):\s+(https?:\/\/.+)$/m,
  };

  /**
   * Abstract method that must be implemented by subclasses
   * @param output Raw SST CLI output
   * @param stage Stage name
   * @param exitCode CLI exit code
   * @returns Parsed operation result
   */
  abstract parse(output: string, stage: string, exitCode: number): T;

  /**
   * Parse common information present in all SST outputs
   * @param lines Output lines
   * @returns Partial result with common fields
   */
  protected parseCommonInfo(lines: string[]): Partial<BaseOperationResult> {
    const fullOutput = lines.join('\n');
    const result: Partial<BaseOperationResult> = {};

    try {
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
      }

      // Note: Duration is not part of BaseOperationResult type currently
      // Can be added to specific operation result types as needed
    } catch (_error) {}

    return result;
  }

  /**
   * Split SST output into logical sections for easier processing
   * @param output Raw output string
   * @returns Array of output sections
   */
  protected splitIntoSections(output: string): string[] {
    try {
      // Split by double newlines (common SST section separator)
      const sections = output
        .split(/\n\n+/)
        .map((section) => section.trim())
        .filter((section) => section.length > 0);

      return sections;
    } catch (_error) {
      return [output];
    }
  }

  /**
   * Extract resource information from output lines
   * @param lines Output lines
   * @returns Array of resource entries
   */
  protected extractResourceLines(lines: string[]): string[] {
    return lines
      .filter((line) => this.patterns.RESOURCE_LINE.test(line))
      .map((line) => {
        const match = line.match(this.patterns.RESOURCE_LINE);
        return match?.[1] ? match[1].trim() : line;
      });
  }

  /**
   * Extract URL information from output lines
   * @param lines Output lines
   * @returns Array of URL entries
   */
  protected extractUrlLines(
    lines: string[]
  ): Array<{ type: string; url: string }> {
    return lines
      .map((line) => {
        const match = line.match(this.patterns.URL_LINE);
        if (match?.[1] && match?.[2]) {
          return {
            type: match[1].toLowerCase(),
            url: match[2].trim(),
          };
        }
        return null;
      })
      .filter(
        (entry): entry is { type: string; url: string } => entry !== null
      );
  }

  /**
   * Safely extract first match from regex pattern
   * @param text Text to search
   * @param pattern Regex pattern
   * @returns First capture group or null
   */
  protected safeExtract(text: string, pattern: RegExp): string | null {
    try {
      const match = text.match(pattern);
      return match?.[1] ? match[1].trim() : null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check if output indicates a successful operation
   * @param output Raw output
   * @param exitCode CLI exit code
   * @returns True if operation appears successful
   */
  protected isSuccessfulOperation(output: string, exitCode: number): boolean {
    // Primary indicator: exit code
    if (exitCode !== 0) {
      return false;
    }

    // Secondary indicators: completion status patterns
    if (this.patterns.COMPLETION_FAILED.test(output)) {
      return false;
    }

    // Partial completion is considered successful with warnings
    return true;
  }

  /**
   * Clean and normalize text output
   * @param text Raw text
   * @returns Cleaned text
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\s+$/, '') // Remove trailing whitespace
      .trim();
  }
}

/**
 * Parsed section interface for structured output processing
 */
export interface ParsedSection {
  type: 'header' | 'resources' | 'urls' | 'summary' | 'unknown';
  content: string;
  lines: string[];
}

/**
 * Utility function to create a parsed section
 */
export function createParsedSection(
  type: ParsedSection['type'],
  content: string
): ParsedSection {
  return {
    type,
    content: content.trim(),
    lines: content
      .trim()
      .split('\n')
      .map((line) => line.trim()),
  };
}
