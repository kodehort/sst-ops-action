/**
 * Main entry point for the SST Operations Action
 * Integrates all components: input validation, operation routing, output formatting, and error handling
 */

import * as core from '@actions/core';
import {
  createInputValidationError,
  createSubprocessError,
  fromValidationError,
  handleError,
} from './errors/error-handler';
import { executeOperation } from './operations/router';
import { OutputFormatter } from './outputs/formatter';
import { StageParser } from './parsers/stage-parser';
import type { OperationOptions, OperationResult } from './types';
import type { SSTRunner } from './utils/cli';
import {
  createValidationContext,
  ValidationError,
  validateOperationWithContext,
} from './utils/validation';

/**
 * Compute stage name from GitHub context when not explicitly provided
 */
function computeStageFromContext(
  fallbackStage = 'main',
  truncationLength = 26,
  prefix = 'pr-'
): string {
  try {
    const parser = new StageParser();
    const result = parser.parse(
      '',
      fallbackStage,
      0,
      undefined,
      truncationLength,
      prefix
    );

    if (result.success && result.computedStage) {
      core.info(
        `🎯 Computed stage from Git context: "${result.computedStage}"`
      );
      return result.computedStage;
    }

    core.warning(
      `⚠️ Failed to compute stage from Git context, using fallback: "${fallbackStage}"`
    );
    return fallbackStage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.warning(
      `⚠️ Stage computation failed: ${message}, using fallback: "${fallbackStage}"`
    );
    return fallbackStage;
  }
}

/**
 * Parse GitHub Actions inputs into a typed structure
 */
function parseGitHubActionsInputs() {
  // Get the operation first to determine which inputs are needed
  const operation = core.getInput('operation') || 'deploy';

  // Get raw inputs from GitHub Actions
  let stage = core.getInput('stage');
  const truncationLength = Number.parseInt(
    core.getInput('truncation-length') || '26',
    10
  );
  const prefix = core.getInput('prefix') || 'pr-';

  // Compute stage from Git context if not explicitly provided
  if (!stage || stage.trim() === '') {
    stage = computeStageFromContext('main', truncationLength, prefix);
    core.info(
      `📋 Stage input was empty, computed from Git context: "${stage}"`
    );
  } else {
    core.info(`📋 Using explicitly provided stage: "${stage}"`);
  }

  // Build operation-specific inputs to avoid strict validation errors
  let rawInputs: Record<string, unknown>;

  if (operation === 'stage') {
    // Stage operation only needs these fields
    rawInputs = {
      operation,
      truncationLength,
      prefix,
    };
  } else {
    // Infrastructure operations (deploy, diff, remove) need all fields
    rawInputs = {
      operation,
      stage,
      token: core.getInput('token'),
      commentMode: core.getInput('comment-mode') || 'on-success',
      failOnError: core.getBooleanInput('fail-on-error') ?? true,
      maxOutputSize: core.getInput('max-output-size') || '50000',
      runner: (core.getInput('runner') || 'bun') as SSTRunner,
    };
  }

  // Create validation context
  const validationContext = createValidationContext();

  // Parse and validate inputs
  return validateOperationWithContext(rawInputs, validationContext);
}

/**
 * Handle input validation errors with proper error conversion
 */
function handleInputValidationError(error: unknown): void {
  if (error instanceof ValidationError) {
    const actionError = fromValidationError(error);
    handleError(actionError, {
      stage: 'unknown',
      failOnError: true,
    });
  } else if (error instanceof Error) {
    const actionError = createInputValidationError(
      error.message,
      undefined,
      undefined,
      error
    );
    handleError(actionError, {
      stage: 'unknown',
      failOnError: true,
    });
  }
  // Don't re-throw - let the function return normally
}

/**
 * Execute the SST operation and handle the result
 */
async function executeAndHandleOperation(
  operation: ReturnType<typeof validateOperationWithContext>['operation'],
  options: OperationOptions
): Promise<void> {
  try {
    core.info(`🔧 Executing ${operation} operation...`);
    const result = await executeOperation(operation, options);

    // Set GitHub Actions outputs
    setGitHubActionsOutputs(result);

    // Handle success/failure based on result
    handleOperationResult(result, operation, options);
  } catch (error) {
    handleOperationError(error, operation, options);
  }
}

