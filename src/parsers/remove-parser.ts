import type { RemoveResult } from "../types/operations";
import { normalizeRemoveStatus } from "./normalization";
import { OperationParser } from "./operation-parser";
import { SSTPatterns } from "./patterns";

/**
 * Parser for SST remove operation outputs
 * Extracts resource removal information and tracks success/failure status
 */
export class RemoveParser extends OperationParser<RemoveResult> {
  /**
   * Parse SST remove output and extract resource removal information
   */
  parse(
    output: string,
    stage: string,
    exitCode: number,
    truncated: boolean
  ): RemoveResult {
    // Handle null/undefined input gracefully
    const processedOutput = this.cleanText(output || "");
    const lines = processedOutput.split("\n");

    // Parse common information from base parser
    const commonInfo = this.parseCommonInfo(lines);

    // Determine success based on exit code and error patterns
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    // Parse remove-specific information
    const removedResources = this.parseRemovedResources(processedOutput);
    const resourcesRemoved = removedResources.filter(
      (r) => r.status === "removed"
    ).length;
    const completionStatus = this.determineCompletionStatus(
      processedOutput,
      exitCode,
      removedResources
    );

    // Build result with all required properties
    const result: RemoveResult = {
      app: commonInfo.app || "",
      completionStatus,
      exitCode,
      operation: "remove",
      permalink: commonInfo.permalink || "",
      rawOutput: processedOutput,
      removedResources,

      // Remove-specific properties
      resourcesRemoved,
      stage,
      // Base operation result properties
      success,
      truncated,
    };

    return result;
  }

  /**
   * Parse removed/failed/skipped resources from remove output
   */
  private parseRemovedResources(output: string): Array<{
    type: string;
    name: string;
    status: "removed" | "failed" | "skipped";
  }> {
    const lines = output.split("\n");
    const resources: Array<{
      type: string;
      name: string;
      status: "removed" | "failed" | "skipped";
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
    status: "removed" | "failed" | "skipped";
  } | null {
    const patterns = [
      {
        regex: SSTPatterns.remove.removedResource,
        status: "removed" as const,
      },
      { regex: SSTPatterns.remove.failedResource, status: "failed" as const },
      {
        regex: SSTPatterns.remove.skippedResource,
        status: "skipped" as const,
      },
    ];

    for (const { regex, status } of patterns) {
      const match = line.match(regex);
      if (match?.[1] && match[2]) {
        const name = match[2] || "unknown";
        const type = match[1] || "unknown";
        return {
          name,
          // Normalised here, where the CLI string arrives, rather than two
          // modules downstream in the router. Unknown values fall back to
          // 'failed', the conservative default for removals.
          status: normalizeRemoveStatus(status, name, type),
          type,
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
    removedResources: Array<{ status: "removed" | "failed" | "skipped" }>
  ): "complete" | "partial" | "failed" {
    // Check for explicit completion status indicators
    if (SSTPatterns.status.success.test(output)) {
      return "complete";
    }
    if (SSTPatterns.remove.partialCompletion.test(output)) {
      return "partial";
    }
    if (SSTPatterns.status.failed.test(output)) {
      return "failed";
    }

    // Determine status based on exit code and resource outcomes
    if (exitCode !== 0) {
      // Non-zero exit code indicates failure
      return removedResources.length > 0 ? "partial" : "failed";
    }

    // Zero exit code - check resource status distribution
    const failed = removedResources.filter((r) => r.status === "failed");
    const removed = removedResources.filter((r) => r.status === "removed");

    if (failed.length > 0) {
      return "partial"; // Some resources failed to remove
    }

    if (removed.length > 0 || removedResources.length === 0) {
      return "complete"; // All resources removed successfully or no resources to remove
    }

    return "complete"; // Default to complete for successful operations
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
    if (SSTPatterns.remove.removeFailed.test(output)) {
      return false;
    }

    // Check for general error patterns from base parser
    if (SSTPatterns.errors.message.test(output)) {
      return false;
    }

    // Remove operations with "No resources to remove" are still successful
    return true;
  }
}
