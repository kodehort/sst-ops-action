/**
 * GitHub Actions output types and interfaces
 * Defines the structure for action outputs and metadata
 */

import type { CompletionStatus, SSTOperation } from "./operations.js";

export interface ActionOutputs {
  app: string;
  completion_status: CompletionStatus;
  diff_summary: string;
  operation: SSTOperation;
  permalink: string;
  resource_changes: string;
  stage: string;
  success: string;
  truncated: string;
}

export interface DeployOutputs extends ActionOutputs {
  operation: "deploy";
  resource_changes: string; // Number as string
}

export interface DiffOutputs extends ActionOutputs {
  diff_summary: string; // Summary of changes
  operation: "diff";
  resource_changes: string; // Number as string for planned changes
}

export interface RemoveOutputs extends ActionOutputs {
  operation: "remove";
  resource_changes: string; // Number as string for removed resources
}

export interface GitHubContext {
  actor: string;
  job: string;
  payload: {
    pull_request?: {
      number: number;
      head: {
        sha: string;
        ref: string;
      };
      base: {
        ref: string;
      };
    };
    push?: {
      head_commit: {
        id: string;
        message: string;
      };
    };
  };
  ref: string;
  repo: {
    owner: string;
    repo: string;
  };
  runId: number;
  runNumber: number;
  sha: string;
  token: string;
  workflow: string;
}

export interface CommentMetadata {
  actor: string;
  commitSha: string;
  operation: SSTOperation;
  permalink?: string;
  stage: string;
  success: boolean;
  timestamp: string;
  workflowUrl: string;
}

export interface ArtifactInfo {
  contentType: string;
  name: string;
  path: string;
  retentionDays: number;
  size: number;
}

export interface WorkflowSummary {
  artifacts: ArtifactInfo[];
  duration: string;
  errors?: string[];
  operation: SSTOperation;
  resourceChanges?: number;
  stage: string;
  success: boolean;
  warnings?: string[];
}

export interface ActionEnvironment {
  GITHUB_ACTOR: string;
  GITHUB_API_URL: string;
  GITHUB_EVENT_PATH: string;
  GITHUB_JOB: string;
  GITHUB_REF: string;
  GITHUB_REPOSITORY: string;
  GITHUB_RUN_ID: string;
  GITHUB_RUN_NUMBER: string;
  GITHUB_SERVER_URL: string;
  GITHUB_SHA: string;
  GITHUB_TOKEN: string;
  GITHUB_WORKFLOW: string;
  GITHUB_WORKSPACE: string;
  INPUT_COMMENT_MODE: string;
  INPUT_FAIL_ON_ERROR: string;
  INPUT_MAX_OUTPUT_SIZE: string;
  INPUT_OPERATION: SSTOperation;
  INPUT_STAGE: string;
  INPUT_TOKEN: string;
}