/**
 * Handle the result of an operation execution
 */
function handleOperationResult(
  result: OperationResult,
  operation: ReturnType<typeof validateOperationWithContext>['operation'],
  options: OperationOptions
): void {
  if (result.success) {
    core.info(`✅ SST ${operation} operation completed successfully`);
    return;
  }

  const message = `SST ${operation} operation failed: ${result.error || 'Unknown error'}`;

  if (options.failOnError) {
    core.setFailed(message);
  } else {
    core.warning(message);
    core.info('🔄 Continuing workflow as fail-on-error is disabled');
  }
}

/**
 * Handle errors that occur during operation execution
 */
function handleOperationError(
  error: unknown,
  operation: ReturnType<typeof validateOperationWithContext>['operation'],
  options: OperationOptions
): void {
  const message = error instanceof Error ? error.message : String(error);

  try {
    const isOutputFormattingError =
      error instanceof Error &&
      error.message.includes('Output formatting failed');

    if (isOutputFormattingError) {
      handleOutputFormattingError(error, message, operation, options);
    } else {
      handleGenericOperationError(error, message, operation, options);
    }
  } catch (errorHandlingError) {
    handleErrorHandlingFailure(errorHandlingError, message);
  }
}

/**
 * Handle output formatting errors
 */
function handleOutputFormattingError(
  error: Error,
  message: string,
  operation: ReturnType<typeof validateOperationWithContext>['operation'],
  options: OperationOptions
): void {
  core.error(`Failed to set outputs: ${message}`);
  const actionError = createSubprocessError(
    message,
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
 * Handle generic operation errors
 */
function handleGenericOperationError(
  error: unknown,
  message: string,
  operation: ReturnType<typeof validateOperationWithContext>['operation'],
  options: OperationOptions
): void {
  const actionError = createSubprocessError(
    message,
    operation,
    options.stage,
    1,
    undefined,
    undefined,
    error instanceof Error ? error : undefined
  );
  handleError(actionError, options);
}

/**
 * Handle failures in error handling itself
 */
function handleErrorHandlingFailure(
  errorHandlingError: unknown,
  originalMessage: string
): void {
  core.error(
    `Error handling failed: ${errorHandlingError instanceof Error ? errorHandlingError.message : String(errorHandlingError)}`
  );
  core.setFailed(`Action failed: ${originalMessage}`);
}

/**
 * Handle unexpected errors with fallback error reporting
 */
function handleUnexpectedError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  // Simple fallback error handling
  try {
    const failOnErrorInput = core.getInput('fail-on-error') || 'true';
    const basicOptions: OperationOptions = {
      stage: core.getInput('stage') || 'unknown',
      failOnError: failOnErrorInput === 'true',
    };

    // Create a generic subprocess error for unhandled errors
    const actionError = createSubprocessError(
      message,
      'deploy', // Default operation
      basicOptions.stage,
      1, // Generic error exit code
      undefined,
      undefined,
      error instanceof Error ? error : undefined
    );

    handleError(actionError, basicOptions);
  } catch (errorHandlingError) {
    // If error handling itself fails, fall back to basic GitHub Actions error reporting
    core.error(
      `Error handling failed: ${errorHandlingError instanceof Error ? errorHandlingError.message : String(errorHandlingError)}`
    );
    core.setFailed(`Action failed: ${message}`);
  }

  throw error;
}

/**
 * Convert parsed inputs to operation options
 */
function createOperationOptions(
  inputs: ReturnType<typeof validateOperationWithContext>
): {
  operation: ReturnType<typeof validateOperationWithContext>['operation'];
  options: OperationOptions;
} {
  // Handle operation-specific properties using discriminated union
  switch (inputs.operation) {
    case 'deploy':
      return {
        operation: inputs.operation,
        options: {
          stage: inputs.stage || '',
          token: inputs.token,
          commentMode: inputs.commentMode || 'on-success',
          failOnError: inputs.failOnError !== false,
          maxOutputSize: inputs.maxOutputSize || 50_000,
          runner: inputs.runner || 'bun',
          environment: Object.fromEntries(
            Object.entries(process.env).filter(
              ([, value]) => value !== undefined
            )
          ) as Record<string, string>,
        },
      };

    case 'diff':
    case 'remove':
      return {
        operation: inputs.operation,
        options: {
          stage: inputs.stage,
          token: inputs.token,
          commentMode: inputs.commentMode || 'on-success',
          failOnError: inputs.failOnError !== false,
          maxOutputSize: inputs.maxOutputSize || 50_000,
          runner: inputs.runner || 'bun',
          environment: Object.fromEntries(
            Object.entries(process.env).filter(
              ([, value]) => value !== undefined
            )
          ) as Record<string, string>,
        },
      };

    case 'stage':
      return {
        operation: inputs.operation,
        options: {
          stage: '',
          token: '',
          commentMode: 'never',
          failOnError: true,
          maxOutputSize: 50_000,
          runner: 'bun',
          truncationLength: inputs.truncationLength || 26,
          prefix: inputs.prefix || 'pr-',
          environment: Object.fromEntries(
            Object.entries(process.env).filter(
              ([, value]) => value !== undefined
            )
          ) as Record<string, string>,
        },
      };

    default: {
      const _exhaustive: never = inputs;
      throw new Error('Unsupported operation type');
    }
  }
}

/**
 * Log operation summary information
 */
function logOperationSummary(result: OperationResult): void {
  core.info(`✅ Operation: ${result.operation} (${result.stage})`);
  core.info(
    `📊 Status: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.completionStatus})`
  );

  if (result.success) {
    if (result.operation === 'deploy' && result.resourceChanges > 0) {
      core.info(`🚀 Deployed ${result.resourceChanges} resource(s)`);
    } else if (result.operation === 'diff' && result.plannedChanges > 0) {
      core.info(`📋 Found ${result.plannedChanges} planned change(s)`);
    } else if (result.operation === 'remove' && result.resourcesRemoved > 0) {
      core.info(`🗑️ Removed ${result.resourcesRemoved} resource(s)`);
    }
  }

  if (result.truncated) {
    core.warning('⚠️ Output was truncated due to size limits');
  }
}

/**
 * Set GitHub Actions outputs using the OutputFormatter
 */
function setGitHubActionsOutputs(result: OperationResult): void {
  try {
    const formattedOutputs =
      OutputFormatter.formatOperationForGitHubActions(result);

    // Validate outputs before setting them
    OutputFormatter.validateOutputs(formattedOutputs);

    // Set all outputs
    for (const [key, value] of Object.entries(formattedOutputs)) {
      core.setOutput(key, value);
    }

    // Log summary information
    logOperationSummary(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.error(`Failed to set outputs: ${message}`);
    throw error;
  }
}

/**
 * Main entry point for the SST Operations Action
 */
export async function run(): Promise<void> {
  try {
    core.info('🚀 Starting SST Operations Action');

    // 1. Parse and validate GitHub Actions inputs
    let inputs: ReturnType<typeof validateOperationWithContext>;
    try {
      inputs = parseGitHubActionsInputs();
      let stage: string;
      if (inputs.operation === 'stage') {
        stage = 'computed';
      } else if (inputs.operation === 'deploy') {
        stage = inputs.stage || 'auto';
      } else {
        stage = inputs.stage;
      }
      core.info(
        `📝 Parsed inputs: ${inputs.operation} operation on stage "${stage}"`
      );
    } catch (error) {
      handleInputValidationError(error);
      return; // Early return after handling validation error
    }

    // 2. Create operation options
    const { operation, options } = createOperationOptions(inputs);

    // 3. Execute the SST operation and handle results
    await executeAndHandleOperation(operation, options);
  } catch (error) {
    handleUnexpectedError(error);
  }
}
