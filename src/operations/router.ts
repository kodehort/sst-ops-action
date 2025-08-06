/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

import { GitHubClient } from '../github/client';
import type { OperationOptions, OperationResult, SSTOperation } from '../types';
import { SSTCLIExecutor } from '../utils/cli';
import { categorizeError } from '../utils/error-handling';
import { OperationFactory } from './factory';

/**
 * Result type mapping for operations to unified result format
 */
interface OperationResultMapper {
  deploy: any;
  diff: any;
  remove: any;
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
    const githubClient = new GitHubClient(options.token);

    // Create operation factory
    const factory = new OperationFactory(cliExecutor, githubClient);

    // Create operation instance
    const operation = factory.createOperation(operationType);

    // Execute operation
    const result = await operation.execute(options);

    // Transform result to unified format
    return transformToUnifiedResult(operationType, result, options);
  } catch (error) {
    // Categorize error for logging/debugging
    categorizeError(error as Error, {
      stage: options.stage,
      operation: operationType,
    });

    // Return a failed result with error details
    return createFailureResult(operationType, error as Error, options);
  }
}

/**
 * Transform operation-specific results to unified OperationResult format
 * @param operationType The operation that was executed
 * @param result The raw result from the operation
 * @param options Original operation options
 * @returns Unified OperationResult
 */
function transformToUnifiedResult(
  operationType: SSTOperation,
  result: any,
  _options: OperationOptions
): OperationResult {
  switch (operationType) {
    case 'deploy':
      return transformDeployResult(result);
    case 'diff':
      return transformDiffResult(result);
    case 'remove':
      return transformRemoveResult(result);
    default:
      throw new Error(
        `Cannot transform result for unknown operation: ${operationType}`
      );
  }
}

/**
 * Transform DeployOperation result to unified format
 */
function transformDeployResult(result: any): OperationResult {
  // DeployOperation already returns DeployResult format
  return result;
}

/**
 * Transform DiffOperation result to unified format
 */
function transformDiffResult(result: any): OperationResult {
  return {
    success: result.success,
    operation: 'diff' as const,
    stage: result.stage,
    app: result.metadata?.app || 'unknown',
    rawOutput: result.metadata?.rawOutput || '',
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    truncated: result.metadata?.truncated,
    completionStatus: result.success
      ? ('complete' as const)
      : ('failed' as const),
    error: result.error,
    plannedChanges: result.changesDetected,
    changeSummary: result.summary,
    changes: result.changes.map((change: any) => ({
      type: change.resourceType,
      name: change.resourceName,
      action: change.action,
      details: change.details,
    })),
  };
}

/**
 * Transform RemoveOperation result to unified format
 */
function transformRemoveResult(result: any): OperationResult {
  return {
    success: result.success,
    operation: 'remove' as const,
    stage: result.stage,
    app: result.metadata?.app || 'unknown',
    rawOutput: result.metadata?.rawOutput || '',
    exitCode: result.metadata?.cliExitCode || (result.success ? 0 : 1),
    truncated: result.metadata?.truncated,
    completionStatus: result.completionStatus,
    error: result.error,
    resourcesRemoved: result.resourcesRemoved,
    removedResources: result.removedResources.map((resource: any) => ({
      type: resource.resourceType,
      name: resource.resourceName,
      status: resource.status,
    })),
  };
}

/**
 * Create a factory instance with standard configuration
 * @param options Operation options containing credentials and settings
 * @returns Configured OperationFactory instance
 */
export function createOperationFactory(
  options: OperationOptions
): OperationFactory {
  const cliExecutor = new SSTCLIExecutor();
  const githubClient = new GitHubClient(options.token);

  return new OperationFactory(cliExecutor, githubClient);
}

/**
 * Create a failure result for error conditions
 * @param operationType The operation that failed
 * @param error The error that occurred
 * @param options The original operation options
 * @returns Failure result in unified format
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
        urls: [],
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
    default:
      // This should never happen but TypeScript needs it
      return {
        ...baseResult,
        operation: operationType,
        resourceChanges: 0,
        urls: [],
        resources: [],
      } as OperationResult;
  }
}

/**
 * Validate operation configuration before execution
 * @param operationType The operation type to validate
 * @param options The options to validate
 * @throws Error if configuration is invalid
 */
export function validateOperationConfig(
  operationType: SSTOperation,
  options: OperationOptions
): void {
  // Basic validation
  if (!options.stage) {
    throw new Error('Stage is required for all operations');
  }

  // Operation-specific validation
  switch (operationType) {
    case 'deploy':
      // Deploy-specific validation
      if (!options.token && process.env.NODE_ENV === 'production') {
      }
      break;
    case 'diff':
      // Diff-specific validation
      break;
    case 'remove':
      // Remove-specific validation
      if (
        options.stage === 'production' &&
        !options.environment?.CONFIRM_PRODUCTION_REMOVE
      ) {
        throw new Error(
          'Production remove operations require CONFIRM_PRODUCTION_REMOVE environment variable'
        );
      }
      break;
  }
}
