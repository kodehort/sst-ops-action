/**
 * Type system exports and utilities
 * Central export point for all type definitions and validation utilities
 */

// Core operation types
export type {
  BaseOperationResult,
  CommentMode,
  CompletionStatus,
  DeployResult,
  DiffResult,
  ExecutionStats,
  OperationContext,
  OperationMetadata,
  OperationOptions,
  OperationResult,
  ParsedSST,
  RemoveResult,
  SSTOperation,
  StageResult,
} from './operations.js';

// GitHub Actions types
export type {
  ActionEnvironment,
  ActionOutputs,
  ArtifactInfo,
  CommentMetadata,
  DeployOutputs,
  DiffOutputs,
  GitHubContext,
  RemoveOutputs,
  WorkflowSummary,
} from './outputs.js';

// SST CLI types
export type {
  SSTCommandResult,
  SSTConfig,
  SSTDeployOutput,
  SSTDiffOutput,
  SSTError,
  SSTParsePatterns,
  SSTRemoveOutput,
  SSTResource,
  SSTUrl,
  SSTValidationResult,
} from './sst.js';

import type { SSTRunner } from '../utils/cli.js';
import { SST_RUNNERS } from '../utils/cli.js';
import type {
  CommentMode,
  CompletionStatus,
  DeployResult,
  DiffResult,
  OperationResult,
  RemoveResult,
  SSTOperation,
  StageResult,
} from './operations.js';
import { SST_OPERATIONS } from './operations.js';
import type {
  SSTDeployOutput,
  SSTDiffOutput,
  SSTError,
  SSTRemoveOutput,
} from './sst.js';

/**
 * Regular expression for validating SST stage names
 */
const SST_STAGE_NAME_PATTERN = /^[a-zA-Z0-9-_]+$/;

/**
 * Type guards for operation results
 */
export function isDeployResult(
  result: OperationResult
): result is DeployResult {
  return result.operation === 'deploy';
}

export function isDiffResult(result: OperationResult): result is DiffResult {
  return result.operation === 'diff';
}

export function isRemoveResult(
  result: OperationResult
): result is RemoveResult {
  return result.operation === 'remove';
}

export function isStageResult(result: OperationResult): result is StageResult {
  return result.operation === 'stage';
}

/**
 * Type guards for SST operations
 */
export function isValidOperation(operation: string): operation is SSTOperation {
  return SST_OPERATIONS.includes(operation as SSTOperation);
}

export function isValidCommentMode(mode: string): mode is CommentMode {
  return ['always', 'on-success', 'on-failure', 'never'].includes(mode);
}

export function isValidCompletionStatus(
  status: string
): status is CompletionStatus {
  return ['complete', 'partial', 'failed'].includes(status);
}

/**
 * Validation utilities
 */
export function validateOperation(operation: unknown): SSTOperation {
  if (typeof operation !== 'string') {
    throw new Error('Operation must be a string');
  }

  if (!isValidOperation(operation)) {
    throw new Error(
      `Invalid operation: ${operation}. Must be one of: deploy, diff, remove, stage`
    );
  }

  return operation;
}

export function validateCommentMode(mode: unknown): CommentMode {
  if (typeof mode !== 'string') {
    throw new Error('Comment mode must be a string');
  }

  if (!isValidCommentMode(mode)) {
    throw new Error(
      `Invalid comment mode: ${mode}. Must be one of: always, on-success, on-failure, never`
    );
  }

  return mode;
}

export function validateStage(stage: unknown): string {
  if (typeof stage !== 'string' || stage.trim() === '') {
    throw new Error('Stage must be a non-empty string');
  }

  const trimmedStage = stage.trim();

  // Basic validation for SST stage naming
  if (!SST_STAGE_NAME_PATTERN.test(trimmedStage)) {
    throw new Error(
      'Stage must contain only alphanumeric characters, hyphens, and underscores'
    );
  }

  return trimmedStage;
}

export function validateMaxOutputSize(size: unknown): number {
  const parsed = typeof size === 'string' ? Number.parseInt(size, 10) : size;

  if (typeof parsed !== 'number' || Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Max output size must be a non-negative number');
  }

  // Set reasonable bounds (1000 min, 1MB max)
  if (parsed > 0 && parsed < 1000) {
    throw new Error(
      'Max output size must be at least 1000 bytes (except 0 for unlimited)'
    );
  }

  if (parsed > 1024 * 1024) {
    throw new Error('Max output size cannot exceed 1MB (1048576 bytes)');
  }

  return parsed;
}

/**
 * SST output validation
 */
