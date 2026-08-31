/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

import * as core from "@actions/core";
import { GitHubClient } from "../github/client";
import type { ResolvedInputs } from "../inputs/resolve";
import { DeployParser } from "../parsers/deploy-parser";
import { DiffParser } from "../parsers/diff-parser";
import { RemoveParser } from "../parsers/remove-parser";
import { StageProcessor } from "../parsers/stage-processor";
import type { OperationResult, SSTOperation } from "../types";
import { SSTCLIExecutor } from "../utils/cli";
import { logActionVersion } from "../utils/version";
import { runInfrastructureOperation, runRemoveOperation } from "./run";

/**
 * Execute an SST operation with full error handling and routing
 * @param inputs Resolved action inputs, tagged by operation
 * @returns Promise resolving to operation result
 */
export async function executeOperation(
  inputs: ResolvedInputs
): Promise<OperationResult> {
  try {
    logActionVersion(core.info);

    // The stage operation runs no command and needs no GitHub client. It used
    // to be a class wrapping this processor with the same arguments, reached
    // through a factory branch, purely to look like the other three.
    if (inputs.operation === "stage") {
      return new StageProcessor().process({
        prefix: inputs.prefix,
        refs: inputs.refs,
        truncationLength: inputs.truncationLength,
      });
    }

    // The factory's switch, inlined into the caller it had. It is written out
    // rather than looked up in a map so the parser's result type stays
    // correlated with the narrowed inputs — a map erases that link and the
    // three results collapse to a union the run path cannot return.
    const deps = {
      createGitHubClient: (token: string) => new GitHubClient(token),
      executor: new SSTCLIExecutor(),
    };

    switch (inputs.operation) {
      case "deploy":
        return await runInfrastructureOperation({
          ...deps,
          inputs,
          parser: new DeployParser(),
        });
      case "diff":
        return await runInfrastructureOperation({
          ...deps,
          inputs,
          parser: new DiffParser(),
        });
      case "remove":
        // Remove checks the state backend first and no-ops on a stage that
        // was never deployed, so cleanup workflows stay green for PRs that
        // never deployed anything.
        return await runRemoveOperation({
          ...deps,
          inputs,
          parser: new RemoveParser(),
        });
      default: {
        const _exhaustive: never = inputs;
        throw new Error(
          `Unknown operation type: ${(_exhaustive as { operation: string }).operation}`
        );
      }
    }
  } catch (error) {
    // Return a failed result with error details
    return createFailureResult(inputs, error as Error);
  }
}

/**
 * Create a failure result for error conditions
 *
 * Generates a standardized failure result when operations encounter errors.
 * This ensures consistent error reporting across all operation types while
 * maintaining the expected result structure for downstream processing.
 *
 * @param inputs The resolved inputs the failed operation was running with
 * @param error The error that occurred during execution
 * @returns Failure result in unified format with operation-specific default values
 */
function createFailureResult(
  inputs: ResolvedInputs,
  error: Error
): OperationResult {
  const operationType: SSTOperation = inputs.operation;
  // The stage operation has no stage input — computing one is its job — so a
  // failure before it ran has nothing to report here.
  const stage = inputs.operation === "stage" ? "" : inputs.stage;

  const baseResult = {
    app: "",
    completionStatus: "failed" as const,
    error: error.message,
    exitCode: 1,
    operation: operationType,
    rawOutput: error.stack || error.message,
    stage,
    success: false,
    truncated: false,
  };

  // Add operation-specific fields
  switch (operationType) {
    case "deploy":
      return {
        ...baseResult,
        operation: "deploy" as const,
        outputs: [],
        resourceChanges: 0,
        resources: [],
      };
    case "diff":
      return {
        ...baseResult,
        changeSummary: "Operation failed",
        changes: [],
        diffSection: "",
        operation: "diff" as const,
        plannedChanges: 0,
      };
    case "remove":
      return {
        ...baseResult,
        operation: "remove" as const,
        removedResources: [],
        resourcesRemoved: 0,
      };
    case "stage":
      return {
        ...baseResult,
        computedStage: stage,
        eventName: "unknown",
        isPullRequest: false,
        operation: "stage" as const,
        ref: "",
        stages: [],
      };
    default: {
      // Exhaustive check for TypeScript
      const _exhaustive: never = operationType;
      throw new Error(
        `Cannot create error result for unknown operation: ${_exhaustive}`
      );
    }
  }
}
