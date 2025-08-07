/**
 * Main entry point for the SST Operations Action
 * Integrates all components: input validation, operation routing, output formatting, and error handling
 */

import * as core from '@actions/core';
import { ErrorHandler } from './errors/error-handler';
import { executeOperation } from './operations/router';
import { OutputFormatter } from './outputs/formatter';
import type { OperationOptions } from './types';
import type { SSTRunner } from './utils/cli';
import {
  createValidationContext,
  validateWithContext,
} from './utils/validation';

/**
 * Parse GitHub Actions inputs into a typed structure
 */
function parseGitHubActionsInputs() {
  // Get raw inputs from GitHub Actions
  const rawInputs = {
    operation: core.getInput('operation') || 'deploy',
    stage: core.getInput('stage'),
    token: core.getInput('token'),
    commentMode: core.getInput('comment-mode') || 'on-success',
    failOnError: (core.getInput('fail-on-error') || 'true').toLowerCase() !== 'false',
    maxOutputSize: Number.parseInt(
      core.getInput('max-output-size') || '50000',
      10
    ),
    runner: (core.getInput('runner') || 'bun') as SSTRunner,
  };

  // Create validation context
  const validationContext = createValidationContext();

  // Parse and validate inputs
  return validateWithContext(rawInputs, validationContext);
}

/**
 * Convert parsed inputs to operation options
 */
function createOperationOptions(
  inputs: ReturnType<typeof validateWithContext>
): {
  operation: ReturnType<typeof validateWithContext>['operation'];
  options: OperationOptions;
} {
  return {
    operation: inputs.operation,
    options: {
      stage: inputs.stage,
      token: inputs.token,
      commentMode: inputs.commentMode,
      failOnError: inputs.failOnError,
      maxOutputSize: inputs.maxOutputSize,
      runner: inputs.runner || 'bun',
      environment: Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== undefined)
      ) as Record<string, string>,
    },
  };
}

/**
 * Set GitHub Actions outputs using the OutputFormatter
 */
function setGitHubActionsOutputs(result: any): void {
  try {
    const formattedOutputs = OutputFormatter.formatForGitHubActions(result);

    // Validate outputs before setting them
    OutputFormatter.validateOutputs(formattedOutputs);

    // Set all outputs
    for (const [key, value] of Object.entries(formattedOutputs)) {
      core.setOutput(key, value);
    }

    // Log summary information
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
    let inputs: ReturnType<typeof validateWithContext>;
    try {
      inputs = parseGitHubActionsInputs();
      core.info(
        `📝 Parsed inputs: ${inputs.operation} operation on stage "${inputs.stage}"`
      );
    } catch (error) {
      // Enhanced input validation error handling
      if (error instanceof Error) {
        core.error(`❌ Input validation failed: ${error.message}`);
        const actionError = ErrorHandler.categorizeError(error);
        await ErrorHandler.handleError(actionError, {
          stage: 'unknown',
          failOnError: true,
        });
      }
      throw error;
    }

    // 2. Create operation options
    const { operation, options } = createOperationOptions(inputs);

    // 3. Execute the SST operation
    core.info(`🔧 Executing ${operation} operation...`);
    const result = await executeOperation(operation, options);

    // 4. Set GitHub Actions outputs
    setGitHubActionsOutputs(result);

    // 5. Handle success/failure based on result and failOnError setting
    if (result.success) {
      core.info(`✅ SST ${operation} operation completed successfully`);
    } else {
      const message = `SST ${operation} operation failed: ${result.error || 'Unknown error'}`;

      if (options.failOnError) {
        // Fail the action
        core.setFailed(message);
      } else {
        // Log as warning but don't fail
        core.warning(message);
        core.info('🔄 Continuing workflow as fail-on-error is disabled');
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Use enhanced error handling for comprehensive logging and debugging
    const actionError = ErrorHandler.categorizeError(error as Error);

    try {
      // Attempt to get operation options for error handling
      const basicOptions: OperationOptions = {
        stage: core.getInput('stage') || 'unknown',
        failOnError: (core.getInput('fail-on-error') || 'true').toLowerCase() !== 'false',
      };

      await ErrorHandler.handleError(actionError, basicOptions);
    } catch (errorHandlingError) {
      // If error handling itself fails, fall back to basic GitHub Actions error reporting
      core.error(
        `Error handling failed: ${errorHandlingError instanceof Error ? errorHandlingError.message : String(errorHandlingError)}`
      );
      core.setFailed(`Action failed: ${message}`);
    }
  }
}
