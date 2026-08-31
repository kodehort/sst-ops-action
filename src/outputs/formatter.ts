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
} from "../types";
import {
  type ValidatedOutputs,
  validateOutputs as validateWithSchema,
} from "./schema";

/**
 * Operation-specific output interfaces using discriminated unions
 * Each operation type has different output fields and requirements
 */

/**
 * Base outputs for infrastructure operations (deploy, diff, remove)
 */
interface BaseInfrastructureOutputs {
  app: string;
  completion_status: string;
  error: string;
  operation: string;
  permalink: string;
  stage: string;
  stages: string;
  success: string;
  truncated: string;
}

/**
 * Deploy operation outputs
 */
interface DeployOutputs extends BaseInfrastructureOutputs {
  computed_stage: string; // ''
  // Reset other operation fields
  diff_summary: string; // ''
  event_name: string; // ''
  is_pull_request: string; // ''
  operation: string; // 'deploy'
  outputs: string; // JSON object of generic deployment outputs
  planned_changes: string; // ''
  ref: string; // ''
  removed_resources: string; // ''
  resource_changes: string;
  resources: string; // JSON array of deployed resources
  resources_removed: string; // ''
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Diff operation outputs
 */
interface DiffOutputs extends BaseInfrastructureOutputs {
  computed_stage: string; // ''
  diff_summary: string;
  event_name: string; // ''
  is_pull_request: string; // ''
  operation: string; // 'diff'
  // Reset other operation fields
  outputs: string; // ''
  planned_changes: string;
  ref: string; // ''
  removed_resources: string; // ''
  resource_changes: string; // Same as planned_changes for consistency
  resources: string; // ''
  resources_removed: string; // ''
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Remove operation outputs
 */
interface RemoveOutputs extends BaseInfrastructureOutputs {
  computed_stage: string; // ''
  diff_summary: string; // ''
  event_name: string; // ''
  is_pull_request: string; // ''
  operation: string; // 'remove'
  // Reset other operation fields
  outputs: string; // ''
  planned_changes: string; // ''
  ref: string; // ''
  removed_resources: string; // JSON array of removed resources
  resource_changes: string; // Same as resources_removed for consistency
  resources: string; // ''
  resources_removed: string;
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Stage operation outputs - utility operation with minimal output
 */
interface StageOutputs {
  // Infrastructure fields not applicable
  app: string;
  completion_status: string;
  computed_stage: string; // Same as stage for convenience
  diff_summary: string;
  error: string;
  event_name: string; // GitHub event name
  is_pull_request: string; // Whether event is a pull request
  operation: string; // 'stage'
  outputs: string;
  permalink: string;
  planned_changes: string;
  ref: string; // Git ref used for computation
  removed_resources: string;
  resource_changes: string;
  resources: string;
  resources_removed: string;
  stage: string; // The computed stage name
  stages: string; // JSON array of {ref, stage} pairs for the refs input
  success: string;
  truncated: string;
  // Index signature for Record<string, string> compatibility
  [key: string]: string;
}

/**
 * Discriminated union of all operation-specific output types
 */
type OperationOutputs =
  | DeployOutputs
  | DiffOutputs
  | RemoveOutputs
  | StageOutputs;

/**
 * Format operation result for GitHub Actions output using discriminated unions
 * Provides type-safe operation-specific formatting with Zod validation
 */
function formatOperationForGitHubActions(
  result: OperationResult
): ValidatedOutputs {
  let outputs: OperationOutputs;

  switch (result.operation) {
    case "deploy":
      outputs = formatDeployOperation(result as DeployResult);
      break;
    case "diff":
      outputs = formatDiffOperation(result as DiffResult);
      break;
    case "remove":
      outputs = formatRemoveOperation(result as RemoveResult);
      break;
    case "stage":
      outputs = formatStageOperation(result as StageResult);
      break;
    default: {
      // Exhaustive check for TypeScript
      const _exhaustive: never = result;
      throw new Error(
        `Unknown operation type: ${(_exhaustive as { operation: string }).operation}`
      );
    }
  }

  // Validate outputs against Zod schema before returning
  return validateWithSchema(outputs);
}

/**
 * Format deploy operation result
 */
function formatDeployOperation(result: DeployResult): DeployOutputs {
  return {
    app: result.app || "",
    completion_status: result.completionStatus,
    computed_stage: "",
    // Reset other operation fields
    diff_summary: "",
    error: result.error || "",
    event_name: "",
    is_pull_request: "",
    operation: "deploy",
    outputs: safeStringify(result.outputs || []),
    permalink: result.permalink || "",
    planned_changes: "",
    ref: "",
    removed_resources: "",
    resource_changes: String(result.resourceChanges || 0),
    resources: safeStringify(result.resources || []),
    resources_removed: "",
    stage: result.stage,
    stages: "",
    success: String(result.success),
    truncated: String(result.truncated),
  };
}

/**
 * Format diff operation result
 */
function formatDiffOperation(result: DiffResult): DiffOutputs {
  return {
    app: result.app || "",
    completion_status: result.completionStatus,
    computed_stage: "",
    diff_summary: result.changeSummary || "",
    error: result.error || "",
    event_name: "",
    is_pull_request: "",
    operation: "diff",
    // Reset other operation fields
    outputs: "",
    permalink: result.permalink || "",
    planned_changes: String(result.plannedChanges || 0),
    ref: "",
    removed_resources: "",
    resource_changes: String(result.plannedChanges || 0),
    resources: "",
    resources_removed: "",
    stage: result.stage,
    stages: "",
    success: String(result.success),
    truncated: String(result.truncated),
  };
}

/**
 * Format remove operation result
 */
function formatRemoveOperation(result: RemoveResult): RemoveOutputs {
  return {
    app: result.app || "",
    completion_status: result.completionStatus,
    computed_stage: "",
    diff_summary: "",
    error: result.error || "",
    event_name: "",
    is_pull_request: "",
    operation: "remove",
    // Reset other operation fields
    outputs: "",
    permalink: result.permalink || "",
    planned_changes: "",
    ref: "",
    removed_resources: safeStringify(result.removedResources || []),
    resource_changes: String(result.resourcesRemoved || 0),
    resources: "",
    resources_removed: String(result.resourcesRemoved || 0),
    stage: result.stage,
    stages: "",
    success: String(result.success),
    truncated: String(result.truncated),
  };
}

/**
 * Format stage operation result
 */
function formatStageOperation(result: StageResult): StageOutputs {
  return {
    // Infrastructure fields not applicable
    app: "",
    completion_status: result.completionStatus,
    computed_stage: result.computedStage || result.stage,
    diff_summary: "",
    error: result.error || "",
    event_name: result.eventName || "",
    is_pull_request: String(result.isPullRequest),
    operation: "stage",
    outputs: "",
    permalink: "",
    planned_changes: "",
    ref: result.ref || "",
    removed_resources: "",
    resource_changes: "",
    resources: "",
    resources_removed: "",
    stage: result.stage,
    stages: safeStringify(result.stages || []),
    success: String(result.success),
    truncated: "false",
  };
}

/**
 * Safely stringify JSON values with error handling
 * Returns empty string if JSON serialization fails
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/**
 * Namespace wrapper for the functional API
 */
export const OutputFormatter = {
  formatOperationForGitHubActions,
} as const;
