/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

import { GitHubClient } from "../github/client";
import type { OperationOptions, OperationResult, SSTOperation } from "../types";
import { SSTCLIExecutor } from "../utils/cli";
import { OperationFactory } from "./factory";

/**
 * Execute an SST operation with full error handling and routing
 * @param operationType The type of operation to execute
 * @param options Configuration options for the operation
 * @returns Promise resolving to operation result
 */
export async function executeOperation(
  operationType: SSTOperation,
  options: OperationOptions
): Promise<OperationResult> {
  try {
    // Validate operation type
    if (!OperationFactory.isValidOperationType(operationType)) {
      throw new Error(
        `Invalid operation type: ${operationType}. ` +
          `Supported operations: ${OperationFactory.getSupportedOperations().join(", ")}`
      );
    }

    // Create dependencies
    const cliExecutor = new SSTCLIExecutor();
    // Stage operations don't require a GitHub token, use empty string as fallback
    const token = operationType === "stage" ? "fake-token" : options.token;
    const githubClient = new GitHubClient(token);

    // Create operation factory
    const factory = new OperationFactory(cliExecutor, githubClient);

    // Create operation instance
    const operation = factory.createOperation(operationType);

    // Execute operation. The operation returns the parser's result, which is
    // already in the unified shape, so the router passes it straight through.
    return await operation.execute(options);
  } catch (error) {
    // Return a failed result with error details
    return createFailureResult(operationType, error as Error, options);
  }
}

/**
 * Create a failure result for error conditions
 *
 * Generates a standardized failure result when operations encounter errors.
 * This ensures consistent error reporting across all operation types while
 * maintaining the expected result structure for downstream processing.
 *
 * @param operationType The operation that failed ('deploy' | 'diff' | 'remove' | 'stage')
 * @param error The error that occurred during execution
 * @param options The original operation options that were being processed
 * @returns Failure result in unified format with operation-specific default values
 *
 * @example
 * ```typescript
 * try {
 *   return await operation.execute(options);
 * } catch (error) {
 *   return createFailureResult('deploy', error as Error, options);
 * }
 * ```
 */
function createFailureResult(
  operationType: SSTOperation,
  error: Error,
  options: OperationOptions
): OperationResult {
  const baseResult = {
    app: "",
    completionStatus: "failed" as const,
    error: error.message,
    exitCode: 1,
    operation: operationType,
    rawOutput: error.stack || error.message,
    stage: options.stage,
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
        computedStage: options.stage,
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
