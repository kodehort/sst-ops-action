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
 * Regex patterns for parsing top-level resource changes
 */
const TOP_LEVEL_RESOURCE_PATTERN = /^([+*-])\s+([^\s].*?)(?:\s+→\s+(.+))?$/;
const INDENTED_CHILD_PATTERN = /^\s+[+*-]/;

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
    const _diffSection = this.extractDiffSection(processedOutput);

    // Determine success based on exit code and error patterns
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    // Parse diff-specific information from the entire output (not just diff section)
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
   * Only count top-level resources, not child resources (those with →) or child properties (indented lines)
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
      // Skip indented child properties
      if (this.isIndentedChild(line)) {
        continue;
      }

      const resourceChange = this.parseResourceChange(line);
      if (!resourceChange) {
        continue;
      }

      // Skip stack resources and operation headers
      if (this.shouldSkipResource(resourceChange.type, resourceChange.name)) {
        continue;
      }

      this.addOrUpdateChange(changes, resourceChange);
    }

    return changes;
  }

  /**
   * Check if a line is an indented child property
   */
  private isIndentedChild(line: string): boolean {
    return INDENTED_CHILD_PATTERN.test(line);
  }

  /**
   * Parse a resource change from a line
   */
  private parseResourceChange(line: string): {
    type: string;
    name: string;
    action: 'create' | 'update' | 'delete';
    hasChildResource: boolean;
  } | null {
    const topLevelMatch = line.match(TOP_LEVEL_RESOURCE_PATTERN);
    if (!topLevelMatch) {
      return null;
    }

    const [, symbol, resourceIdentifier, childResource] = topLevelMatch;
    if (!(resourceIdentifier && symbol)) {
      return null;
    }

    const action = this.parseAction(symbol);
    const { name, type } = this.parseResourceIdentifier(resourceIdentifier);

    return {
      type,
      name,
      action,
      hasChildResource: Boolean(childResource),
    };
  }

  /**
   * Parse action from symbol
   */
  private parseAction(symbol: string): 'create' | 'update' | 'delete' {
    if (symbol === '+') {
      return 'create';
    }
    if (symbol === '*') {
      return 'update';
    }
    return 'delete';
  }

  /**
   * Check if a resource should be skipped
   */
  private shouldSkipResource(type: string, name: string): boolean {
    return type === 'Stack' || name === 'Diff';
  }

  /**
   * Add or update a change in the changes array
   */
  private addOrUpdateChange(
    changes: Array<{
      type: string;
      name: string;
      action: 'create' | 'update' | 'delete';
      details?: string;
    }>,
    resourceChange: {
      type: string;
      name: string;
      action: 'create' | 'update' | 'delete';
      hasChildResource: boolean;
    }
  ): void {
    const { type, name, action, hasChildResource } = resourceChange;

    if (hasChildResource) {
      // Only add if we haven't seen this resource before
      const existingChange = changes.find(
        (c) => c.name === name && c.type === type
      );
      if (!existingChange) {
        changes.push({ type, name, action });
      }
    } else {
      // Override any previous entry
      const existingIndex = changes.findIndex(
        (c) => c.name === name && c.type === type
      );
      if (existingIndex >= 0) {
        changes[existingIndex] = { type, name, action };
      } else {
        changes.push({ type, name, action });
      }
    }
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
