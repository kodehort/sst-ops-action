/**
 * Simplified error handler for SST operations
 * Handles only the essential error types needed for a GitHub Action
 */

import * as core from '@actions/core';
import type { OperationOptions, SSTOperation } from '../types';
import type { ValidationError } from '../utils/validation';
import type { ActionError } from './categories';

/**
 * Simple error handler for SST operations
 */
export class ErrorHandler {
  /**
   * Create input validation error
   */
  static createInputValidationError(
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
  static createSubprocessError(
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

    if (stdout) {
      error.details!.stdout = stdout;
    }

    if (stderr) {
      error.details!.stderr = stderr;
    }

    return error;
  }

  /**
   * Create output parsing error
   */
  static createOutputParsingError(
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

    if (rawOutput) {
      error.details!.stdout = rawOutput;
    }

    return error;
  }

  /**
   * Create error from ValidationError instance
   */
  static fromValidationError(error: ValidationError): ActionError {
    return ErrorHandler.createInputValidationError(
      error.message,
      error.field,
      error.value,
      error
    );
  }

  /**
   * Handle error with appropriate logging and GitHub Actions integration
   */
  static async handleError(
    error: ActionError,
    options: OperationOptions
  ): Promise<void> {
    // Log the error appropriately
    ErrorHandler.logError(error, options);

    // Fail the action if required
    if (error.shouldFailAction) {
      const failureMessage = ErrorHandler.formatFailureMessage(error, options);
      core.setFailed(failureMessage);
    }
  }

  /**
   * Log error with appropriate level
   */
  private static logError(error: ActionError, options: OperationOptions): void {
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
  private static formatFailureMessage(
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
  static isParsingError(error: ActionError): boolean {
    return error.type === 'output_parsing';
  }
}
