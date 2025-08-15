/**
 * Simplified error handling for SST operations
 * Only handles the essential error types needed for a GitHub Action
 */

/**
 * Simple error types for SST operations
 */
export type ErrorType =
  | 'input_validation'
  | 'subprocess_error'
  | 'output_parsing';

/**
 * Enhanced operation metadata for error context
 */
export interface OperationMetadata {
  timestamp: string;
  workflowId?: string;
  runId?: number;
  runNumber?: number;
  actor?: string;
  eventName?: string;
  ref?: string;
  sha?: string;
}

/**
 * Simplified error information structure
 */
export interface ActionError {
  type: ErrorType;
  message: string;
  shouldFailAction: boolean;
  originalError?: Error;
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
}
