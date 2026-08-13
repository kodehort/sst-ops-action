/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

import { GitHubClient } from "../github/client";
import type { ResolvedInputs } from "../inputs/resolve";
import type { OperationResult, SSTOperation } from "../types";
import { SSTCLIExecutor } from "../utils/cli";
import { OperationFactory } from "./factory";

/**
 * Execute an SST operation with full error handling and routing
 * @param operationType The type of operation to execute
 * @param options Configuration options for the operation
 * @returns Promise resolving to operation result
 */
export async function executeOperation(
  inputs: ResolvedInputs
): Promise<OperationResult> {
  try {
    // Validate operation type
    if (!OperationFactory.isValidOperationType(inputs.operation)) {
      throw new Error(
        `Invalid operation type: ${inputs.operation}. ` +
          `Supported operations: ${OperationFactory.getSupportedOperations().join(", ")}`
      );
    }

    // The client is created lazily, so the stage operation never needs a
    // token. It previously got the sentinel string "fake-token" purely to
    // satisfy a credential check for a client it does not use.
    const factory = new OperationFactory(
      new SSTCLIExecutor(),
      () => new GitHubClient(inputs.operation === "stage" ? "" : inputs.token)
    );

    // Execute operation. The operation returns the parser's result, which is
    // already in the unified shape, so the router passes it straight through.
    return await factory.createOperation(inputs)();
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
