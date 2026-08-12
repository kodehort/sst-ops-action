/**
 * SST CLI response types and parsing interfaces
 * Defines the structure for SST command outputs and parsing patterns
 */

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
