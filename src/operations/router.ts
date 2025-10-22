/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

import * as core from '@actions/core';
import { GitHubClient } from '../github/client';
import type {
  DeployResult,
  DiffResult,
  OperationOptions,
  OperationResult,
  RemoveResult,
  SSTOperation,
} from '../types';
import { SSTCLIExecutor } from '../utils/cli';
import { OperationFactory } from './factory';
import {
  validateRawDeployResult,
  validateRawDiffResult,
  validateRawRemoveResult,
} from './schemas';

/**
 * Raw operation result types from the operation handlers
 */
interface RawOperationResults {
  deploy: {
    success: boolean;
    stage: string;
    metadata?: {
      app?: string;
      rawOutput?: string;
      cliExitCode?: number;
      truncated?: boolean;
    };
    error?: string;
    resourceChanges?: number;
    outputs?: Array<{ key: string; value: string }>;
    resources?: Array<{
      type: string;
      name: string;
      status: string;
      timing?: string;
    }>;
    permalink?: string;
  };
  diff: {
    success: boolean;
    stage: string;
    metadata?: {
      app?: string;
      rawOutput?: string;
      cliExitCode?: number;
      truncated?: boolean;
    };
    error?: string;
    changesDetected?: number;
    summary?: string;
    changes?: Array<{
      resourceType: string;
      resourceName: string;
      action: string;
      details?: string;
    }>;
  };
  remove: {
    success: boolean;
    stage: string;
    metadata?: {
      app?: string;
      rawOutput?: string;
      cliExitCode?: number;
      truncated?: boolean;
    };
    error?: string;
    completionStatus?: 'complete' | 'partial' | 'failed';
    resourcesRemoved?: number;
    removedResources?: Array<{
      resourceType: string;
      resourceName: string;
      status: string;
    }>;
  };
}

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
          `Supported operations: ${OperationFactory.getSupportedOperations().join(', ')}`
      );
    }

    // Create dependencies
    const cliExecutor = new SSTCLIExecutor();
    // Stage operations don't require a GitHub token, use empty string as fallback
    const token = operationType === 'stage' ? 'fake-token' : options.token;
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
    case 'deploy': {
      // Validate result at runtime before transformation
      const validated = validateRawDeployResult(result);
      return transformDeployResult(validated);
    }
    case 'diff': {
      // Validate result at runtime before transformation
      const validated = validateRawDiffResult(result);
      return transformDiffResult(validated);
    }
    case 'remove': {
      // Validate result at runtime before transformation
      const validated = validateRawRemoveResult(result);
      return transformRemoveResult(validated);
    }
    case 'stage':
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
 * Type guard to ensure resource status is valid
 *
 * Normalizes resource status values to ensure type safety. Unknown statuses
 * default to 'created' to provide a safe fallback behavior.
 *
 * Enhanced error messages include context for debugging.
 *
 * @param status Raw resource status from SST CLI output
 * @param resourceName Optional resource name for context
 * @param resourceType Optional resource type for context
 * @returns Normalized resource status ('created' | 'updated' | 'deleted')
 */
function normalizeResourceStatus(
  status: string,
  resourceName?: string,
  resourceType?: string
): 'created' | 'updated' | 'deleted' {
  const validStatuses: Array<'created' | 'updated' | 'deleted'> = [
    'created',
    'updated',
    'deleted',
  ];

  if ((validStatuses as readonly string[]).includes(status)) {
    return status as 'created' | 'updated' | 'deleted';
  }

  // Enhanced warning with context for debugging
  const context = [];
  if (resourceName) context.push(`resource: ${resourceName}`);
  if (resourceType) context.push(`type: ${resourceType}`);

  const contextStr = context.length > 0 ? ` (${context.join(', ')})` : '';

  core.warning(
    `⚠️  Unknown resource status encountered: '${status}'${contextStr}\n` +
    `    Valid statuses: ${validStatuses.join(', ')}\n` +
    `    Defaulting to: 'created'\n` +
    `    This may indicate a new SST CLI output format.`
  );

  return 'created'; // Default to created instead of unchanged
}

/**
 * Type guard to ensure diff action is valid
 *
 * Normalizes diff action types for consistent handling. Unknown actions
 * default to 'update' as the most common operation type.
 *
 * Enhanced error messages include context for debugging.
 *
 * @param action Raw diff action from SST CLI output
 * @param resourceName Optional resource name for context
 * @param resourceType Optional resource type for context
 * @returns Normalized diff action ('create' | 'update' | 'delete')
 */
