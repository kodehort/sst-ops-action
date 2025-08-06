import type { DiffResult } from '../types/operations';
import { BaseParser } from './base-parser';

/**
 * Parser for SST diff operation outputs
 * Extracts planned infrastructure changes without deploying
 */
export class DiffParser extends BaseParser<DiffResult> {
  /**
   * Diff-specific regex patterns for parsing planned changes
   */
  private readonly diffPatterns = {
    // Planned changes patterns
    PLANNED_CREATE: /^\+\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    PLANNED_UPDATE: /^~\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    PLANNED_DELETE: /^-\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,

    // Summary patterns
    CHANGES_PLANNED: /^(\d+)\s+changes?\s+planned$/m,
    NO_CHANGES: /^No changes$/m,

    // Additional info patterns
    COST_CHANGE: /^\s*Cost changes:/m,
    BREAKING_CHANGES: /^\s*Breaking changes detected:/m,
    IMPACT_BREAKING: /^\s*Impact:\s+(breaking|high)/im,
    IMPACT_COSMETIC: /^\s*Impact:\s+(cosmetic|low|none)/im,

    // Error patterns
    ERROR_MESSAGE: /^Error:\s*(.+)$/m,
    DIFF_FAILED: /Unable to generate diff|Permission denied|Error parsing/i,
  };

  /**
   * Parse SST diff output and extract planned changes
   */
  parse(output: string, stage: string, exitCode: number): DiffResult {
    // Handle null/undefined input gracefully
    const processedOutput = this.cleanText(output || '');
    const lines = processedOutput.split('\n');

    // Parse common information from base parser
    const commonInfo = this.parseCommonInfo(lines);

    // Determine success based on exit code and error patterns
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    // Parse diff-specific information
    const changes = this.parsePlannedChanges(processedOutput);
    const plannedChanges = changes.length;
    const changeSummary = this.generateChangeSummary(
      processedOutput,
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

      // Check for create (+) pattern
      const createMatch = trimmedLine.match(this.diffPatterns.PLANNED_CREATE);
      if (createMatch?.[1] && createMatch[2]) {
        const change = {
          type: createMatch[1] || 'unknown',
          name: createMatch[2] || 'unknown',
          action: 'create' as const,
          ...(createMatch[3] && { details: createMatch[3] }),
        };
        changes.push(change);
        continue;
      }

      // Check for update (~) pattern
      const updateMatch = trimmedLine.match(this.diffPatterns.PLANNED_UPDATE);
      if (updateMatch?.[1] && updateMatch[2]) {
        const change = {
          type: updateMatch[1] || 'unknown',
          name: updateMatch[2] || 'unknown',
          action: 'update' as const,
          ...(updateMatch[3] && { details: updateMatch[3] }),
        };
        changes.push(change);
        continue;
      }

      // Check for delete (-) pattern
      const deleteMatch = trimmedLine.match(this.diffPatterns.PLANNED_DELETE);
      if (deleteMatch?.[1] && deleteMatch[2]) {
        const change = {
          type: deleteMatch[1] || 'unknown',
          name: deleteMatch[2] || 'unknown',
          action: 'delete' as const,
          ...(deleteMatch[3] && { details: deleteMatch[3] }),
        };
        changes.push(change);
      }
    }

    return changes;
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

    // Check for explicit changes count
    const changesMatch = output.match(this.diffPatterns.CHANGES_PLANNED);
    if (changesMatch?.[1]) {
      const count = Number.parseInt(changesMatch[1], 10);
      return `${count} changes planned`;
    }

    // Check for error scenarios - only return error message for actual failures with non-zero exit code
    if (exitCode !== 0 && this.diffPatterns.DIFF_FAILED.test(output)) {
      return 'Diff parsing failed - unable to determine changes';
    }

    // Fallback: always use "X changes planned" format for consistency
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
