/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

import { GitHubClient } from "../github/client";
import {
  normalizeDiffAction,
  normalizeRemoveStatus,
  normalizeResourceStatus,
} from "../parsers/normalization";
import type {
  DeployResult,
  DiffResult,
  OperationOptions,
  OperationResult,
  RemoveResult,
  SSTOperation,
} from "../types";
import { SSTCLIExecutor } from "../utils/cli";
import { OperationFactory } from "./factory";
import {
  validateRawDeployResult,
  validateRawDiffResult,
  validateRawRemoveResult,
} from "./schemas";

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

    // Execute operation
    const result = await operation.execute(options);

    // Transform result to unified format
    return transformToUnifiedResult(operationType, result, options);
  } catch (error) {
    // Return a failed result with error details
    return createFailureResult(operationType, error as Error, options);
  }
}

/**
 * Transform operation-specific results to unified OperationResult format
 *
 * This function acts as a bridge between raw operation results and the unified
 * OperationResult type that the action outputs. It handles type normalization,
 * field mapping, and ensures consistent structure across all operation types.
 *
 * Now includes runtime validation using Zod schemas to ensure type safety
 * beyond compile-time checks.
 *
 * @param operationType The operation that was executed ('deploy' | 'diff' | 'remove' | 'stage')
 * @param result The raw result from the operation handler
 * @param _options Original operation options used for the execution
 * @returns Unified OperationResult with normalized types and consistent fields
 *
 * @example
 * ```typescript
 * const rawResult = await deployOperation.execute(options);
 * const unifiedResult = transformToUnifiedResult('deploy', rawResult, options);
 * console.log(unifiedResult.operation); // 'deploy'
 * console.log(unifiedResult.success); // boolean
 * ```
 */
function transformToUnifiedResult(
  operationType: SSTOperation,
  result: unknown,
  _options: OperationOptions
): OperationResult {
  switch (operationType) {
    case "deploy": {
      // Validate result at runtime before transformation
      const validated = validateRawDeployResult(result);
      return transformDeployResult(validated);
    }
    case "diff": {
      // Validate result at runtime before transformation
      const validated = validateRawDiffResult(result);
      return transformDiffResult(validated);
    }
    case "remove": {
      // Validate result at runtime before transformation
      const validated = validateRawRemoveResult(result);
      return transformRemoveResult(validated);
    }
    case "stage":
      // Stage operation returns the result directly as it already conforms to the unified format
      return result as OperationResult;
    default: {
      // Exhaustive check for TypeScript
      const _exhaustive: never = operationType;
      throw new Error(
        `Cannot transform result for unknown operation: ${_exhaustive}`
      );
    }
  }
}

/**
 * Transform DeployOperation result to unified format
 *
 * Converts raw deploy operation results into the standardized DeployResult format.
 * Handles output normalization, resource status validation, and optional field mapping.
 *
 * @param result Validated raw deploy operation result from the CLI
 * @returns Standardized DeployResult with normalized types
 */
function transformDeployResult(
  result: ReturnType<typeof validateRawDeployResult>
): DeployResult {
  return {
    app: result.metadata?.app || "unknown",
    completionStatus: result.success
      ? ("complete" as const)
      : ("failed" as const),
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    operation: "deploy" as const,
    outputs: result.outputs || [],
    rawOutput: result.metadata?.rawOutput || "",
    resourceChanges: result.resourceChanges || 0,
    resources: (result.resources || []).map((resource) => ({
      name: resource.name,
      status: normalizeResourceStatus(
        resource.status,
        resource.name,
        resource.type
      ),
      type: resource.type,
      ...(resource.timing && { timing: resource.timing }),
    })),
    stage: result.stage,
    success: result.success,
    truncated: result.metadata?.truncated ?? false,
    ...(result.error !== undefined && { error: result.error }),
    ...(result.permalink !== undefined && { permalink: result.permalink }),
  };
}

/**
 * Transform DiffOperation result to unified format
 *
 * Converts raw diff operation results into the standardized DiffResult format.
 * Normalizes change actions and handles optional field mapping for diff summaries.
 *
 * @param result Validated raw diff operation result from the CLI
 * @returns Standardized DiffResult with normalized types
 */
function transformDiffResult(
  result: ReturnType<typeof validateRawDiffResult>
): DiffResult {
  return {
    app: result.metadata?.app || "unknown",
    changeSummary: result.summary || "No changes detected",
    changes: (result.changes || []).map((change) => ({
      action: normalizeDiffAction(change.action, change.name, change.type),
      name: change.name,
      type: change.type,
      ...(change.details !== undefined && { details: change.details }),
    })),
    completionStatus: result.success
      ? ("complete" as const)
      : ("failed" as const),
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    operation: "diff" as const,
    plannedChanges: result.changesDetected || 0,
    rawOutput: result.metadata?.rawOutput || "",
    stage: result.stage,
    success: result.success,
    truncated: result.metadata?.truncated ?? false,
    ...(result.error !== undefined && { error: result.error }),
  };
}

/**
 * Transform RemoveOperation result to unified format
 *
 * Converts raw remove operation results into the standardized RemoveResult format.
 * Handles resource status normalization and completion status mapping.
 *
 * @param result Validated raw remove operation result from the CLI
 * @returns Standardized RemoveResult with normalized types
 */
function transformRemoveResult(
  result: ReturnType<typeof validateRawRemoveResult>
): RemoveResult {
  return {
    app: result.metadata?.app || "unknown",
    completionStatus: result.completionStatus || "failed",
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    operation: "remove" as const,
    rawOutput: result.metadata?.rawOutput || "",
    removedResources: (result.removedResources || []).map((resource) => ({
      name: resource.name,
      status: normalizeRemoveStatus(
        resource.status,
        resource.name,
        resource.type
      ),
      type: resource.type,
    })),
    resourcesRemoved: result.resourcesRemoved || 0,
    stage: result.stage,
    success: result.success,
    truncated: result.metadata?.truncated ?? false,
    ...(result.error !== undefined && { error: result.error }),
  };
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
    app: "unknown",
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
