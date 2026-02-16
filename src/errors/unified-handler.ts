/**
 * Unified Error Handler
 * Consolidates error handling logic with clear categorization and consistent handling
 */

import * as core from "@actions/core";
import type { OperationOptions, SSTOperation } from "../types";
import { ValidationError } from "../utils/validation";
import {
  createInputValidationError,
  createSubprocessError,
  fromValidationError,
  handleError,
} from "./error-handler";

/**
 * Error context types using discriminated unions
 * Each context type provides specific information needed for proper error handling
 */
export type ErrorContext =
  | {
      type: "input-validation";
      error: ValidationError | Error;
    }
  | {
      type: "operation-execution";
      error: Error;
      operation: SSTOperation;
      options: OperationOptions;
    }
  | {
      type: "output-formatting";
      error: Error;
      operation: SSTOperation;
      options: OperationOptions;
    }
  | {
      type: "unexpected";
      error: unknown;
    };

/**
 * Unified error handler that provides consistent error handling across the application
 *
 * This class consolidates the 6+ error handling functions that were previously
 * scattered throughout main.ts into a single, well-structured handler.
 *
 * Benefits:
 * - Single source of truth for error handling
 * - Type-safe error categorization
 * - Consistent error reporting
 * - Easier to test and maintain
 */
// biome-ignore lint/complexity/noStaticOnlyClass: This is a namespace-like pattern for organizing related error handling functions
export class UnifiedErrorHandler {
  /**
   * Main entry point for error handling
   * Routes errors to appropriate handlers based on context type
   *
   * @param context Error context with type and relevant information
   */
  static handle(context: ErrorContext): void {
    try {
      switch (context.type) {
        case "input-validation":
          UnifiedErrorHandler.handleInputValidation(context.error);
          break;

        case "operation-execution":
          UnifiedErrorHandler.handleOperationExecution(
            context.error,
            context.operation,
            context.options
          );
          break;

        case "output-formatting":
          UnifiedErrorHandler.handleOutputFormatting(
            context.error,
            context.operation,
            context.options
          );
          break;

        case "unexpected":
          UnifiedErrorHandler.handleUnexpected(context.error);
          break;

        default: {
          // Exhaustive check for TypeScript
          const _exhaustive: never = context;
          throw new Error(
            `Unknown error context type: ${JSON.stringify(_exhaustive)}`
          );
        }
      }
    } catch (handlingError) {
      // If error handling itself fails, use fallback
      UnifiedErrorHandler.handleHandlingFailure(handlingError, context);
    }
  }

  /**
   * Handle input validation errors
   * These occur during parsing and validation of GitHub Actions inputs
   *
   * @param error Validation error from input parsing
   * @private
   */
  private static handleInputValidation(error: ValidationError | Error): void {
    if (error instanceof ValidationError) {
      const actionError = fromValidationError(error);
      handleError(actionError, { stage: "unknown", failOnError: true });
    } else {
      const actionError = createInputValidationError(
        error.message,
        undefined,
        undefined,
        error
      );
      handleError(actionError, { stage: "unknown", failOnError: true });
    }
  }

  /**
   * Handle operation execution errors
   * These occur during SST CLI execution or operation processing
   *
   * @param error Error from operation execution
   * @param operation Operation type that failed
   * @param options Operation options for context
   * @private
   */
  private static handleOperationExecution(
    error: Error,
    operation: SSTOperation,
    options: OperationOptions
  ): void {
    const actionError = createSubprocessError(
      error.message,
      operation,
      options.stage,
      1,
      undefined,
      undefined,
      error
    );
    handleError(actionError, options);
  }

  /**
   * Handle output formatting errors
   * These occur when formatting operation results for GitHub Actions outputs
   *
   * @param error Error from output formatting
   * @param operation Operation type being formatted
   * @param options Operation options for context
   * @private
   */
  private static handleOutputFormatting(
    error: Error,
    operation: SSTOperation,
    options: OperationOptions
  ): void {
    core.error(`Failed to set outputs: ${error.message}`);
    const actionError = createSubprocessError(
      error.message,
      operation,
      options.stage,
      1,
      undefined,
      undefined,
      error
    );
    handleError(actionError, options);
  }

  /**
   * Handle unexpected errors
   * These are errors that occur outside of normal error paths
   *
   * @param error Unknown error
   * @private
   */
  private static handleUnexpected(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    const failOnErrorInput = core.getInput("fail-on-error") || "true";

    const basicOptions: OperationOptions = {
      stage: core.getInput("stage") || "unknown",
      failOnError: failOnErrorInput === "true",
    };

    const actionError = createSubprocessError(
      message,
      "deploy", // Default operation for unexpected errors
      basicOptions.stage,
      1,
      undefined,
      undefined,
      error instanceof Error ? error : undefined
    );

    handleError(actionError, basicOptions);
    throw error;
  }

  /**
   * Handle failures in error handling itself
   * Last resort fallback when the error handler fails
   *
   * @param handlingError Error that occurred during error handling
   * @param originalContext Original error context
   * @private
   */
  private static handleHandlingFailure(
    handlingError: unknown,
    originalContext: ErrorContext
  ): void {
    const originalMessage = UnifiedErrorHandler.extractMessage(originalContext);
    const handlingMessage =
      handlingError instanceof Error
        ? handlingError.message
        : String(handlingError);

    core.error(`Error handling failed: ${handlingMessage}`);
    core.setFailed(`Action failed: ${originalMessage}`);
  }

  /**
   * Extract error message from context
   * Helper method to get the original error message
   *
   * @param context Error context
   * @returns Error message string
   * @private
   */
  private static extractMessage(context: ErrorContext): string {
    switch (context.type) {
      case "input-validation":
        return context.error.message;
      case "operation-execution":
      case "output-formatting":
        return context.error.message;
      case "unexpected":
        return context.error instanceof Error
          ? context.error.message
          : String(context.error);
      default: {
        const _exhaustive: never = context;
        return `Unknown error: ${JSON.stringify(_exhaustive)}`;
      }
    }
  }
}

/**
 * Helper function to determine if an error is an output formatting error
 * @param error Error to check
 * @returns true if error is related to output formatting
 */
export function isOutputFormattingError(error: Error): boolean {
  return (
    error.message.includes("Output formatting failed") ||
    error.message.includes("Failed to set outputs") ||
    error.message.includes("validation failed")
  );
}
