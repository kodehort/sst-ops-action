/**
 * Deploy Operation Parser
 * Parses SST deploy command output to extract resource changes and generic outputs
 */

import type { DeployResult } from "../types/operations";
import type { SSTOutput } from "../utils/urls";
import { normalizeResourceStatus } from "./normalization";
import { OperationParser } from "./operation-parser";
import { SSTPatterns } from "./patterns";

export class DeployParser extends OperationParser<DeployResult> {
  /** A deploy that exits zero but reports a failure banner did not deploy. */
  protected readonly failurePatterns = [SSTPatterns.status.failed];

  /**
   * Parse SST deploy output into structured result
   */
  parse(
    output: string,
    stage: string,
    exitCode: number,
    truncated: boolean
  ): DeployResult {
    // The CLI layer already enforced the size budget against a single buffer.
    // A second layer here would apply the same limit twice.
    const { commonInfo, output: processedOutput } = this.parseCommon(output);

    // Parse deploy-specific information
    const resources = this.parseResourceChanges(processedOutput);
    const outputs = this.parseOutputs(processedOutput);
    const error = this.parseErrorMessage(processedOutput);

    // Determine success based on exit code (primary) and patterns (secondary)
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    return {
      ...this.buildBaseResult({
        commonInfo,
        completionStatus:
          commonInfo.completionStatus || (success ? "complete" : "failed"),
        error,
        exitCode,
        operation: "deploy",
        output: processedOutput,
        stage,
        success,
        truncated,
      }),
      operation: "deploy",
      outputs,
      resourceChanges: resources.length,
      resources,
    };
  }

  /**
   * Parse resource changes from deployment output
   */
  private parseResourceChanges(output: string): Array<{
    type: string;
    name: string;
    status: "created" | "updated" | "deleted";
    timing?: string;
  }> {
    const lines = output.split("\n");
    const resources: Array<{
      type: string;
      name: string;
      status: "created" | "updated" | "deleted";
      timing?: string;
    }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      const resource = this.parseResourceChangeFromLine(trimmedLine);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Parse a single resource change from a deploy line
   * Real SST format: | Created/Updated/Deleted ResourceName ResourceType (timing)
   */
  private parseResourceChangeFromLine(line: string): {
    type: string;
    name: string;
    status: "created" | "updated" | "deleted";
    timing?: string;
  } | null {
    const patterns = [
      { regex: SSTPatterns.deploy.resourceCreated, status: "created" as const },
      { regex: SSTPatterns.deploy.resourceUpdated, status: "updated" as const },
      { regex: SSTPatterns.deploy.resourceDeleted, status: "deleted" as const },
    ];

    for (const { regex, status } of patterns) {
      const match = line.match(regex);
      if (match?.[1] && match[2]) {
        const name = match[1].trim();
        const type = match[2].trim();
        const result = {
          name,
          // Normalised here, where the CLI string arrives, rather than two
          // modules downstream in the router.
          status: normalizeResourceStatus(status, name, type),
          type,
        };

        // Add timing if available
        if (match[3]) {
          return { ...result, timing: match[3] };
        }

        return result;
      }
    }

    return null;
  }

  /**
   * Read the outputs SST printed after its completion marker.
   *
   * `✓ Complete` is deliberately narrower than `status.success`, which also
   * matches `Generated` and `Removed`: here it marks where the block begins,
   * not merely that the run finished.
   */
  private parseOutputs(output: string): SSTOutput[] {
    return this.parseOutputsBlock(
      output.split("\n"),
      SSTPatterns.deploy.completionSuccess
    ).outputs;
  }

  /**
   * Parse error messages from failed deployments
   * Real SST errors include stack traces and specific failure reasons
   */
  private parseErrorMessage(output: string): string | undefined {
    // Check for completion failure marker
    if (SSTPatterns.status.failed.test(output)) {
      return this.extractDetailedError(output);
    }

    // Check for specific error patterns
    const specificError = this.parseSpecificErrors(output);
    if (specificError) {
      return specificError;
    }

    // Look for generic Error: sections
    return this.parseGenericErrorSections(output);
  }

  /**
   * Parse specific known error patterns
   */
  private parseSpecificErrors(output: string): string | undefined {
    // Check for resource existence errors
    const resourceError = output.match(SSTPatterns.deploy.resourceNotExist);
    if (resourceError?.[1]) {
      return `Resource '${resourceError[1]}' does not exist`;
    }

    // Check for gRPC errors
    return SSTPatterns.deploy.grpcError.test(output)
      ? "gRPC client error occurred during deployment"
      : undefined;
  }

  /**
   * Parse generic Error: sections from output
   */
  private parseGenericErrorSections(output: string): string | undefined {
    const lines = output.split("\n");
    let errorSection = false;
    const errorLines: string[] = [];

    for (const line of lines) {
      if (SSTPatterns.deploy.errorSectionStart.test(line)) {
        errorSection = true;
        errorLines.push(line.trim());
        continue;
      }

      if (errorSection) {
        if (line.trim() === "" && errorLines.length > 0) {
          break; // End of error section
        }
        if (line.trim()) {
          errorLines.push(line.trim());
        }
      }
    }

    return errorLines.length > 0 ? errorLines.join(" ") : undefined;
  }

  /**
   * Extract detailed error information from failed output
   */
  private extractDetailedError(output: string): string {
    const lines = output.split("\n");
    const errorMessages: string[] = [];

    // Look for resource errors and main error messages
    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("|") && trimmed.includes("Error")) {
        errorMessages.push(trimmed.replace(SSTPatterns.deploy.pipePrefix, ""));
      } else if (trimmed.startsWith("Error:")) {
        errorMessages.push(trimmed);
      }
    }

    return errorMessages.length > 0
      ? errorMessages.join("; ")
      : "Deployment failed";
  }
}
