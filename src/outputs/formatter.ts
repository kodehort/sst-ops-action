/**
 * Output Format Standardization
 * Ensures all operations produce consistent outputs for GitHub Actions
 * with proper type conversion and validation
 */

import type {
  DeployResult,
  DiffResult,
  OperationResult,
  RemoveResult,
  StageResult,
} from '../types';
import { SST_OPERATIONS } from '../types/operations';

// Export the main function as default
export { formatOperationForGitHubActions as default };

/**
 * Standardized output format for GitHub Actions
 * All values must be strings as required by GitHub Actions
 */
export interface StandardizedOutputs {
  // Required outputs (always present)
  success: string;
  operation: string;
  stage: string;
  completion_status: string;

  // Common optional outputs
  app: string;
  permalink: string;
  truncated: string;
  resource_changes: string;
  error: string;

  // Operation-specific outputs
  outputs: string; // JSON array for deploy operations
  resources: string; // JSON array for deploy operations
  diff_summary: string; // Summary for diff operations
  planned_changes: string; // Number for diff operations
  resources_removed: string; // Number for remove operations
  removed_resources: string; // JSON array for remove operations
  computed_stage: string; // Computed stage name for stage operations
  ref: string; // Git ref for stage operations
  event_name: string; // GitHub event name for stage operations
  is_pull_request: string; // Whether event is a pull request for stage operations
}

/**
 * Operation-specific output interfaces using discriminated unions
 * Each operation type has different output fields and requirements
 */

/**
 * Base outputs for infrastructure operations (deploy, diff, remove)
 */
interface BaseInfrastructureOutputs {
  success: string;
  operation: string;
  stage: string;
  completion_status: string;
  app: string;
  permalink: string;
  truncated: string;
  error: string;
}

/**
 * Deploy operation outputs
 */
