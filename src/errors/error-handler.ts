/**
 * Simplified error handler for SST operations
 * Handles only the essential error types needed for a GitHub Action
 */

import * as core from '@actions/core';
import type { OperationOptions, SSTOperation } from '../types';
import type { ValidationError } from '../utils/validation';
import type { ActionError } from './categories';

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
 * Create subprocess error (SST CLI execution failure)
 */
/**
 * Create subprocess error (SST CLI execution failure)
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
  const error: ActionError = {
    type: 'subprocess_error',
    message,
    shouldFailAction: true, // Non-zero exit code = fail action
    details: {
      operation,
      stage,
      exitCode,
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
 * Create output parsing error
 */
/**
 * Create output parsing error
 */
export function createOutputParsingError(
  message: string,
  operation: SSTOperation,
  stage: string,
  rawOutput?: string,
  originalError?: Error
): ActionError {
  const error: ActionError = {
    type: 'output_parsing',
    message,
    shouldFailAction: false, // Parsing errors don't fail the action
    details: {
      operation,
      stage,
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
 * Log error with appropriate level
 */
function logError(error: ActionError, options: OperationOptions): void {
  // Add defensive check for error.type to handle cases where error object doesn't match expected structure
  if (!error || typeof error !== 'object' || !error.type) {
    core.error(
      `🔴 Invalid error object passed to logError: ${JSON.stringify(error)}`
    );
    return;
  }

  const prefix = `${options.stage} ${error.type}`;

  if (error.shouldFailAction) {
    core.error(`🔴 ${prefix}: ${error.message}`);
  } else {
    core.warning(`🟡 ${prefix}: ${error.message}`);
  }

  // Log additional details if available
  if (error.details) {
    if (error.details.exitCode !== undefined) {
      core.info(`Exit Code: ${error.details.exitCode}`);
    }
    if (error.details.stderr) {
      core.info(`Error Output: ${error.details.stderr}`);
    }
    if (error.details.field) {
      core.info(
        `Invalid Field: ${error.details.field} = ${error.details.value}`
      );
    }
  }

  // Log stack trace in debug mode
  if (error.originalError?.stack) {
    core.debug(`Stack Trace: ${error.originalError.stack}`);
  }
}

/**
 * Format failure message for GitHub Actions
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
