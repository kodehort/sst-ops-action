import type { BaseOperationResult } from "../types/operations";
import { PatternHelpers, SSTPatterns } from "./patterns";

/**
 * Abstract base parser for SST CLI outputs
 * Provides common parsing patterns and utilities for operations that parse CLI output
 *
 * Reads patterns straight from patterns.ts. It used to re-expose them under a
 * second set of names, which meant one pattern could be referred to three
 * ways — by its library name, by the alias, and by whatever private copy a
 * concrete parser had made.
 */
export abstract class OperationParser<T extends BaseOperationResult> {
  /**
   * Abstract method that must be implemented by subclasses
   * @param output Raw SST CLI output
   * @param stage Stage name
   * @param exitCode CLI exit code
   * @returns Parsed operation result
   */
  /**
   * @param truncated Whether the CLI capture hit its size budget. Truncation
   *   is a fact about the capture, not about the text, so the parser is told
   *   rather than trying to infer it.
   */
  abstract parse(
    output: string,
    stage: string,
    exitCode: number,
    truncated: boolean
  ): T;

  /**
   * Parse common information present in all SST CLI outputs
   *
   * Extracts standardized information that appears across all SST operations,
   * including app name, permalink, and completion status. This provides a
   * consistent foundation for operation-specific parsers.
   *
   * @param lines Array of output lines from SST CLI
   * @returns Partial result containing common fields (app, permalink, completionStatus)
   */
  protected parseCommonInfo(lines: string[]): Partial<BaseOperationResult> {
    const fullOutput = lines.join("\n");
    const result: Partial<BaseOperationResult> = {};

    try {
      // Extract app name
      const appMatch = fullOutput.match(SSTPatterns.metadata.app);
      if (appMatch?.[1]) {
        result.app = appMatch[1].trim();
      }

      // Extract permalink
      const permalinkMatch = fullOutput.match(SSTPatterns.metadata.permalink);
      if (permalinkMatch?.[1]) {
        result.permalink = permalinkMatch[1].trim();
      }

      // Extract completion status
      if (SSTPatterns.status.success.test(fullOutput)) {
        result.completionStatus = "complete";
      } else if (SSTPatterns.status.partial.test(fullOutput)) {
        result.completionStatus = "partial";
      } else if (SSTPatterns.status.failed.test(fullOutput)) {
        result.completionStatus = "failed";
      }
    } catch {
      // Parsing is optional - continue without it
    }

    return result;
  }

  /**
   * Split SST CLI output into logical sections for easier processing
   *
   * Divides the CLI output into manageable chunks separated by double newlines.
   * This helps isolate different phases of SST operations (build, deploy, etc.)
   * for more targeted parsing.
   *
   * @param output Raw output string from SST CLI
   * @returns Array of output sections, with empty sections filtered out
   */
  protected splitIntoSections(output: string): string[] {
    try {
      return output.split(SSTPatterns.sections.separator).filter(Boolean);
    } catch {
      // If splitting fails, return the whole output as single section
      return [output];
    }
  }

  /**
   * Clean and normalize text for parsing
   *
   * Standardizes text format by normalizing line endings, removing trailing
   * whitespace, and reducing excessive blank lines. This ensures consistent
   * parsing behavior across different environments and SST versions.
   *
   * Now uses centralized pattern helpers for cleaning
   *
   * @param text Raw text input from SST CLI
   * @returns Cleaned and normalized text ready for pattern matching
   */
  protected cleanText(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    try {
      // Use centralized pattern helpers
      return PatternHelpers.cleanText(text);
    } catch {
      // If cleaning fails, return original text
      return text;
    }
  }

  /**
   * Extract sections based on a start marker pattern
   *
   * Locates a specific marker in the output and returns all content that follows.
   * This is useful for extracting operation-specific content that appears after
   * build phases or status indicators.
   *
   * @param lines Array of output lines to search through
   * @param startPattern Regex pattern that marks the start of the desired section
   * @returns Array of lines from the matching section onwards, or empty array if not found
   */
  protected extractSectionAfterMarker(
    lines: string[],
    startPattern: RegExp
  ): string[] {
    try {
      const startIndex = lines.findIndex((line) => startPattern.test(line));
      return startIndex >= 0 ? lines.slice(startIndex + 1) : [];
    } catch {
      return [];
    }
  }

