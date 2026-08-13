/**
 * Main entry point for the SST Operations Action
 * Integrates all components: input validation, operation routing, output formatting, and error handling
 */

import * as core from "@actions/core";
import {
  isOutputFormattingError,
  UnifiedErrorHandler,
} from "./errors/unified-handler";
import { computeStageFromGitContext } from "./inputs/compute-stage";
import type { ResolvedInputs } from "./inputs/resolve";
import { resolveActionInputs } from "./inputs/resolve";
import { executeOperation } from "./operations/router";
import { OutputFormatter } from "./outputs/formatter";
import type { OperationResult } from "./types";
import type { ValidationError } from "./utils/validation";

/**
 * How the resolved stage reads in the log.
 *
 * The stage operation computes its own, and a deploy without one has it
 * computed during resolution, so both are reported rather than shown blank.
 */
function stageDisplayName(inputs: ResolvedInputs): string {
  return inputs.operation === "stage" ? "computed" : inputs.stage;
}

/**
 * Handle input validation errors using unified error handler
 *
 * @param error The validation error that occurred during input parsing
 */
function handleInputValidationError(error: unknown): void {
  UnifiedErrorHandler.handle({
    error: error as ValidationError | Error,
    type: "input-validation",
  });
}

/**
 * Execute the SST operation and handle the result
 */
async function executeAndHandleOperation(
  inputs: ResolvedInputs
): Promise<void> {
  try {
    core.info(`🔧 Executing ${inputs.operation} operation...`);
    const result = await executeOperation(inputs);

    // Set GitHub Actions outputs
    setGitHubActionsOutputs(result);

    // Handle success/failure based on result
    handleOperationResult(result, inputs);
  } catch (error) {
    handleOperationError(error, inputs);
  }
}

/**
 * What the error subsystem needs from the resolved inputs.
 *
 * It still takes the older options bag; giving it the whole resolved shape is
 * #149's business, not this ticket's.
 */
function errorContext(inputs: ResolvedInputs): {
  failOnError: boolean;
  stage: string;
} {
  return {
    failOnError: inputs.failOnError,
    // The stage operation has no stage input; computing one is its job, and a
    // failure may have happened before it did.
    stage: inputs.operation === "stage" ? "" : inputs.stage,
  };
}

/**
 * Handle the result of an operation execution
 */
function handleOperationResult(
  result: OperationResult,
  inputs: ResolvedInputs
): void {
  if (result.success) {
    core.info(`✅ SST ${inputs.operation} operation completed successfully`);
    return;
  }

  const message = `SST ${inputs.operation} operation failed: ${result.error || "Unknown error"}`;

  if (inputs.failOnError) {
    core.setFailed(message);
  } else {
    core.warning(message);
    core.info("🔄 Continuing workflow as fail-on-error is disabled");
  }
}

/**
 * Handle errors that occur during operation execution using unified error handler
 */
function handleOperationError(error: unknown, inputs: ResolvedInputs): void {
  if (!(error instanceof Error)) {
    UnifiedErrorHandler.handle({
      error,
      type: "unexpected",
    });
    return;
  }

  const options = errorContext(inputs);

  // Determine error type and route to appropriate handler
  if (isOutputFormattingError(error)) {
    UnifiedErrorHandler.handle({
      error,
      operation: inputs.operation,
      options,
      type: "output-formatting",
    });
  } else {
    UnifiedErrorHandler.handle({
      error,
      operation: inputs.operation,
      options,
      type: "operation-execution",
    });
  }
}

/**
 * Handle unexpected errors using unified error handler
 */
function handleUnexpectedError(error: unknown): never {
  UnifiedErrorHandler.handle({
    error,
    type: "unexpected",
  });
  // UnifiedErrorHandler.handle will throw, but TypeScript doesn't know that
  throw error;
}

/**
 * Log operation summary information
 */
function logOperationSummary(result: OperationResult): void {
  core.info(`✅ Operation: ${result.operation} (${result.stage})`);
  core.info(
    `📊 Status: ${result.success ? "SUCCESS" : "FAILED"} (${result.completionStatus})`
  );

  if (result.success) {
    if (result.operation === "deploy" && result.resourceChanges > 0) {
      core.info(`🚀 Deployed ${result.resourceChanges} resource(s)`);
    } else if (result.operation === "diff" && result.plannedChanges > 0) {
      core.info(`📋 Found ${result.plannedChanges} planned change(s)`);
    } else if (result.operation === "remove" && result.resourcesRemoved > 0) {
      core.info(`🗑️ Removed ${result.resourcesRemoved} resource(s)`);
    }
  }

  if (result.truncated) {
    core.warning("⚠️ Output was truncated due to size limits");
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
 *
 * Coordinates the complete action workflow: input parsing and validation,
 * operation execution, result formatting, and error handling. Provides
 * comprehensive error recovery and ensures consistent output formatting
 * regardless of operation success or failure.
 *
 * This function represents the top-level orchestration of all SST operations,
 * handling the integration between GitHub Actions, SST CLI, and result reporting.
 *
 * @returns Promise that resolves when the action completes (success or failure)
 */
export async function run(): Promise<void> {
  try {
    core.info("🚀 Starting SST Operations Action");

    // 1. Resolve the action's inputs
    let inputs: ResolvedInputs;
    try {
      inputs = resolveActionInputs({
        computeStage: computeStageFromGitContext,
      });
    } catch (error) {
      handleInputValidationError(error);
      return; // Early return after handling validation error
    }

    // One log line. There used to be two, one here and one inside input
    // parsing, each with its own copy of the display-name logic — so every
    // run printed "📝 Parsed inputs" twice.
    core.info(
      `📝 Parsed inputs: ${inputs.operation} operation on stage "${stageDisplayName(inputs)}"`
    );

    // 2. Execute the SST operation and handle results
    await executeAndHandleOperation(inputs);
  } catch (error) {
    handleUnexpectedError(error);
  }
}
