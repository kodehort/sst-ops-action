/**
 * SST CLI response types and parsing interfaces
 * Defines the structure for SST command outputs and parsing patterns
 */

export interface SSTConfig {
  name: string;
  stage: string;
  region: string;
  profile?: string;
}

export interface SSTResource {
  type: string;
  name: string;
  logicalId: string;
  physicalId?: string;
  status:
    | 'CREATE_COMPLETE'
    | 'UPDATE_COMPLETE'
    | 'DELETE_COMPLETE'
    | 'FAILED'
    | 'IN_PROGRESS';
  properties?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface SSTUrl {
  name: string;
  url: string;
  type: 'api' | 'web' | 'function' | 'other';
}

export interface SSTDeployOutput {
  app: string;
  stage: string;
  region: string;
  resources: SSTResource[];
  outputs: Record<string, unknown>;
  urls: Array<{
    name: string;
    url: string;
    type: 'api' | 'web' | 'function';
  }>;
  duration: number;
  status: 'success' | 'failed' | 'partial';
  permalink?: string;
  warnings?: string[];
  errors?: string[];
}

export interface SSTDiffOutput {
  app: string;
  stage: string;
  region: string;
  changes: Array<{
    action: 'create' | 'update' | 'delete';
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
  summary: {
    toCreate: number;
    toUpdate: number;
    toDelete: number;
    total: number;
  };
  status: 'success' | 'failed';
  errors?: string[];
}

export interface SSTRemoveOutput {
  app: string;
  stage: string;
  region: string;
  removed: Array<{
    type: string;
    name: string;
    logicalId: string;
    status: 'removed' | 'failed' | 'skipped';
    reason?: string;
  }>;
  summary: {
    totalRemoved: number;
    totalFailed: number;
    totalSkipped: number;
  };
  duration: number;
  status: 'success' | 'failed' | 'partial';
  errors?: string[];
  warnings?: string[];
}

export interface SSTCommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  executionTime: number;
  command: string[];
  workingDirectory: string;
  environment: Record<string, string>;
}

export interface SSTParsePatterns {
  APP_INFO: RegExp;
  STAGE_INFO: RegExp;
  REGION_INFO: RegExp;
  RESOURCE_CREATED: RegExp;
  RESOURCE_UPDATED: RegExp;
  RESOURCE_DELETED: RegExp;
  RESOURCE_FAILED: RegExp;
  URL_OUTPUT: RegExp;
  PERMALINK: RegExp;
  COMPLETION_SUCCESS: RegExp;
  COMPLETION_FAILED: RegExp;
  WARNING: RegExp;
  ERROR: RegExp;
  DURATION: RegExp;
}

export interface SSTError {
  code: string;
  message: string;
  details?: string;
  stack?: string;
  context?: {
    command: string;
    stage: string;
    resource?: string;
  };
}

export interface SSTValidationResult {
  valid: boolean;
  errors: SSTError[];
  warnings: string[];
  parsed?: SSTDeployOutput | SSTDiffOutput | SSTRemoveOutput;
}
