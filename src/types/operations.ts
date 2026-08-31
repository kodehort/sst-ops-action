/**
 * Core types for SST operation handling and results
 * Defines the unified type system for deploy, diff, and remove operations
 */

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

/**
 * When the action posts a PR comment.
 *
 * The single source: the type, the type guard and the help text a user sees
 * when they get it wrong all read this list, so they cannot drift apart.
 */
export const COMMENT_MODES = [
  "always",
  "on-success",
  "on-failure",
  "never",
] as const;

export type CommentMode = (typeof COMMENT_MODES)[number];

export type CompletionStatus = "complete" | "partial" | "failed" | "skipped";

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
  /**
   * The diff SST printed, extracted from the raw output.
   *
   * Carried on the result so the formatter renders what the parser found
   * rather than re-scanning the CLI capture itself. Empty when SST emitted no
   * diff section.
   */
  diffSection: string;
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
  /**
   * Stage names for the refs the caller passed in, in input order. Empty when
   * the `refs` input was not used — the context-derived `computedStage` is the
   * whole answer then.
   */
  stages: Array<{ ref: string; stage: string }>;
}

export type OperationResult =
  | DeployResult
  | DiffResult
  | RemoveResult
  | StageResult;
