/**
 * Main entry point for the SST Operations Action
 * Integrates all components: input validation, operation routing, output formatting, and error handling
 */

import * as core from "@actions/core";
import { OutputFormattingError, reportFailure } from "./errors/report-failure";
import { computeStageFromGitContext } from "./inputs/compute-stage";
import type { ResolvedInputs } from "./inputs/resolve";
import { resolveActionInputs } from "./inputs/resolve";
import { executeOperation } from "./operations/router";
import { OutputFormatter } from "./outputs/formatter";
import type { OperationResult } from "./types";

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
  reportFailure({ error, type: "input-validation" });
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
    reportFailure({
      error,
      failOnError: inputs.failOnError,
      operation: inputs.operation,
      stage: stageDisplayName(inputs),
      type: "operation",
    });
  }
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

  // A non-zero SST exit is the action's most common failure and it never
  // reached the error subsystem, because it arrives as data rather than as a
  // throw. It goes through the same reporter as everything else now.
  reportFailure({
    failOnError: inputs.failOnError,
    result,
    type: "result",
  });
}

/**
 * Report anything that escaped the paths above.
 *
 * The old handler re-read `fail-on-error` and `stage` from the Actions input
 * API here, from deep in the call stack, bypassing validation and using a
 * different parsing rule than the entry point — and hardcoded the operation
 * name to "deploy" regardless of what actually ran.
 */
function handleUnexpectedError(error: unknown): never {
  reportFailure({ error, type: "unexpected" });
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
    // Tagged at the point the condition is known, rather than recognised later
    // by matching phrases against a message this module does not own.
    throw new OutputFormattingError(message, { cause: error });
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
