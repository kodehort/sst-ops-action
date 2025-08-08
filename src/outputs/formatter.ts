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
} from '../types';

// Export the main function as default
export { formatForGitHubActions as default };

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
  urls: string; // JSON array for deploy operations
  resources: string; // JSON array for deploy operations
  diff_summary: string; // Summary for diff operations
  planned_changes: string; // Number for diff operations
  resources_removed: string; // Number for remove operations
  removed_resources: string; // JSON array for remove operations
}

/**
 * Format operation result for GitHub Actions output
 * Converts all values to strings and handles optional fields
 */
export function formatForGitHubActions(
  result: OperationResult
): Record<string, string> {
  const outputs: Record<string, string> = {};

  // Required fields - always set
  outputs.success = String(result.success);
  outputs.operation = result.operation;
  outputs.stage = result.stage;
  outputs.completion_status = result.completionStatus;

  // Common optional fields - use empty string for missing values
  outputs.app = result.app || '';
  outputs.permalink = result.permalink || '';
  outputs.truncated = String(result.truncated);
  outputs.error = result.error || '';

  // Default resource_changes
  outputs.resource_changes = '0';

  // Reset operation-specific fields to empty strings
  outputs.urls = '';
  outputs.resources = '';
  outputs.diff_summary = '';
  outputs.planned_changes = '';
  outputs.resources_removed = '';
  outputs.removed_resources = '';

  // Operation-specific outputs
  switch (result.operation) {
    case 'deploy':
      return formatDeployOutputs(result as DeployResult, outputs);
    case 'diff':
      return formatDiffOutputs(result as DiffResult, outputs);
    case 'remove':
      return formatRemoveOutputs(result as RemoveResult, outputs);
    default:
      return outputs;
  }
}

/**
 * Format deploy-specific outputs
 */
function formatDeployOutputs(
  result: DeployResult,
  outputs: Record<string, string>
): Record<string, string> {
  outputs.resource_changes = String(result.resourceChanges || 0);
  outputs.urls = safeStringify(result.urls || []);
  outputs.resources = safeStringify(result.resources || []);

  return outputs;
}

/**
 * Format diff-specific outputs
 */
function formatDiffOutputs(
  result: DiffResult,
  outputs: Record<string, string>
): Record<string, string> {
  outputs.resource_changes = String(result.plannedChanges || 0);
  outputs.planned_changes = String(result.plannedChanges || 0);
  outputs.diff_summary = result.changeSummary || '';

  return outputs;
}

/**
 * Format remove-specific outputs
 */
function formatRemoveOutputs(
  result: RemoveResult,
  outputs: Record<string, string>
): Record<string, string> {
  outputs.resource_changes = String(result.resourcesRemoved || 0);
  outputs.resources_removed = String(result.resourcesRemoved || 0);
  outputs.removed_resources = safeStringify(result.removedResources || []);

  return outputs;
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
  const booleanFields = [{ name: 'success' }, { name: 'truncated' }];

  for (const { name } of booleanFields) {
    if (!(outputs[name] && ['true', 'false'].includes(outputs[name]))) {
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
    { name: 'operation', validValues: ['deploy', 'diff', 'remove'] },
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
  const jsonFields = ['urls', 'resources', 'removed_resources'];

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
    'urls',
    'resources',
    'diff_summary',
    'planned_changes',
    'resources_removed',
    'removed_resources',
  ];
}

/**
 * Get required output field names
 */
export function getRequiredFields(): string[] {
  return ['success', 'operation', 'stage', 'completion_status'];
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
      // Deploy operations should have urls and resources (even if empty JSON arrays)
      if (!outputs.urls) {
        outputs.urls = '[]';
      }
      if (!outputs.resources) {
        outputs.resources = '[]';
      }
      break;
    case 'diff':
      // Diff operations should have planned_changes and diff_summary
      if (!outputs.planned_changes) {
        outputs.planned_changes = '0';
      }
      if (!outputs.diff_summary) {
        outputs.diff_summary = '';
      }
      break;
    case 'remove':
      // Remove operations should have resources_removed and removed_resources
      if (!outputs.resources_removed) {
        outputs.resources_removed = '0';
      }
      if (!outputs.removed_resources) {
        outputs.removed_resources = '[]';
      }
      break;
    default:
      // No additional validation for unknown operations
      break;
  }
}

/**
 * Backward compatibility namespace wrapper for the functional API
 * @deprecated Use the individual functions instead
 */
export const OutputFormatter = {
  formatForGitHubActions,
  validateOutputs,
  getExpectedFields,
  getRequiredFields,
  validateOperationConsistency,
} as const;
