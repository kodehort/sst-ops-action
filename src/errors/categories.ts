/**
 * Simplified error handling for SST operations
 * Only handles the essential error types needed for a GitHub Action
 */

/**
 * Simple error types for SST operations
 */
export type ErrorType =
  | "input_validation"
  | "subprocess_error"
  | "output_parsing";

/**
 * Enhanced operation metadata for error context
 */
export interface OperationMetadata {
  actionVersion: string;
  actor?: string;
  eventName?: string;
  ref?: string;
  runId?: number;
  runNumber?: number;
  sha?: string;
  timestamp: string;
  workflowId?: string;
}

/**
 * Simplified error information structure
 */
export interface ActionError {
  details?: {
    operation?: string;
    stage?: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    field?: string;
    value?: unknown;
    metadata?: OperationMetadata;
  };
  message: string;
  originalError?: Error;
  shouldFailAction: boolean;
  type: ErrorType;
}
