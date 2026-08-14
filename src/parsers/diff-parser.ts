import type { DiffResult } from "../types/operations";
import { type DiffAction, normalizeDiffAction } from "./normalization";
import { OperationParser } from "./operation-parser";
import { SSTPatterns } from "./patterns";

/**
 * Parser for SST diff operation outputs
 * Extracts planned infrastructure changes without deploying
 */
export class DiffParser extends OperationParser<DiffResult> {
  /** "No changes" is a successful diff; a diff error is not. */
  protected readonly failurePatterns = [
    SSTPatterns.diff.failed,
    SSTPatterns.errors.message,
  ];

  /**
   * Parse SST diff output and extract planned changes
   */
  parse(
    output: string,
    stage: string,
    exitCode: number,
    truncated: boolean
  ): DiffResult {
    const { commonInfo, output: processedOutput } = this.parseCommon(output);

    // Extracted once, here, and carried on the result. The formatter used to
    // scan the raw output for it a second time with its own copy of this.
    const diffSection = this.extractDiffSection(processedOutput);

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

    return {
      ...this.buildBaseResult({
        commonInfo,
        // Defaulting to "complete" regardless of success would label a failed
        // diff complete whenever the capture carried no status banner.
        completionStatus:
          commonInfo.completionStatus || (success ? "complete" : "failed"),
        exitCode,
        operation: "diff",
        output: processedOutput,
        stage,
        success,
        truncated,
      }),
      changeSummary,
      changes,
      diffSection,
      operation: "diff",
      plannedChanges,
    };
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

    // A non-zero exit means the count is not trustworthy, whether or not the
    // text carries a failure banner. This used to require both, so a diff that
    // exited non-zero with no recognisable banner — an auth failure, an empty
    // capture — was summarised as "0 changes planned", which reads as "your
    // infrastructure is up to date". Only reachable since the diff operation
    // stopped substituting a synthetic result for its own failures (#152).
    if (exitCode !== 0) {
      return "Diff failed - unable to determine changes";
    }

    // Always use "X changes planned" format for consistency
    return `${plannedChanges} changes planned`;
  }

  /**
   * Extract the diff section from the full SST output
   *
   * Isolates the actual diff content by skipping build and preparation phases.
   * Looks for the "✓ Generated" marker that indicates the start of diff output.
   *
   * Lived on the base parser, where the diff parser was its only caller.
   *
   * There were two implementations of this, one there and one inside the
   * comment formatter, and they disagreed on the no-match case: that one
   * returned the entire original output, the formatter's returned an empty
   * string. The formatter's behaviour is the one that survives — the other
   * fallback would render a whole raw CLI capture into a pull request comment
   * where nothing renders today. That disagreement is also why this method's
   * result could be computed and thrown away in the diff parser without
   * anyone noticing.
   *
   * @returns Diff section content, or an empty string if the marker is absent
   */
  private extractDiffSection(output: string): string {
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

    if (diffStartIndex === -1 || diffStartIndex >= lines.length) {
      return "";
    }

    const diffLines = lines.slice(diffStartIndex);

    while (diffLines.length > 0 && diffLines.at(-1)?.trim() === "") {
      diffLines.pop();
    }

    return diffLines.join("\n").trim();
  }
}
