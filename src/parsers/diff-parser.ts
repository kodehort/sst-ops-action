/**
 * Diff Operation Parser
 * Parses SST diff command output to extract planned changes and impact analysis
 *
 * Supports parsing of:
 * - Planned resource changes (create/update/delete)
 * - Cost implications and impact analysis
 * - Breaking change detection
 * - Change summaries and counts
 *
 * Supports parsing of:
 * - Planned resource changes (create/update/delete)
 * - Cost implications and impact analysis
 * - Breaking change detection
 * - Change summaries and counts
 */

import type { DiffResult } from '../types/operations';
import { BaseParser } from './base-parser';

export class DiffParser extends BaseParser<DiffResult> {
  /**
   * Diff-specific regex patterns for parsing SST diff output
   */
  private readonly diffPatterns = {
    // Planned change patterns - handle various formats
    PLANNED_CREATE: /^\+\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    PLANNED_UPDATE: /^~\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    PLANNED_DELETE: /^-\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,

    // Summary patterns
    CHANGES_COUNT: /(\d+)\s+changes?\s+planned/,
    NO_CHANGES: /^No changes$/m,

    // Impact and cost patterns
    BREAKING_CHANGES: /Breaking changes detected|Impact:\s+Breaking/i,
    COSMETIC_CHANGES: /Impact:\s+Cosmetic|No functional changes/i,
    COST_CHANGE:
      /Monthly:\s+\$([0-9,.]+)\s+→\s+\$([0-9,.]+)\s+\(([+-]\$[0-9,.]+)\)/,

    // Error patterns
    DIFF_FAILED: /Error parsing changes|Diff parsing failed/,
  };

  /**
   * Parse SST diff output into structured result
   */
  parse(
    output: string,
    stage: string,
    exitCode: number,
    maxSize?: number
  ): DiffResult {
    // Handle output truncation if size limit specified
    const truncated = maxSize ? output.length > maxSize : false;
    const processedOutput =
      maxSize && output.length > maxSize
        ? output.substring(0, maxSize)
        : output;

    // Parse common information using base parser
    const lines = processedOutput.split('\n');
    const commonInfo = this.parseCommonInfo(lines);

    // Parse diff-specific information
    const changes = this.parsePlannedChanges(processedOutput);
    const changeSummary = this.generateChangeSummary(processedOutput, changes);

    // Determine success based on exit code (primary) and patterns (secondary)
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    const result: DiffResult = {
      success,
      operation: 'diff',
      stage,
      app: commonInfo.app || '',
      rawOutput: processedOutput,
      exitCode,
      truncated,
      completionStatus:
        commonInfo.completionStatus || (success ? 'complete' : 'failed'),
      ...(commonInfo.permalink && { permalink: commonInfo.permalink }),
      plannedChanges: changes.length,
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

      // Skip malformed lines that don't follow the expected patterns
      if (!trimmedLine.match(/^[+~-]\s+\w/)) {
        continue;
      }

      // Try to match different change patterns
      let match: RegExpMatchArray | null;
      let action: 'create' | 'update' | 'delete';

      if ((match = trimmedLine.match(this.diffPatterns.PLANNED_CREATE))) {
        action = 'create';
      } else if (
        (match = trimmedLine.match(this.diffPatterns.PLANNED_UPDATE))
      ) {
        action = 'update';
      } else if (
        (match = trimmedLine.match(this.diffPatterns.PLANNED_DELETE))
      ) {
        action = 'delete';
      } else {
        continue; // No match, skip this line
      }

      if (match?.[1] && match?.[2]) {
        changes.push({
          type: match[1].trim(),
          name: match[2].trim(),
          action,
          ...(match[3] && { details: match[3].trim() }),
        });
      }
    }

    return changes;
  }

  /**
   * Generate human-readable change summary
   */
  private generateChangeSummary(
    output: string,
    changes: Array<{
      type: string;
      name: string;
      action: 'create' | 'update' | 'delete';
      details?: string;
    }>
  ): string {
    // Check for no changes
    if (this.diffPatterns.NO_CHANGES.test(output)) {
      return 'No changes detected';
    }

    // Check if diff parsing failed
    if (this.diffPatterns.DIFF_FAILED.test(output)) {
      return 'Diff parsing failed - unable to determine changes';
    }

    if (changes.length === 0) {
      return 'No changes detected';
    }

    // Count changes by type
    const createCount = changes.filter((c) => c.action === 'create').length;
    const updateCount = changes.filter((c) => c.action === 'update').length;
    const deleteCount = changes.filter((c) => c.action === 'delete').length;

    let summary = `${changes.length} changes planned: `;
    const parts: string[] = [];

    if (createCount > 0) parts.push(`${createCount} created`);
    if (updateCount > 0) parts.push(`${updateCount} updated`);
    if (deleteCount > 0) parts.push(`${deleteCount} deleted`);

    summary += parts.join(', ');

    // Add impact assessment
    if (this.diffPatterns.BREAKING_CHANGES.test(output)) {
      summary += '\n\n⚠️  Breaking changes detected';
      if (output.includes('Data migration required')) {
        summary += '\n• Data migration required';
      }
      if (output.includes('Downtime expected')) {
        const downtimeMatch = output.match(/Downtime expected:\s*([^\\n]+)/);
        if (downtimeMatch?.[1]) {
          summary += `\n• Downtime expected: ${downtimeMatch[1]}`;
        }
      }
    } else if (this.diffPatterns.COSMETIC_CHANGES.test(output)) {
      summary += '\n\n✨ Cosmetic changes only - No functional impact';
    }

    // Add cost implications
    const costMatch = output.match(this.diffPatterns.COST_CHANGE);
    if (costMatch?.[3]) {
      const change = costMatch[3]; // This includes the +/- sign
      summary += `\n\n💰 Cost: ${change}`;
    }

    return summary;
  }
}
