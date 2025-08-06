/**
 * Remove Operation Parser
 * Parses SST remove command output to extract resource cleanup and cost savings
 *
 * Supports parsing of:
 * - Removed resources with status tracking
 * - Partial cleanup scenarios and stuck resources
 * - Cost savings information
 * - Cleanup completion status
 */

import type { RemoveResult } from '../types/operations';
import { BaseParser } from './base-parser';

export class RemoveParser extends BaseParser<RemoveResult> {
  /**
   * Remove-specific regex patterns for parsing SST remove output
   */
  private readonly removePatterns = {
    // Resource removal patterns - handle various formats
    RESOURCE_DELETED: /^\|\s+Deleted\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    RESOURCE_FAILED: /^!\s+(\w+)\s+(.+?)\s+could not be removed:\s+(.+)$/,
    RESOURCE_FAILED_ALT: /^!\s+(\w+)\s+(.+?)\s+removal failed:\s+(.+)$/,
    RESOURCE_TIMEOUT: /^!\s+(\w+)\s+(.+?)\s+removal timed out/,

    // Completion status patterns
    ALL_REMOVED: /^✓\s+All resources removed$/m,
    PARTIAL_REMOVAL:
      /^⚠\s+.*removal.*completed|.*resources could not be removed/im,
    REMOVAL_FAILED: /^✗\s+Remove failed$/m,
    REMOVE_TIMEOUT: /Remove operation timed out/,

    // Special cases
    NO_RESOURCES: /No resources to remove|Stack is already empty/,
    EMPTY_STACK: /Stack.*does not exist/,

    // Cost patterns
    MONTHLY_SAVINGS: /Monthly savings:\s+\$([0-9,.]+)/,

    // Error patterns
    REMOVE_ERROR: /^Error:\s*(.+)$/m,
    REMOVAL_FAILED_MSG: /Remove operation failed/,
  };

  /**
   * Parse SST remove output into structured result
   */
  parse(
    output: string,
    stage: string,
    exitCode: number,
    maxSize?: number
  ): RemoveResult {
    // Handle output truncation if size limit specified
    const truncated = maxSize ? output.length > maxSize : false;
    const processedOutput =
      maxSize && output.length > maxSize
        ? output.substring(0, maxSize)
        : output;

    // Parse common information using base parser
    const lines = processedOutput.split('\n');
    const commonInfo = this.parseCommonInfo(lines);

    // Parse remove-specific information
    const removedResources = this.parseRemovedResources(processedOutput);
    const completionStatus = this.parseCompletionStatus(
      processedOutput,
      exitCode
    );
    const error = this.parseErrorMessage(processedOutput);

    // Determine success based on exit code (primary) and patterns (secondary)
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    const result: RemoveResult = {
      success,
      operation: 'remove',
      stage,
      app: commonInfo.app || '',
      rawOutput: processedOutput,
      exitCode,
      truncated,
      ...(error && { error }),
      completionStatus: completionStatus || (success ? 'complete' : 'failed'),
      ...(commonInfo.permalink && { permalink: commonInfo.permalink }),
      resourcesRemoved: removedResources.length,
      removedResources,
    };

    return result;
  }

  /**
   * Parse removed resources from removal output
   */
  private parseRemovedResources(output: string): Array<{
    type: string;
    name: string;
    status: 'removed' | 'failed' | 'skipped';
  }> {
    const lines = output.split('\n');
    const resources: Array<{
      type: string;
      name: string;
      status: 'removed' | 'failed' | 'skipped';
    }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Try to match different resource patterns
      let match: RegExpMatchArray | null;
      let status: 'removed' | 'failed' | 'skipped';

      if ((match = trimmedLine.match(this.removePatterns.RESOURCE_DELETED))) {
        status = 'removed';
        if (match?.[1] && match?.[2]) {
          resources.push({
            type: match[1].trim(),
            name: match[2].trim(),
            status,
          });
        }
      } else if (
        (match = trimmedLine.match(this.removePatterns.RESOURCE_FAILED)) ||
        (match = trimmedLine.match(this.removePatterns.RESOURCE_FAILED_ALT)) ||
        (match = trimmedLine.match(this.removePatterns.RESOURCE_TIMEOUT))
      ) {
        status = 'failed';
        if (match?.[1] && match?.[2]) {
          resources.push({
            type: match[1].trim(),
            name: match[2].trim(),
            status,
          });
        }
      }
      // Note: 'skipped' status could be added for resources that were intentionally skipped
    }

    return resources;
  }

  /**
   * Parse completion status from removal output
   */
  private parseCompletionStatus(
    output: string,
    exitCode: number
  ): 'complete' | 'partial' | 'failed' | undefined {
    // Priority 1: Exit code - non-zero exit code always indicates failure
    if (exitCode !== 0) {
      return 'failed';
    }

    // Priority 2: Explicit status patterns
    if (this.removePatterns.ALL_REMOVED.test(output)) {
      return 'complete';
    }

    if (this.removePatterns.REMOVAL_FAILED.test(output)) {
      return 'failed';
    }

    // Check for no resources case
    if (
      this.removePatterns.NO_RESOURCES.test(output) ||
      this.removePatterns.EMPTY_STACK.test(output)
    ) {
      return 'complete';
    }

    // Priority 3: Partial patterns (only if exit code is 0)
    if (this.removePatterns.PARTIAL_REMOVAL.test(output)) {
      return 'partial';
    }

    if (this.removePatterns.REMOVE_TIMEOUT.test(output)) {
      return 'partial';
    }

    // Priority 4: Resource-level failures (only if exit code is 0)
    const lines = output.split('\n');
    const hasFailedResources = lines.some(
      (line) =>
        this.removePatterns.RESOURCE_FAILED.test(line.trim()) ||
        this.removePatterns.RESOURCE_FAILED_ALT.test(line.trim()) ||
        this.removePatterns.RESOURCE_TIMEOUT.test(line.trim())
    );

    if (hasFailedResources) {
      return 'partial';
    }

    return; // Let base parser determine
  }

  /**
   * Parse error messages from failed removals
   */
  private parseErrorMessage(output: string): string | undefined {
    const errorMatch = output.match(this.removePatterns.REMOVE_ERROR);
    if (errorMatch?.[1]) {
      return errorMatch[1].trim();
    }

    // Look for removal failure pattern
    if (this.removePatterns.REMOVAL_FAILED_MSG.test(output)) {
      return 'Remove operation failed';
    }

    return;
  }
}
