import type { RemoveResult } from '../types/operations';
import { OperationParser } from './operation-parser';

/**
 * Remove-specific regex patterns for parsing resource removals
 */
const REMOVED_RESOURCE_PATTERN = /^-\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;
const FAILED_RESOURCE_PATTERN = /^×\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;
const SKIPPED_RESOURCE_PATTERN = /^~\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;
const COMPLETE_PATTERN = /^✓\s+Complete$/m;
const PARTIAL_COMPLETION_PATTERN = /^⚠\s+Partial completion$/m;
const FAILED_PATTERN = /^×\s+Failed$/m;
const RESOURCES_REMOVED_COUNT_PATTERN =
  /^(\d+)\s+resources?\s+removed(?:,\s+(\d+)\s+failed)?$/m;
const NO_RESOURCES_PATTERN = /^No resources to remove$/m;
const RESOURCES_SUMMARY_PATTERN =
  /^(\d+)\s+resources?\s+removed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?$/m;
const ERROR_MESSAGE_PATTERN = /^Error:\s*(.+)$/m;
const REMOVE_FAILED_PATTERN =
  /Unable to connect|Permission denied|Error removing/i;
const TIMEOUT_MESSAGE_PATTERN = /timeout|timed out/i;

/**
 * Parser for SST remove operation outputs
 * Extracts resource removal information and tracks success/failure status
 */
export class RemoveParser extends OperationParser<RemoveResult> {
  /**
   * Remove-specific regex patterns for parsing resource removals
   */
  private readonly removePatterns = {
    // Resource removal patterns
    REMOVED_RESOURCE: REMOVED_RESOURCE_PATTERN,
    FAILED_RESOURCE: FAILED_RESOURCE_PATTERN,
    SKIPPED_RESOURCE: SKIPPED_RESOURCE_PATTERN,

    // Status indicators
    COMPLETE: COMPLETE_PATTERN,
    PARTIAL_COMPLETION: PARTIAL_COMPLETION_PATTERN,
    FAILED: FAILED_PATTERN,

    // Resource count patterns
    RESOURCES_REMOVED_COUNT: RESOURCES_REMOVED_COUNT_PATTERN,
    NO_RESOURCES: NO_RESOURCES_PATTERN,
    RESOURCES_SUMMARY: RESOURCES_SUMMARY_PATTERN,

    // Error patterns
    ERROR_MESSAGE: ERROR_MESSAGE_PATTERN,
    REMOVE_FAILED: REMOVE_FAILED_PATTERN,
    TIMEOUT_MESSAGE: TIMEOUT_MESSAGE_PATTERN,
  };

  /**
   * Parse SST remove output and extract resource removal information
   */
  parse(output: string, stage: string, exitCode: number): RemoveResult {
    // Handle null/undefined input gracefully
    const processedOutput = this.cleanText(output || '');
    const lines = processedOutput.split('\n');

    // Parse common information from base parser
    const commonInfo = this.parseCommonInfo(lines);

    // Determine success based on exit code and error patterns
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    // Parse remove-specific information
    const removedResources = this.parseRemovedResources(processedOutput);
    const resourcesRemoved = removedResources.filter(
      (r) => r.status === 'removed'
    ).length;
    const completionStatus = this.determineCompletionStatus(
      processedOutput,
      exitCode,
      removedResources
    );

    // Build result with all required properties
    const result: RemoveResult = {
      // Base operation result properties
      success,
      operation: 'remove',
      stage,
      exitCode,
      app: commonInfo.app || 'unknown-app',
      rawOutput: processedOutput,
      permalink: commonInfo.permalink || '',
      completionStatus,
      truncated: false,

      // Remove-specific properties
      resourcesRemoved,
      removedResources,
    };

    return result;
  }

  /**
   * Parse removed/failed/skipped resources from remove output
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
      const resource = this.parseResourceFromLine(trimmedLine);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Parse a single resource from a remove line
   */
  private parseResourceFromLine(line: string): {
    type: string;
    name: string;
    status: 'removed' | 'failed' | 'skipped';
  } | null {
    const patterns = [
      {
        regex: this.removePatterns.REMOVED_RESOURCE,
        status: 'removed' as const,
      },
      { regex: this.removePatterns.FAILED_RESOURCE, status: 'failed' as const },
      {
        regex: this.removePatterns.SKIPPED_RESOURCE,
        status: 'skipped' as const,
      },
    ];

    for (const { regex, status } of patterns) {
      const match = line.match(regex);
      if (match?.[1] && match[2]) {
        return {
          type: match[1] || 'unknown',
          name: match[2] || 'unknown',
          status,
        };
      }
    }

    return null;
  }

  /**
   * Determine completion status based on output patterns and resources
   */
  private determineCompletionStatus(
    output: string,
    exitCode: number,
    removedResources: Array<{ status: 'removed' | 'failed' | 'skipped' }>
  ): 'complete' | 'partial' | 'failed' {
    // Check for explicit completion status indicators
    if (this.removePatterns.COMPLETE.test(output)) {
      return 'complete';
    }
    if (this.removePatterns.PARTIAL_COMPLETION.test(output)) {
      return 'partial';
    }
    if (this.removePatterns.FAILED.test(output)) {
      return 'failed';
    }

    // Determine status based on exit code and resource outcomes
    if (exitCode !== 0) {
      // Non-zero exit code indicates failure
      return removedResources.length > 0 ? 'partial' : 'failed';
    }

    // Zero exit code - check resource status distribution
    const failed = removedResources.filter((r) => r.status === 'failed');
    const removed = removedResources.filter((r) => r.status === 'removed');

    if (failed.length > 0) {
      return 'partial'; // Some resources failed to remove
    }

    if (removed.length > 0 || removedResources.length === 0) {
      return 'complete'; // All resources removed successfully or no resources to remove
    }

    return 'complete'; // Default to complete for successful operations
  }

  /**
   * Override base success determination for remove-specific logic
   */
  protected isSuccessfulOperation(output: string, exitCode: number): boolean {
    // Primary indicator: exit code
    if (exitCode !== 0) {
      return false;
    }

    // Check for remove-specific error patterns
    if (this.removePatterns.REMOVE_FAILED.test(output)) {
      return false;
    }

    // Check for general error patterns from base parser
    if (this.removePatterns.ERROR_MESSAGE.test(output)) {
      return false;
    }

    // Remove operations with "No resources to remove" are still successful
    return true;
  }
}
