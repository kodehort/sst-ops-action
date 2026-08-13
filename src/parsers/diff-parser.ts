import type { DiffResult } from "../types/operations";
import { type DiffAction, normalizeDiffAction } from "./normalization";
import { OperationParser } from "./operation-parser";
import { SSTPatterns } from "./patterns";

/**
 * Parser for SST diff operation outputs
 * Extracts planned infrastructure changes without deploying
 */
export class DiffParser extends OperationParser<DiffResult> {
  /**
   * Parse SST diff output and extract planned changes
   */
  parse(output: string, stage: string, exitCode: number): DiffResult {
    // Handle null/undefined input gracefully
    const processedOutput = this.cleanText(output || "");
    const lines = processedOutput.split("\n");

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
      app: commonInfo.app || "unknown-app",
      changeSummary,
      changes,
      completionStatus: commonInfo.completionStatus || "complete",
      exitCode,
      operation: "diff",
      permalink: commonInfo.permalink || "",

      // Diff-specific properties
      plannedChanges,
      rawOutput: processedOutput,
      stage,
      // Base operation result properties
      success,
      truncated: false,
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
    action: "create" | "update" | "delete";
    details?: string;
  }> {
    const lines = output.split("\n");
    const changes: Array<{
      type: string;
      name: string;
      action: "create" | "update" | "delete";
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
    return SSTPatterns.diff.indentedChild.test(line);
  }

  /**
   * Parse a resource change from a line
   */
  private parseResourceChange(line: string): {
    type: string;
    name: string;
    action: "create" | "update" | "delete";
    hasChildResource: boolean;
  } | null {
    const topLevelMatch = line.match(SSTPatterns.diff.topLevelResource);
    if (!topLevelMatch) {
      return null;
    }

    const [, symbol, resourceIdentifier, childResource] = topLevelMatch;
    if (!(resourceIdentifier && symbol)) {
      return null;
    }

    // Identifier first, so an unrecognised symbol can be warned about with the
    // resource named.
    const { name, type } = this.parseResourceIdentifier(resourceIdentifier);
    const action = this.parseAction(symbol, name, type);

    return {
      action,
      hasChildResource: Boolean(childResource),
      name,
      type,
    };
  }

  /**
   * Parse action from symbol
   */
  private parseAction(
    symbol: string,
    resourceName?: string,
    resourceType?: string
  ): DiffAction {
    // The capture group only admits +, * and -, so the map is exhaustive in
    // practice. Anything else used to fall silently into "delete"; it now
    // warns and takes the documented 'update' fallback instead.
    const bySymbol: Record<string, DiffAction> = {
      "-": "delete",
      "*": "update",
      "+": "create",
    };

    const action = bySymbol[symbol];
    if (action) {
      return action;
    }

    return normalizeDiffAction(symbol, resourceName, resourceType);
  }

  /**
   * Check if a resource should be skipped
   */
  private shouldSkipResource(type: string, name: string): boolean {
    return type === "Stack" || name === "Diff";
  }

  /**
   * Add or update a change in the changes array
   */
  private addOrUpdateChange(
    changes: Array<{
      type: string;
      name: string;
      action: "create" | "update" | "delete";
      details?: string;
    }>,
    resourceChange: {
      type: string;
      name: string;
      action: "create" | "update" | "delete";
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
        changes.push({ action, name, type });
      }
    } else {
      // Override any previous entry
      const existingIndex = changes.findIndex(
        (c) => c.name === name && c.type === type
      );
      if (existingIndex >= 0) {
        changes[existingIndex] = { action, name, type };
      } else {
        changes.push({ action, name, type });
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
    const parts = identifier.trim().split(" ");

    if (parts.length >= 2) {
      // Join all parts except the last one as the name
      const name = parts.slice(0, -1).join(" ");
      const typeString = parts.at(-1) || "";

      // Extract just the resource type from the full type string (e.g., "Function" from "sst:aws:Function")
      const typeParts = typeString.split(":");
      const simpleType = typeParts.at(-1) || typeString;

      return {
        name: name.trim(),
        type: simpleType || "Unknown",
      };
    }

    // Fallback: use the whole identifier as the name
    return {
      name: identifier.trim(),
      type: "Unknown",
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
    if (SSTPatterns.diff.noChanges.test(output)) {
      return "No changes";
    }

    // Check for error scenarios - only return error message for actual failures with non-zero exit code
    if (exitCode !== 0 && SSTPatterns.diff.failed.test(output)) {
      return "Diff parsing failed - unable to determine changes";
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
    if (SSTPatterns.diff.failed.test(output)) {
      return false;
    }

    // Check for general error patterns from base parser
    if (SSTPatterns.errors.message.test(output)) {
      return false;
    }

    // Diff operations with "No changes" are still successful
    return true;
  }
}
