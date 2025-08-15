/**
 * Simplified error handler for SST operations
 * Handles only the essential error types needed for a GitHub Action
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { OperationOptions, SSTOperation } from '../types';
import type { ValidationError } from '../utils/validation';
import type { ActionError, OperationMetadata } from './categories';

/**
 * Create input validation error
 */
export function createInputValidationError(
  message: string,
  field?: string,
  value?: unknown,
  originalError?: Error
): ActionError {
  const error: ActionError = {
    type: 'input_validation',
    message,
    shouldFailAction: true,
  };

  if (originalError) {
    error.originalError = originalError;
  }

  if (field) {
    error.details = { field, value };
  }

  return error;
}

/**
 * Create enhanced operation metadata for better error context
 * @returns Operation metadata with timestamp and GitHub context
 */
function createOperationMetadata(): OperationMetadata {
  const metadata: OperationMetadata = {
    timestamp: new Date().toISOString(),
  };

  try {
    // Add GitHub context information if available
    const context = github.context;
    if (context) {
      metadata.workflowId = context.workflow;
      metadata.runId = context.runId;
      metadata.runNumber = context.runNumber;
      metadata.actor = context.actor;
      metadata.eventName = context.eventName;
      metadata.ref = context.ref;
      metadata.sha = context.sha;
    }
  } catch (error) {
    // GitHub context might not be available in some environments
    core.debug(`Failed to retrieve GitHub context: ${error}`);
  }

  return metadata;
}

/**
 * Create subprocess error (SST CLI execution failure) with enhanced context
 * @param message Error message
 * @param operation SST operation type
 * @param stage Deployment stage
 * @param exitCode Process exit code
 * @param stdout Standard output from the process
 * @param stderr Standard error from the process
 * @param originalError Original error if any
 * @returns Enhanced ActionError with operation metadata
 */
export function createSubprocessError(
  message: string,
  operation: SSTOperation,
  stage: string,
  exitCode: number,
  stdout?: string,
  stderr?: string,
  originalError?: Error
): ActionError {
  const operationMetadata = createOperationMetadata();

  const error: ActionError = {
    type: 'subprocess_error',
    message,
    shouldFailAction: true, // Non-zero exit code = fail action
    details: {
      operation,
      stage,
      exitCode,
      metadata: operationMetadata,
    },
  };

  if (originalError) {
    error.originalError = originalError;
  }

  if (stdout && error.details) {
    error.details.stdout = stdout;
  }

  if (stderr && error.details) {
    error.details.stderr = stderr;
  }

  return error;
}

/**
 * Create output parsing error with enhanced context
 * @param message Error message
 * @param operation SST operation type
 * @param stage Deployment stage
 * @param rawOutput Raw output that failed to parse
 * @param originalError Original error if any
 * @returns Enhanced ActionError with operation metadata
 */
export function createOutputParsingError(
  message: string,
  operation: SSTOperation,
  stage: string,
  rawOutput?: string,
  originalError?: Error
): ActionError {
  const operationMetadata = createOperationMetadata();

  const error: ActionError = {
    type: 'output_parsing',
    message,
    shouldFailAction: false, // Parsing errors don't fail the action
    details: {
      operation,
      stage,
      metadata: operationMetadata,
    },
  };

  if (originalError) {
    error.originalError = originalError;
  }

  if (rawOutput && error.details) {
    error.details.stdout = rawOutput;
  }

  return error;
}

/**
 * Create error from ValidationError instance
 */
/**
 * Convert ValidationError to ActionError
 */
export function fromValidationError(error: ValidationError): ActionError {
  return createInputValidationError(
    error.message,
    error.field,
    error.value,
    error
  );
}

/**
 * Handle error with appropriate logging and GitHub Actions integration
 */
/**
 * Handle error with appropriate logging and GitHub Actions integration
 */
export function handleError(
  error: ActionError,
  options: OperationOptions
): void {
  // Add defensive check for error object to handle cases where it doesn't match expected structure
  if (!error || typeof error !== 'object') {
    core.error(
      `🔴 Invalid error object passed to handleError: ${JSON.stringify(error)}`
    );
    return;
  }

  // Log the error appropriately
  logError(error, options);

  // Fail the action if required
  if (error.shouldFailAction) {
    const failureMessage = formatFailureMessage(error, options);
    core.setFailed(failureMessage);
  }
}

/**
 * Log error with appropriate level and enhanced context
 */
function logError(error: ActionError, options: OperationOptions): void {
  if (!isValidErrorObject(error)) {
    core.error(
      `🔴 Invalid error object passed to logError: ${JSON.stringify(error)}`
    );
    return;
  }

  logBasicError(error, options);
  logErrorDetails(error);
  logErrorMetadata(error);
  logStackTrace(error);
}

/**
 * Validate error object structure
 */
function isValidErrorObject(error: unknown): error is ActionError {
  return !!(error && typeof error === 'object' && (error as ActionError).type);
}

/**
 * Log basic error information
 */
function logBasicError(error: ActionError, options: OperationOptions): void {
  const prefix = `${options.stage} ${error.type}`;

  if (error.shouldFailAction) {
    core.error(`🔴 ${prefix}: ${error.message}`);
  } else {
    core.warning(`🟡 ${prefix}: ${error.message}`);
  }
}

/**
 * Log error details
 */
function logErrorDetails(error: ActionError): void {
  if (!error.details) {
    return;
  }

  if (error.details.exitCode !== undefined) {
    core.info(`Exit Code: ${error.details.exitCode}`);
  }
  if (error.details.stderr) {
    core.info(`Error Output: ${error.details.stderr}`);
  }
  if (error.details.field) {
    core.info(`Invalid Field: ${error.details.field} = ${error.details.value}`);
  }
}

/**
 * Log operation metadata
 */
function logErrorMetadata(error: ActionError): void {
  const metadata = error.details?.metadata;
  if (!metadata) {
    return;
  }

  core.info(`Error Timestamp: ${metadata.timestamp}`);

  if (metadata.workflowId) {
    core.info(`Workflow: ${metadata.workflowId}`);
  }
  if (metadata.runId) {
    core.info(
      `Run ID: ${metadata.runId} (Run #${metadata.runNumber || 'unknown'})`
    );
  }
  if (metadata.actor) {
    core.info(`Triggered by: ${metadata.actor}`);
  }
  if (metadata.eventName) {
    core.info(`Event: ${metadata.eventName}`);
  }
  if (metadata.ref) {
    core.info(`Ref: ${metadata.ref}`);
  }
  if (metadata.sha) {
    core.info(`SHA: ${metadata.sha.substring(0, 8)}`);
  }
}

/**
 * Log stack trace in debug mode
 */
function logStackTrace(error: ActionError): void {
  if (error.originalError?.stack) {
    core.debug(`Stack Trace: ${error.originalError.stack}`);
  }
}

/**
 * Format failure message for GitHub Actions with enhanced context
 */
function formatFailureMessage(
  error: ActionError,
  options: OperationOptions
): string {
  let message = `${error.type.replace('_', ' ')} in ${options.stage}`;

  if (error.details?.operation) {
    message += ` ${error.details.operation} operation`;
  }

  message += `: ${error.message}`;

  // Add workflow context if available
  if (error.details?.metadata) {
    const metadata = error.details.metadata;
    if (metadata.runId) {
      message += ` (Run #${metadata.runNumber || metadata.runId})`;
    }
  }

  return message;
}

/**
 * Check if this is a parsing error (for partial success scenarios)
 */
/**
 * Check if this is a parsing error (for partial success scenarios)
 */
export function isParsingError(error: ActionError): boolean {
  return error.type === 'output_parsing';
}