function normalizeDiffAction(
  action: string,
  resourceName?: string,
  resourceType?: string
): 'create' | 'update' | 'delete' {
  const validActions: Array<'create' | 'update' | 'delete'> = [
    'create',
    'update',
    'delete',
  ];

  if ((validActions as readonly string[]).includes(action)) {
    return action as 'create' | 'update' | 'delete';
  }

  // Enhanced warning with context for debugging
  const context = [];
  if (resourceName) context.push(`resource: ${resourceName}`);
  if (resourceType) context.push(`type: ${resourceType}`);

  const contextStr = context.length > 0 ? ` (${context.join(', ')})` : '';

  core.warning(
    `⚠️  Unknown diff action encountered: '${action}'${contextStr}\n` +
    `    Valid actions: ${validActions.join(', ')}\n` +
    `    Defaulting to: 'update'\n` +
    `    This may indicate a new SST CLI diff format.`
  );

  return 'update';
}

/**
 * Type guard to ensure remove status is valid
 *
 * Normalizes remove operation status values. Unknown statuses default
 * to 'failed' to err on the side of caution for removal operations.
 *
 * Enhanced error messages include context for debugging.
 *
 * @param status Raw remove status from SST CLI output
 * @param resourceName Optional resource name for context
 * @param resourceType Optional resource type for context
 * @returns Normalized remove status ('removed' | 'failed' | 'skipped')
 */
function normalizeRemoveStatus(
  status: string,
  resourceName?: string,
  resourceType?: string
): 'removed' | 'failed' | 'skipped' {
  const validStatuses: Array<'removed' | 'failed' | 'skipped'> = [
    'removed',
    'failed',
    'skipped',
  ];

  if ((validStatuses as readonly string[]).includes(status)) {
    return status as 'removed' | 'failed' | 'skipped';
  }

  // Enhanced warning with context for debugging
  const context = [];
  if (resourceName) context.push(`resource: ${resourceName}`);
  if (resourceType) context.push(`type: ${resourceType}`);

  const contextStr = context.length > 0 ? ` (${context.join(', ')})` : '';

  core.warning(
    `⚠️  Unknown remove status encountered: '${status}'${contextStr}\n` +
    `    Valid statuses: ${validStatuses.join(', ')}\n` +
    `    Defaulting to: 'failed' (conservative default for removals)\n` +
    `    This may indicate a new SST CLI remove format.`
  );

  return 'failed';
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
    success: result.success,
    operation: 'deploy' as const,
    stage: result.stage,
    app: result.metadata?.app || 'unknown',
    rawOutput: result.metadata?.rawOutput || '',
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    truncated: result.metadata?.truncated ?? false,
    completionStatus: result.success
      ? ('complete' as const)
      : ('failed' as const),
    resourceChanges: result.resourceChanges || 0,
    outputs: result.outputs || [],
    resources: (result.resources || []).map((resource) => ({
      type: resource.type,
      name: resource.name,
      status: normalizeResourceStatus(resource.status, resource.name, resource.type),
      ...(resource.timing && { timing: resource.timing }),
    })),
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
    success: result.success,
    operation: 'diff' as const,
    stage: result.stage,
    app: result.metadata?.app || 'unknown',
    rawOutput: result.metadata?.rawOutput || '',
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    truncated: result.metadata?.truncated ?? false,
    completionStatus: result.success
      ? ('complete' as const)
      : ('failed' as const),
    plannedChanges: result.changesDetected || 0,
    changeSummary: result.summary || 'No changes detected',
    changes: (result.changes || []).map((change) => ({
      type: change.resourceType,
      name: change.resourceName,
      action: normalizeDiffAction(change.action, change.resourceName, change.resourceType),
      ...(change.details !== undefined && { details: change.details }),
    })),
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
    success: result.success,
    operation: 'remove' as const,
    stage: result.stage,
    app: result.metadata?.app || 'unknown',
    rawOutput: result.metadata?.rawOutput || '',
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    truncated: result.metadata?.truncated ?? false,
    completionStatus: result.completionStatus || 'failed',
    resourcesRemoved: result.resourcesRemoved || 0,
    removedResources: (result.removedResources || []).map((resource) => ({
      type: resource.resourceType,
      name: resource.resourceName,
      status: normalizeRemoveStatus(resource.status, resource.resourceName, resource.resourceType),
    })),
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
    success: false,
    operation: operationType,
    stage: options.stage,
    app: 'unknown',
    rawOutput: error.stack || error.message,
    exitCode: 1,
    truncated: false,
    completionStatus: 'failed' as const,
    error: error.message,
  };

  // Add operation-specific fields
  switch (operationType) {
    case 'deploy':
      return {
        ...baseResult,
        operation: 'deploy' as const,
        resourceChanges: 0,
        outputs: [],
        resources: [],
      };
    case 'diff':
      return {
        ...baseResult,
        operation: 'diff' as const,
        plannedChanges: 0,
        changeSummary: 'Operation failed',
        changes: [],
      };
    case 'remove':
      return {
        ...baseResult,
        operation: 'remove' as const,
        resourcesRemoved: 0,
        removedResources: [],
      };
    case 'stage':
      return {
        ...baseResult,
        operation: 'stage' as const,
        computedStage: options.stage,
        ref: '',
        eventName: 'unknown',
        isPullRequest: false,
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
