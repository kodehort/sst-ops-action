/**
 * Operation Router
 * Routes operation requests to the appropriate operation handler
 * Provides unified interface and consistent error handling
 */

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
    urls?: Array<{ name: string; url: string; type: string }>;
    resources?: Array<{ type: string; name: string; status: string }>;
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
  result: unknown,
  _options: OperationOptions
): OperationResult {
  switch (operationType) {
    case 'deploy':
      return transformDeployResult(result as RawOperationResults['deploy']);
    case 'diff':
      return transformDiffResult(result as RawOperationResults['diff']);
    case 'remove':
      return transformRemoveResult(result as RawOperationResults['remove']);
    case 'stage':
      // Stage operation returns the result directly as it already conforms to the unified format
      return result as OperationResult;
    default:
      throw new Error(
        `Cannot transform result for unknown operation: ${operationType}`
      );
  }
}

/**
 * Type guard to ensure URL type is valid
 */
function normalizeUrlType(type: string): 'function' | 'api' | 'web' | 'other' {
  const validTypes: Array<'function' | 'api' | 'web' | 'other'> = [
    'function',
    'api',
    'web',
    'other',
  ];
  return (validTypes as readonly string[]).includes(type)
    ? (type as 'function' | 'api' | 'web' | 'other')
    : 'other';
}

/**
 * Type guard to ensure resource status is valid
 */
function normalizeResourceStatus(
  status: string
): 'created' | 'updated' | 'unchanged' {
  const validStatuses: Array<'created' | 'updated' | 'unchanged'> = [
    'created',
    'updated',
    'unchanged',
  ];
  return (validStatuses as readonly string[]).includes(status)
    ? (status as 'created' | 'updated' | 'unchanged')
    : 'unchanged';
}

/**
 * Type guard to ensure diff action is valid
 */
function normalizeDiffAction(action: string): 'create' | 'update' | 'delete' {
  const validActions: Array<'create' | 'update' | 'delete'> = [
    'create',
    'update',
    'delete',
  ];
  return (validActions as readonly string[]).includes(action)
    ? (action as 'create' | 'update' | 'delete')
    : 'update';
}

/**
 * Type guard to ensure remove status is valid
 */
function normalizeRemoveStatus(
  status: string
): 'removed' | 'failed' | 'skipped' {
  const validStatuses: Array<'removed' | 'failed' | 'skipped'> = [
    'removed',
    'failed',
    'skipped',
  ];
  return (validStatuses as readonly string[]).includes(status)
    ? (status as 'removed' | 'failed' | 'skipped')
    : 'failed';
}

/**
 * Transform DeployOperation result to unified format
 */
function transformDeployResult(
  result: RawOperationResults['deploy']
): DeployResult {
  const deployResult: DeployResult = {
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
    urls: (result.urls || []).map((url) => ({
      name: url.name,
      url: url.url,
      type: normalizeUrlType(url.type),
    })),
    resources: (result.resources || []).map((resource) => ({
      type: resource.type,
      name: resource.name,
      status: normalizeResourceStatus(resource.status),
    })),
  };

  if (result.error !== undefined) {
    deployResult.error = result.error;
  }

  if (result.permalink !== undefined) {
    deployResult.permalink = result.permalink;
  }

  return deployResult;
}

/**
 * Transform DiffOperation result to unified format
 */
function transformDiffResult(result: RawOperationResults['diff']): DiffResult {
  const diffResult: DiffResult = {
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
    changes: (result.changes || []).map((change) => {
      const changeResult: {
        type: string;
        name: string;
        action: 'create' | 'update' | 'delete';
        details?: string;
      } = {
        type: change.resourceType,
        name: change.resourceName,
        action: normalizeDiffAction(change.action),
      };

      if (change.details !== undefined) {
        changeResult.details = change.details;
      }

      return changeResult;
    }),
  };

  if (result.error !== undefined) {
    diffResult.error = result.error;
  }

  return diffResult;
}

/**
 * Transform RemoveOperation result to unified format
 */
function transformRemoveResult(
  result: RawOperationResults['remove']
): RemoveResult {
  const removeResult: RemoveResult = {
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
      status: normalizeRemoveStatus(resource.status),
    })),
  };

  if (result.error !== undefined) {
    removeResult.error = result.error;
  }

  return removeResult;
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
    case 'stage':
      return {
        ...baseResult,
        operation: 'stage' as const,
        computedStage: options.stage,
        ref: '',
        eventName: 'unknown',
        isPullRequest: false,
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
  // Basic validation - stage will be computed if not provided
  // No need to validate stage here as it can be computed automatically

  // Operation-specific validation
  switch (operationType) {
    case 'deploy':
      // Deploy-specific validation
      if (!options.token && process.env.NODE_ENV === 'production') {
        throw new Error(
          'GitHub token is required for deploy operations in production environment'
        );
      }
      break;
    case 'diff':
      // Diff-specific validation - no additional requirements currently
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
    default:
      // This should never happen due to earlier validation, but TypeScript requires it
      throw new Error(`Unknown operation type: ${operationType}`);
  }
}