export function validateSSTOutput(
  output: unknown,
  operation: SSTOperation
): SSTDeployOutput | SSTDiffOutput | SSTRemoveOutput {
  if (!output || typeof output !== 'object') {
    throw new Error('SST output must be an object');
  }

  const obj = output as Record<string, unknown>;

  if (typeof obj.app !== 'string' || typeof obj.stage !== 'string') {
    throw new Error('SST output must include app and stage');
  }

  switch (operation) {
    case 'deploy':
      return validateDeployOutput(obj);
    case 'diff':
      return validateDiffOutput(obj);
    case 'remove':
      return validateRemoveOutput(obj);
    case 'stage':
      // Stage operation doesn't use SST output validation - it computes stage internally
      throw new Error('Stage operation does not use SST output validation');
    default: {
      // Exhaustive check for TypeScript
      const _exhaustive: never = operation;
      throw new Error(`Unsupported operation: ${_exhaustive}`);
    }
  }
}

function validateDeployOutput(obj: Record<string, unknown>): SSTDeployOutput {
  const required = [
    'app',
    'stage',
    'region',
    'resources',
    'outputs',
    'urls',
    'duration',
    'status',
  ];

  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Deploy output missing required field: ${field}`);
    }
  }

  return obj as unknown as SSTDeployOutput;
}

function validateDiffOutput(obj: Record<string, unknown>): SSTDiffOutput {
  const required = ['app', 'stage', 'region', 'changes', 'summary', 'status'];

  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Diff output missing required field: ${field}`);
    }
  }

  return obj as unknown as SSTDiffOutput;
}

function validateRemoveOutput(obj: Record<string, unknown>): SSTRemoveOutput {
  const required = [
    'app',
    'stage',
    'region',
    'removed',
    'summary',
    'duration',
    'status',
  ];

  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Remove output missing required field: ${field}`);
    }
  }

  return obj as unknown as SSTRemoveOutput;
}

/**
 * Error handling utilities
 */
export function createSSTError(
  code: string,
  message: string,
  details?: string
): SSTError {
  const error: SSTError = {
    code,
    message,
  };

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

export function isSSTError(error: unknown): error is SSTError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as SSTError).code === 'string' &&
    typeof (error as SSTError).message === 'string'
  );
}

/**
 * Operation-specific input schemas using discriminated unions
 * Each operation has different input requirements and validation rules
 */

/**
 * Base schema for SST infrastructure operations (deploy, diff, remove)
 * These operations interact with AWS and require authentication
 */
export interface BaseInfrastructureInputs {
  token: string;
  commentMode?: CommentMode;
  failOnError?: boolean;
  maxOutputSize?: number;
  runner?: SSTRunner;
}

/**
 * Deploy operation inputs - can auto-compute stage from Git context
 */
export interface DeployInputs extends BaseInfrastructureInputs {
  stage?: string;
}

/**
 * Diff operation inputs - requires explicit stage for comparison target
 */
export interface DiffInputs extends BaseInfrastructureInputs {
  stage: string;
}

/**
 * Remove operation inputs - requires explicit stage for safety
 */
export interface RemoveInputs extends BaseInfrastructureInputs {
  stage: string;
}

/**
 * Stage operation inputs - standalone utility for stage name computation
 * No token or infrastructure access required
 */
export interface StageInputs {
  truncationLength?: number;
  prefix?: string;
}

/**
 * Discriminated union of all operation-specific input types
 */
export type OperationInputs =
  | ({ operation: 'deploy' } & DeployInputs)
  | ({ operation: 'diff' } & DiffInputs)
  | ({ operation: 'remove' } & RemoveInputs)
  | ({ operation: 'stage' } & StageInputs);

/**
 * Type guards for operation input types
 */
export function isDeployInputs(
  inputs: OperationInputs
): inputs is { operation: 'deploy' } & DeployInputs {
  return inputs.operation === 'deploy';
}

export function isDiffInputs(
  inputs: OperationInputs
): inputs is { operation: 'diff' } & DiffInputs {
  return inputs.operation === 'diff';
}

export function isRemoveInputs(
  inputs: OperationInputs
): inputs is { operation: 'remove' } & RemoveInputs {
  return inputs.operation === 'remove';
}

export function isStageInputs(
  inputs: OperationInputs
): inputs is { operation: 'stage' } & StageInputs {
  return inputs.operation === 'stage';
}

/**
 * Re-export constants for convenient access
 */
export { SST_OPERATIONS } from './operations.js';
export { SST_RUNNERS } from '../utils/cli.js';
