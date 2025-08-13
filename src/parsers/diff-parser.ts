import type { DiffResult } from '../types/operations';
import { OperationParser } from './operation-parser';

/**
 * Diff-specific regex patterns for parsing planned changes
 * Based on real SST diff output format
 */
const DIFF_PATTERNS = {
  // Planned changes patterns - real SST format
  PLANNED_CREATE: /^\+\s+(.+?)(?:\s+→\s+(.+))?$/,
  PLANNED_UPDATE: /^\*\s+(.+?)(?:\s+→\s+(.+))?$/,
  PLANNED_DELETE: /^-\s+(.+?)(?:\s+→\s+(.+))?$/,

  NO_CHANGES: /^No changes$/m,
  ERROR_MESSAGE: /^Error:\s*(.+)$/m,
  DIFF_FAILED: /Unable to generate diff|Permission denied|Error parsing/i,
} as const;

/**
 * Parser for SST diff operation outputs
 * Extracts planned infrastructure changes without deploying
 */
export class DiffParser extends OperationParser<DiffResult> {
  /**
   * Diff-specific regex patterns for parsing planned changes
   */
  private readonly diffPatterns = DIFF_PATTERNS;

  /**
   * Parse SST diff output and extract planned changes
   */
  parse(output: string, stage: string, exitCode: number): DiffResult {
    // Handle null/undefined input gracefully
    const processedOutput = this.cleanText(output || '');
    const lines = processedOutput.split('\n');

    // Parse common information from base parser (uses full output for header info)
    const commonInfo = this.parseCommonInfo(lines);

    // Extract only the diff section for parsing changes
    const diffSection = this.extractDiffSection(processedOutput);

    // Determine success based on exit code and error patterns
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    // Parse diff-specific information from the diff section
    const changes = this.parsePlannedChanges(diffSection);
    const plannedChanges = changes.length;
    const changeSummary = this.generateChangeSummary(
      diffSection,
      plannedChanges,
      exitCode
    );

    // Build result with all required properties
    const result: DiffResult = {
      // Base operation result properties
      success,
      operation: 'diff',
      stage,
      exitCode,
      app: commonInfo.app || 'unknown-app',
      rawOutput: processedOutput,
      permalink: commonInfo.permalink || '',
      completionStatus: commonInfo.completionStatus || 'complete',
      truncated: false,

      // Diff-specific properties
      plannedChanges,
      changeSummary,
      changes,
    };

    return result;
  }

  /**
   * Parse planned changes from diff output
   * Only count top-level resources, not child resources (those with →)
   */
  private parsePlannedChanges(output: string): Array<{
    type: string;
    name: string;
    action: 'create' | 'update' | 'delete';
    details?: string;
  }> {
    const lines = output.split('\n');
    const changes: Array<{
      type: string;
      name: string;
      action: 'create' | 'update' | 'delete';
      details?: string;
    }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip child resources (those with → arrow) to avoid double counting
      if (trimmedLine.includes('→')) {
        continue;
      }

      const change = this.parseChangeFromLine(trimmedLine);
      if (change) {
        // Skip stack resources and operation headers as they're not meaningful for change counts
        if (change.type === 'Stack' || change.name === 'Diff') {
          continue;
        }
        changes.push(change);
      }
    }

    return changes;
  }

  /**
   * Parse a single change from a diff line
   */
  private parseChangeFromLine(line: string): {
    type: string;
    name: string;
    action: 'create' | 'update' | 'delete';
    details?: string;
  } | null {
    const patterns = [
      { regex: this.diffPatterns.PLANNED_CREATE, action: 'create' as const },
      { regex: this.diffPatterns.PLANNED_UPDATE, action: 'update' as const },
      { regex: this.diffPatterns.PLANNED_DELETE, action: 'delete' as const },
    ];

    for (const { regex, action } of patterns) {
      const match = line.match(regex);
      if (match?.[1]) {
        // Extract resource name and type from the full resource identifier
        const resourceIdentifier = match[1].trim();
        const { name, type } = this.parseResourceIdentifier(resourceIdentifier);

        return {
          type,
          name,
          action,
          ...(match[2] && { details: match[2] }),
        };
      }
    }

    return null;
  }

  /**
   * Parse resource identifier to extract name and type
   * Handles formats like "NewHandler sst:aws:Function" or "my-app-staging pulumi:pulumi:Stack"
   */
  private parseResourceIdentifier(identifier: string): {
    name: string;
    type: string;
  } {
    // Split by space - last part should be the resource type
    const parts = identifier.trim().split(' ');

    if (parts.length >= 2) {
      // Join all parts except the last one as the name
      const name = parts.slice(0, -1).join(' ');
      const typeString = parts.at(-1) || '';

      // Extract just the resource type from the full type string (e.g., "Function" from "sst:aws:Function")
      const typeParts = typeString.split(':');
      const simpleType = typeParts.at(-1) || typeString;

      return {
        name: name.trim(),
        type: simpleType || 'Unknown',
      };
    }

    // Fallback: use the whole identifier as the name
    return {
      name: identifier.trim(),
      type: 'Unknown',
    };
  }

  /**
   * Generate human-readable change summary
   */
  private generateChangeSummary(
    output: string,
    plannedChanges: number,
    exitCode: number
  ): string {
    // Check for explicit "No changes" message
    if (this.diffPatterns.NO_CHANGES.test(output)) {
      return 'No changes';
    }

    // Check for error scenarios - only return error message for actual failures with non-zero exit code
    if (exitCode !== 0 && this.diffPatterns.DIFF_FAILED.test(output)) {
      return 'Diff parsing failed - unable to determine changes';
    }

    // Always use "X changes planned" format for consistency
    return `${plannedChanges} changes planned`;
  }

  /**
   * Override base success determination for diff-specific logic
   */
  protected isSuccessfulOperation(output: string, exitCode: number): boolean {
    // Primary indicator: exit code
    if (exitCode !== 0) {
      return false;
    }

    // Check for diff-specific error patterns
    if (this.diffPatterns.DIFF_FAILED.test(output)) {
      return false;
    }

    // Check for general error patterns from base parser
    if (this.diffPatterns.ERROR_MESSAGE.test(output)) {
      return false;
    }

    // Diff operations with "No changes" are still successful
    return true;
  }
}