export interface DeployOutputs extends BaseInfrastructureOutputs {
  operation: string; // 'deploy'
  resource_changes: string;
  outputs: string; // JSON array of deployed URLs
  resources: string; // JSON array of deployed resources
  // Reset other operation fields
  diff_summary: string; // ''
  planned_changes: string; // ''
  resources_removed: string; // ''
  removed_resources: string; // ''
  computed_stage: string; // ''
  ref: string; // ''
  event_name: string; // ''
  is_pull_request: string; // ''
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Diff operation outputs
 */
export interface DiffOutputs extends BaseInfrastructureOutputs {
  operation: string; // 'diff'
  resource_changes: string; // Same as planned_changes for consistency
  planned_changes: string;
  diff_summary: string;
  // Reset other operation fields
  outputs: string; // ''
  resources: string; // ''
  resources_removed: string; // ''
  removed_resources: string; // ''
  computed_stage: string; // ''
  ref: string; // ''
  event_name: string; // ''
  is_pull_request: string; // ''
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Remove operation outputs
 */
export interface RemoveOutputs extends BaseInfrastructureOutputs {
  operation: string; // 'remove'
  resource_changes: string; // Same as resources_removed for consistency
  resources_removed: string;
  removed_resources: string; // JSON array of removed resources
  // Reset other operation fields
  outputs: string; // ''
  resources: string; // ''
  diff_summary: string; // ''
  planned_changes: string; // ''
  computed_stage: string; // ''
  ref: string; // ''
  event_name: string; // ''
  is_pull_request: string; // ''
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Stage operation outputs - utility operation with minimal output
 */
export interface StageOutputs {
  success: string;
  operation: string; // 'stage'
  stage: string; // The computed stage name
  completion_status: string;
  computed_stage: string; // Same as stage for convenience
  ref: string; // Git ref used for computation
  event_name: string; // GitHub event name
  is_pull_request: string; // Whether event is a pull request
  // Infrastructure fields not applicable
  app: string;
  permalink: string;
  truncated: string;
  resource_changes: string;
  error: string;
  outputs: string;
  resources: string;
  diff_summary: string;
  planned_changes: string;
  resources_removed: string;
  removed_resources: string;
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Discriminated union of all operation-specific output types
 */
export type OperationOutputs =
  | DeployOutputs
  | DiffOutputs
  | RemoveOutputs
  | StageOutputs;

/**
 * Format operation result for GitHub Actions output using discriminated unions
 * Provides type-safe operation-specific formatting
 */
export function formatOperationForGitHubActions(
  result: OperationResult
): OperationOutputs {
  switch (result.operation) {
    case 'deploy':
      return formatDeployOperation(result as DeployResult);
    case 'diff':
      return formatDiffOperation(result as DiffResult);
    case 'remove':
      return formatRemoveOperation(result as RemoveResult);
    case 'stage':
      return formatStageOperation(result as StageResult);
    default: {
      // Exhaustive check for TypeScript
      const _exhaustive: never = result;
      throw new Error(
        `Unknown operation type: ${(_exhaustive as { operation: string }).operation}`
      );
    }
  }
}

/**
 * Format deploy operation result
 */
function formatDeployOperation(result: DeployResult): DeployOutputs {
  return {
    success: String(result.success),
    operation: 'deploy',
    stage: result.stage,
    completion_status: result.completionStatus,
    app: result.app || '',
    permalink: result.permalink || '',
    truncated: String(result.truncated),
    error: result.error || '',
    resource_changes: String(result.resourceChanges || 0),
    outputs: safeStringify(result.outputs || []),
    resources: safeStringify(result.resources || []),
    // Reset other operation fields
    diff_summary: '',
    planned_changes: '',
    resources_removed: '',
    removed_resources: '',
    computed_stage: '',
    ref: '',
    event_name: '',
    is_pull_request: '',
  };
}

/**
 * Format diff operation result
 */
function formatDiffOperation(result: DiffResult): DiffOutputs {
  return {
    success: String(result.success),
    operation: 'diff',
    stage: result.stage,
    completion_status: result.completionStatus,
    app: result.app || '',
    permalink: result.permalink || '',
    truncated: String(result.truncated),
    error: result.error || '',
    resource_changes: String(result.plannedChanges || 0),
    planned_changes: String(result.plannedChanges || 0),
    diff_summary: result.changeSummary || '',
    // Reset other operation fields
    outputs: '',
    resources: '',
    resources_removed: '',
    removed_resources: '',
    computed_stage: '',
    ref: '',
    event_name: '',
    is_pull_request: '',
  };
}

/**
 * Format remove operation result
 */
function formatRemoveOperation(result: RemoveResult): RemoveOutputs {
  return {
    success: String(result.success),
    operation: 'remove',
    stage: result.stage,
    completion_status: result.completionStatus,
    app: result.app || '',
    permalink: result.permalink || '',
    truncated: String(result.truncated),
    error: result.error || '',
    resource_changes: String(result.resourcesRemoved || 0),
    resources_removed: String(result.resourcesRemoved || 0),
    removed_resources: safeStringify(result.removedResources || []),
    // Reset other operation fields
    outputs: '',
    resources: '',
    diff_summary: '',
    planned_changes: '',
    computed_stage: '',
    ref: '',
    event_name: '',
    is_pull_request: '',
  };
}

/**
 * Format stage operation result
 */
function formatStageOperation(result: StageResult): StageOutputs {
  return {
    success: String(result.success),
    operation: 'stage',
    stage: result.stage,
    completion_status: result.completionStatus,
    computed_stage: result.computedStage || result.stage,
    ref: result.ref || '',
    event_name: result.eventName || '',
    is_pull_request: String(result.isPullRequest),
    // Infrastructure fields not applicable
    app: '',
    permalink: '',
    truncated: 'false',
    resource_changes: '',
    error: result.error || '',
    outputs: '',
    resources: '',
    diff_summary: '',
    planned_changes: '',
    resources_removed: '',
    removed_resources: '',
  };
}

/**
 * Safely stringify JSON values with error handling
 * Returns empty string if JSON serialization fails
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return '';
  }
}

/**
 * Validate that all required output fields are present
 * Throws error if any required field is missing
 */
export function validateOutputs(outputs: Record<string, string>): void {
  const requiredFields = ['success', 'operation', 'stage', 'completion_status'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (outputs[field] === undefined || outputs[field] === null) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Required output fields missing: ${missingFields.join(', ')}`
    );
  }

  // Validate field types and values
  validateFieldValues(outputs);
}

/**
 * Validate field values meet expected formats
 */
function validateFieldValues(outputs: Record<string, string>): void {
  validateBooleanFields(outputs);
  validateEnumFields(outputs);
  validateNumericFields(outputs);
  validateJsonFields(outputs);
}

/**
 * Validate boolean field values
 */
function validateBooleanFields(outputs: Record<string, string>): void {
  const booleanFields = [
    { name: 'success' },
    { name: 'truncated' },
    { name: 'is_pull_request' },
  ];

  for (const { name } of booleanFields) {
    if (
      outputs[name] &&
      outputs[name] !== '' &&
      !['true', 'false'].includes(outputs[name])
    ) {
      throw new Error(
        `Invalid '${name}' value: '${outputs[name] ?? 'undefined'}'. Must be 'true' or 'false'.`
      );
    }
  }
}

/**
 * Validate enum field values
 */
function validateEnumFields(outputs: Record<string, string>): void {
  const enumFields = [
    { name: 'operation', validValues: [...SST_OPERATIONS] },
    {
      name: 'completion_status',
      validValues: ['complete', 'partial', 'failed'],
    },
  ];

  for (const { name, validValues } of enumFields) {
    if (!(outputs[name] && validValues.includes(outputs[name]))) {
      throw new Error(
        `Invalid '${name}' value: '${outputs[name] ?? 'undefined'}'. Must be one of: ${validValues.join(', ')}.`
      );
    }
  }
}

/**
 * Validate numeric field values
 */
function validateNumericFields(outputs: Record<string, string>): void {
  const numericFields = [
    'resource_changes',
    'planned_changes',
    'resources_removed',
  ];

  for (const field of numericFields) {
    if (outputs[field] && outputs[field] !== '') {
      const numValue = Number(outputs[field]);
      if (Number.isNaN(numValue) || numValue < 0) {
        throw new Error(
          `Invalid '${field}' value: '${outputs[field]}'. Must be a non-negative number.`
        );
      }
    }
  }
}

/**
 * Validate JSON field values
 */
function validateJsonFields(outputs: Record<string, string>): void {
  const jsonFields = ['outputs', 'resources', 'removed_resources'];

  for (const field of jsonFields) {
    if (outputs[field] && outputs[field] !== '') {
      try {
        JSON.parse(outputs[field]);
      } catch (error) {
        throw new Error(
          `Invalid '${field}' value: not valid JSON. ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }
}

/**
 * Get all expected output field names
 * Useful for documentation and testing
 */
export function getExpectedFields(): string[] {
  return [
    'success',
    'operation',
    'stage',
    'completion_status',
    'app',
    'permalink',
    'truncated',
    'resource_changes',
    'error',
    'outputs',
    'resources',
    'diff_summary',
    'planned_changes',
    'resources_removed',
    'removed_resources',
    'computed_stage',
    'ref',
    'event_name',
    'is_pull_request',
  ];
}

/**
 * Get required output field names
 */
export function getRequiredFields(): string[] {
  return ['success', 'operation', 'stage', 'completion_status'];
}

/**
 * Set default values for deploy operation outputs
 */
function setDeployDefaults(outputs: Record<string, string>): void {
  outputs.outputs = outputs.outputs || '[]';
  outputs.resources = outputs.resources || '[]';
}

/**
 * Set default values for diff operation outputs
 */
function setDiffDefaults(outputs: Record<string, string>): void {
  outputs.planned_changes = outputs.planned_changes || '0';
  outputs.diff_summary = outputs.diff_summary || '';
}

/**
 * Set default values for remove operation outputs
 */
function setRemoveDefaults(outputs: Record<string, string>): void {
  outputs.resources_removed = outputs.resources_removed || '0';
  outputs.removed_resources = outputs.removed_resources || '[]';
}

/**
 * Set default values for stage operation outputs
 */
function setStageDefaults(outputs: Record<string, string>): void {
  outputs.computed_stage = outputs.computed_stage || '';
  outputs.ref = outputs.ref || '';
  outputs.event_name = outputs.event_name || '';
  outputs.is_pull_request = outputs.is_pull_request || 'false';
}

/**
 * Check if outputs are consistent with the operation type
 * Validates that operation-specific fields are set appropriately
 */
export function validateOperationConsistency(
  outputs: Record<string, string>,
  operation: string
): void {
  switch (operation) {
    case 'deploy':
      setDeployDefaults(outputs);
      break;
    case 'diff':
      setDiffDefaults(outputs);
      break;
    case 'remove':
      setRemoveDefaults(outputs);
      break;
    case 'stage':
      setStageDefaults(outputs);
      break;
    default:
      // No additional validation for unknown operations
      break;
  }
}

/**
 * Namespace wrapper for the functional API
 */
export const OutputFormatter = {
  formatOperationForGitHubActions,
  validateOutputs,
  getExpectedFields,
  getRequiredFields,
  validateOperationConsistency,
} as const;
