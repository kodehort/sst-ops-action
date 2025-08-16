/**
 * GitHub Actions output types and interfaces
 * Defines the structure for action outputs and metadata
 */

import type { CompletionStatus, SSTOperation } from './operations.js';

export interface ActionOutputs {
  success: string;
  operation: SSTOperation;
  stage: string;
  resource_changes: string;
  app: string;
  completion_status: CompletionStatus;
  permalink: string;
  truncated: string;
  diff_summary: string;
}

export interface DeployOutputs extends ActionOutputs {
  operation: 'deploy';
  resource_changes: string; // Number as string
}

export interface DiffOutputs extends ActionOutputs {
  operation: 'diff';
  resource_changes: string; // Number as string for planned changes
  diff_summary: string; // Summary of changes
}

export interface RemoveOutputs extends ActionOutputs {
  operation: 'remove';
  resource_changes: string; // Number as string for removed resources
}

export interface GitHubContext {
  token: string;
  repo: {
    owner: string;
    repo: string;
  };
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
  actor: string;
  workflow: string;
  job: string;
  runId: number;
  runNumber: number;
  sha: string;
  ref: string;
}

export interface CommentMetadata {
  operation: SSTOperation;
  stage: string;
  success: boolean;
  timestamp: string;
  permalink?: string;
  workflowUrl: string;
  commitSha: string;
  actor: string;
}

export interface ArtifactInfo {
  name: string;
  path: string;
  size: number;
  contentType: string;
  retentionDays: number;
}

export interface WorkflowSummary {
  operation: SSTOperation;
  stage: string;
  success: boolean;
  duration: string;
  resourceChanges?: number;
  errors?: string[];
  warnings?: string[];
  artifacts: ArtifactInfo[];
}

export interface ActionEnvironment {
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
  GITHUB_WORKSPACE: string;
  GITHUB_EVENT_PATH: string;
  GITHUB_SHA: string;
  GITHUB_REF: string;
  GITHUB_ACTOR: string;
  GITHUB_WORKFLOW: string;
  GITHUB_JOB: string;
  GITHUB_RUN_ID: string;
  GITHUB_RUN_NUMBER: string;
  GITHUB_API_URL: string;
  GITHUB_SERVER_URL: string;
  INPUT_OPERATION: SSTOperation;
  INPUT_STAGE: string;
  INPUT_TOKEN: string;
  INPUT_COMMENT_MODE: string;
  INPUT_FAIL_ON_ERROR: string;
  INPUT_MAX_OUTPUT_SIZE: string;
}
