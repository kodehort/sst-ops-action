/**
 * Core types for SST operation handling and results
 * Defines the unified type system for deploy, diff, and remove operations
 */

import type { SSTRunner } from "../utils/cli.js";

/**
 * Array of all supported SST operations - single source of truth
 * Used to derive the SSTOperation type and validate operation values
 */
export const SST_OPERATIONS = ["deploy", "diff", "remove", "stage"] as const;

/**
 * Union type of all supported SST operations
 * Derived from SST_OPERATIONS constant to ensure consistency
 */
export type SSTOperation = (typeof SST_OPERATIONS)[number];

export type CommentMode = "always" | "on-success" | "on-failure" | "never";

export type CompletionStatus = "complete" | "partial" | "failed";

export interface OperationOptions {
  commentMode?: CommentMode;
  failOnError?: boolean;
  maxOutputSize?: number;
  prefix?: string;
  runner?: SSTRunner;
  stage: string;
  token?: string;
  truncationLength?: number;
}

export interface BaseOperationResult {
  app: string;
  completionStatus: CompletionStatus;
  error?: string;
  exitCode: number;
  operation: SSTOperation;
  permalink?: string;
  rawOutput: string;
  stage: string;
  success: boolean;
  truncated: boolean;
}

export interface DeployResult extends BaseOperationResult {
  operation: "deploy";
  outputs: Array<{
    key: string;
    value: string;
  }>;
  resourceChanges: number;
  resources: Array<{
    type: string;
    name: string;
    status: "created" | "updated" | "deleted";
    timing?: string;
  }>;
}

export interface DiffResult extends BaseOperationResult {
  changeSummary: string;
  changes: Array<{
    type: string;
    name: string;
    action: "create" | "update" | "delete";
    details?: string;
  }>;
  operation: "diff";
  plannedChanges: number;
}

export interface RemoveResult extends BaseOperationResult {
  operation: "remove";
  removedResources: Array<{
    type: string;
    name: string;
    status: "removed" | "failed" | "skipped";
  }>;
  resourcesRemoved: number;
}

export interface StageResult extends BaseOperationResult {
  computedStage: string;
  eventName: string;
  isPullRequest: boolean;
  operation: "stage";
  ref: string;
}

export type OperationResult =
  | DeployResult
  | DiffResult
  | RemoveResult
  | StageResult;

export interface OperationContext {
  actor: string;
  operation: SSTOperation;
  options: OperationOptions;
  ref: string;
  runId: string;
  sha: string;
  startTime: Date;
  workflowId: string;
}

export interface ParsedSST {
  app: string;
  errors?: string[];
  outputs?: Record<string, unknown>;
  region?: string;
  stage: string;
  warnings?: string[];
}

export interface ExecutionStats {
  cpuTime?: number;
  duration: number;
  memoryUsage?: number;
  outputSize: number;
}

export interface OperationMetadata {
  environment: "github-actions";
  runner: {
    os: string;
    arch: string;
    nodeVersion: string;
  };
  timestamp: string;
  version: string;
}