  /**
   * Count total lines in the output (for debug information)
   * @param output Raw output string
   * @returns Number of lines
   */
  protected countLines(output: string): number {
    if (!output) {
      return 0;
    }
    return output.split("\n").length;
  }

  /**
   * Extract specific pattern matches from output
   * @param output Full output text
   * @param pattern Regex pattern to match
   * @returns Array of match objects
   */
  protected extractMatches(
    output: string,
    pattern: RegExp
  ): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];

    try {
      if (!pattern?.source) {
        return matches;
      }

      // Ensure global flag is set, avoid duplicate 'g' flags
      const flags = pattern.flags.includes("g")
        ? pattern.flags
        : pattern.flags + "g";
      const globalPattern = new RegExp(pattern.source, flags);
      let match: RegExpMatchArray | null;

      // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
      while ((match = globalPattern.exec(output)) !== null) {
        matches.push(match);
      }
    } catch {
      // If regex execution fails, return empty array
    }

    return matches;
  }

  /**
   * Extract resource information from output lines
   *
   * Identifies and extracts lines that match the SST resource format (pipe-prefixed).
   * These typically contain information about deployed infrastructure components
   * like functions, APIs, and storage resources.
   *
   * @param lines Array of output lines to filter
   * @returns Array of resource entries with pipe prefixes removed
   */
  protected extractResourceLines(lines: string[]): string[] {
    return lines
      .filter((line) => SSTPatterns.resources.line.test(line))
      .map((line) => {
        const match = line.match(SSTPatterns.resources.line);
        return match?.[1] ? match[1].trim() : line;
      });
  }

  /**
   * Extract URL information from output lines (legacy pattern matching)
   *
   * Parses lines containing URL information for deployed services.
   * Recognizes different URL types (Router, Api, Web, Website) and extracts
   * both the type and URL for structured access to deployed endpoints.
   * Note: This method is used for backward compatibility with direct URL parsing.
   *
   * @param lines Array of output lines to parse
   * @returns Array of URL entries with type and url properties
   */
  protected extractUrlLines(
    lines: string[]
  ): Array<{ type: string; url: string }> {
    return lines
      .map((line) => {
        const match = line.match(SSTPatterns.outputs.url);
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
    } catch {
      return null;
    }
  }

  /**
   * Check if output indicates a successful operation
   *
   * Determines operation success by examining both the process exit code and
   * output content for failure indicators. Uses a conservative approach where
   * partial completion is considered successful with warnings.
   *
   * @param output Raw output text to analyze for failure patterns
   * @param exitCode Process exit code (0 = success, non-zero = failure)
   * @returns True if operation appears successful, false otherwise
   */
  protected isSuccessfulOperation(output: string, exitCode: number): boolean {
    // Primary indicator: exit code
    if (exitCode !== 0) {
      return false;
    }

    // Secondary indicators: completion status patterns
    if (SSTPatterns.status.failed.test(output)) {
      return false;
    }

    // Partial completion is considered successful with warnings
    return true;
  }

  /**
   * Extract the diff section from the full SST output
   *
   * Isolates the actual diff content by skipping build and preparation phases.
   * Looks for the "✓ Generated" marker that indicates the start of diff output,
   * providing clean diff content for formatting and analysis.
   *
   * @param output Raw output from SST diff command
   * @returns Diff section content, or original output if marker not found
   */
  protected extractDiffSection(output: string): string {
    const lines = output.split("\n");
    let diffStartIndex = -1;

    // Find the "✓ Generated" marker
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line && SSTPatterns.sections.generated.test(line)) {
        diffStartIndex = i + 1; // Start after the marker line
        break;
      }
    }

    // If we found the marker, return everything after it
    if (diffStartIndex >= 0 && diffStartIndex < lines.length) {
      return lines.slice(diffStartIndex).join("\n").trim();
    }

    // Fallback: return original output if no marker found
    return output;
  }
}
