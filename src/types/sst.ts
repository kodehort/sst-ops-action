/**
 * SST CLI response types and parsing interfaces
 * Defines the structure for SST command outputs and parsing patterns
 */

export interface SSTConfig {
  name: string;
  profile?: string;
  region: string;
  stage: string;
}

export interface SSTResource {
  logicalId: string;
  name: string;
  outputs?: Record<string, unknown>;
  physicalId?: string;
  properties?: Record<string, unknown>;
  status:
    | "CREATE_COMPLETE"
    | "UPDATE_COMPLETE"
    | "DELETE_COMPLETE"
    | "FAILED"
    | "IN_PROGRESS";
  type: string;
}

export interface SSTUrl {
  name: string;
  type: "api" | "web" | "function" | "other";
  url: string;
}

export interface SSTDeployOutput {
  app: string;
  duration: number;
  errors?: string[];
  outputs: Record<string, unknown>;
  permalink?: string;
  region: string;
  resources: SSTResource[];
  stage: string;
  status: "success" | "failed" | "partial";
  warnings?: string[];
}

export interface SSTDiffOutput {
  app: string;
  changes: Array<{
    action: "create" | "update" | "delete";
    type: string;
    name: string;
    logicalId: string;
    reason?: string;
    properties?: {
      added: Record<string, unknown>;
      updated: Record<string, unknown>;
      removed: Record<string, unknown>;
    };
  }>;
  errors?: string[];
  region: string;
  stage: string;
  status: "success" | "failed";
  summary: {
    toCreate: number;
    toUpdate: number;
    toDelete: number;
    total: number;
  };
}

export interface SSTRemoveOutput {
  app: string;
  duration: number;
  errors?: string[];
  region: string;
  removed: Array<{
    type: string;
    name: string;
    logicalId: string;
    status: "removed" | "failed" | "skipped";
    reason?: string;
  }>;
  stage: string;
  status: "success" | "failed" | "partial";
  summary: {
    totalRemoved: number;
    totalFailed: number;
    totalSkipped: number;
  };
  warnings?: string[];
}

export interface SSTCommandResult {
  command: string[];
  duration: number;
  environment: Record<string, string>;
  executionTime: number;
  exitCode: number;
  stderr: string;
  stdout: string;
  success: boolean;
  workingDirectory: string;
}

export interface SSTParsePatterns {
  APP_INFO: RegExp;
  COMPLETION_FAILED: RegExp;
  COMPLETION_SUCCESS: RegExp;
  DURATION: RegExp;
  ERROR: RegExp;
  PERMALINK: RegExp;
  REGION_INFO: RegExp;
  RESOURCE_CREATED: RegExp;
  RESOURCE_DELETED: RegExp;
  RESOURCE_FAILED: RegExp;
  RESOURCE_UPDATED: RegExp;
  STAGE_INFO: RegExp;
  URL_OUTPUT: RegExp;
  WARNING: RegExp;
}

export interface SSTError {
  code: string;
  context?: {
    command: string;
    stage: string;
    resource?: string;
  };
  details?: string;
  message: string;
  stack?: string;
}

export interface SSTValidationResult {
  errors: SSTError[];
  parsed?: SSTDeployOutput | SSTDiffOutput | SSTRemoveOutput;
  valid: boolean;
  warnings: string[];
}
