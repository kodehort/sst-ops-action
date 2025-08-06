import type { RemoveResult } from '../types/operations';
import { BaseParser } from './base-parser';

/**
 * Parser for SST remove operation outputs
 * Extracts resource removal information and tracks success/failure status
 */
export class RemoveParser extends BaseParser<RemoveResult> {
  /**
   * Remove-specific regex patterns for parsing resource removals
   */
  private readonly removePatterns = {
    // Resource removal patterns
    REMOVED_RESOURCE: /^-\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    FAILED_RESOURCE: /^×\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
    SKIPPED_RESOURCE: /^~\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,

    // Status indicators
    COMPLETE: /^✓\s+Complete$/m,
    PARTIAL_COMPLETION: /^⚠\s+Partial completion$/m,
    FAILED: /^×\s+Failed$/m,

    // Resource count patterns
    RESOURCES_REMOVED_COUNT:
      /^(\d+)\s+resources?\s+removed(?:,\s+(\d+)\s+failed)?$/m,
    NO_RESOURCES: /^No resources to remove$/m,
    RESOURCES_SUMMARY:
      /^(\d+)\s+resources?\s+removed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?$/m,

    // Error patterns
    ERROR_MESSAGE: /^Error:\s*(.+)$/m,
    REMOVE_FAILED: /Unable to connect|Permission denied|Error removing/i,
    TIMEOUT_MESSAGE: /timeout|timed out/i,
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

      // Check for successfully removed resource (-)
      const removedMatch = trimmedLine.match(
        this.removePatterns.REMOVED_RESOURCE
      );
      if (removedMatch?.[1] && removedMatch[2]) {
        const resource = {
          type: removedMatch[1] || 'unknown',
          name: removedMatch[2] || 'unknown',
          status: 'removed' as const,
        };
        resources.push(resource);
        continue;
      }

      // Check for failed resource (×)
      const failedMatch = trimmedLine.match(
        this.removePatterns.FAILED_RESOURCE
      );
      if (failedMatch?.[1] && failedMatch[2]) {
        const resource = {
          type: failedMatch[1] || 'unknown',
          name: failedMatch[2] || 'unknown',
          status: 'failed' as const,
        };
        resources.push(resource);
        continue;
      }

      // Check for skipped resource (~)
      const skippedMatch = trimmedLine.match(
        this.removePatterns.SKIPPED_RESOURCE
      );
      if (skippedMatch?.[1] && skippedMatch[2]) {
        const resource = {
          type: skippedMatch[1] || 'unknown',
          name: skippedMatch[2] || 'unknown',
          status: 'skipped' as const,
        };
        resources.push(resource);
      }
    }

    return resources;
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
