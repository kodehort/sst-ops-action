/**
 * Core types for SST operation handling and results
 * Defines the unified type system for deploy, diff, and remove operations
 */

export type SSTOperation = 'deploy' | 'diff' | 'remove' | 'stage';

export type CommentMode = 'always' | 'on-success' | 'on-failure' | 'never';

export type CompletionStatus = 'complete' | 'partial' | 'failed';

export interface OperationOptions {
  stage: string;
  token?: string;
  commentMode?: CommentMode;
  failOnError?: boolean;
  maxOutputSize?: number;
  runner?: 'bun' | 'npm' | 'pnpm' | 'yarn' | 'sst';
  environment?: Record<string, string>;
  truncationLength?: number;
  prefix?: string;
}

export interface BaseOperationResult {
  success: boolean;
  operation: SSTOperation;
  stage: string;
  app: string;
  rawOutput: string;
  exitCode: number;
  truncated: boolean;
  error?: string;
  completionStatus: CompletionStatus;
  permalink?: string;
}

export interface DeployResult extends BaseOperationResult {
  operation: 'deploy';
  resourceChanges: number;
  urls: Array<{
    name: string;
    url: string;
    type: 'api' | 'web' | 'function' | 'other';
  }>;
  resources: Array<{
    type: string;
    name: string;
    status: 'created' | 'updated' | 'unchanged';
  }>;
}

export interface DiffResult extends BaseOperationResult {
  operation: 'diff';
  plannedChanges: number;
  changeSummary: string;
  changes: Array<{
    type: string;
    name: string;
    action: 'create' | 'update' | 'delete';
    details?: string;
  }>;
}

export interface RemoveResult extends BaseOperationResult {
  operation: 'remove';
  resourcesRemoved: number;
  removedResources: Array<{
    type: string;
    name: string;
    status: 'removed' | 'failed' | 'skipped';
  }>;
}

export interface StageResult extends BaseOperationResult {
  operation: 'stage';
  computedStage: string;
  ref: string;
  eventName: string;
  isPullRequest: boolean;
}

export type OperationResult =
  | DeployResult
  | DiffResult
  | RemoveResult
  | StageResult;

export interface OperationContext {
  operation: SSTOperation;
  options: OperationOptions;
  startTime: Date;
  workflowId: string;
  runId: string;
  actor: string;
  ref: string;
  sha: string;
}

export interface ParsedSST {
  app: string;
  stage: string;
  region?: string;
  outputs?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

export interface ExecutionStats {
  duration: number;
  outputSize: number;
  memoryUsage?: number;
  cpuTime?: number;
}

export interface OperationMetadata {
  version: string;
  timestamp: string;
  environment: 'github-actions';
  runner: {
    os: string;
    arch: string;
    nodeVersion: string;
  };
}
