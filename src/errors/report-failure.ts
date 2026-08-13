/**
 * Failure reporting
 *
 * Every way this action can fail ends here, produces the same shape of
 * message, and makes the fail-on-error decision once.
 *
 * There used to be three `setFailed` call sites with three different formats,
 * so what a user saw depended on which path happened to fire — and the most
 * common failure of all, a non-zero SST exit, reached none of the error
 * subsystem. It is returned as data rather than thrown, so it flowed through
 * the parser and the router and terminated at a bare failure call in the entry
 * point. Thrown errors did not reach the subsystem either: the router catches
 * them and launders them into result objects.
 *
 * The wording is the entry point's, because it is what users already see for
 * that common path.
 */

import * as core from "@actions/core";
import type { OperationResult, SSTOperation } from "../types";
import { ValidationError } from "../utils/validation";

/**
 * Thrown when operation outputs cannot be formatted or written.
 *
 * A type rather than a phrase. Classification used to be
 * `error.message.includes("Failed to set outputs")` against a message the
 * error subsystem did not own, so rewording a throw silently changed how it
 * was handled.
 */
export class OutputFormattingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OutputFormattingError";
  }
}

/**
 * Everything that can go wrong, tagged by what the caller knows at the time.
 */
export type Failure =
  /** Inputs did not validate. No operation ran. */
  | { type: "input-validation"; error: unknown }
  /** An operation ran and reported failure — the common case. */
  | { type: "result"; failOnError: boolean; result: OperationResult }
  /** An operation threw rather than returning a result. */
  | {
      type: "operation";
      error: unknown;
      failOnError: boolean;
      operation: SSTOperation;
      stage: string;
    }
  /** Anything else, including a failure inside failure reporting. */
  | { type: "unexpected"; error: unknown };

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * The one format. An operation is named when one is known, because that is
 * what the entry point has always printed for the common path.
 */
function describe(failure: Failure): string {
  switch (failure.type) {
    case "result":
      return `SST ${failure.result.operation} operation failed: ${failure.result.error || "Unknown error"}`;
    case "operation":
      return `SST ${failure.operation} operation failed: ${messageOf(failure.error)}`;
    case "input-validation":
    case "unexpected":
      return `SST action failed: ${messageOf(failure.error)}`;
    default: {
      const _exhaustive: never = failure;
      return `SST action failed: ${String(_exhaustive)}`;
    }
  }
}

/** Whether this failure should stop the workflow. */
function shouldFail(failure: Failure): boolean {
  switch (failure.type) {
    case "result":
    case "operation":
      return failure.failOnError;
    // Bad inputs and unexpected errors are not something fail-on-error should
    // let through: nothing ran, so continuing would run the rest of a workflow
    // on a false premise.
    case "input-validation":
    case "unexpected":
      return true;
    default: {
      const _exhaustive: never = failure;
      return true;
    }
  }
}

/** Which input was wrong, and what to do about it. */
function logInvalidInput(error: unknown): void {
  if (!(error instanceof ValidationError)) {
    return;
  }

  core.error(`Invalid input: ${error.field} = ${String(error.value)}`);
  for (const suggestion of error.suggestions) {
    core.info(`  • ${suggestion}`);
  }
}

/** What the CLI exited with, when it ran at all. */
function logExitCode(result: OperationResult): void {
  if (result.exitCode !== 0) {
    core.info(`Exit code: ${result.exitCode}`);
  }
}

/**
 * Whether the operation itself may have succeeded.
 *
 * Recognised by type. This distinction used to be drawn by matching loose
 * phrases against the message, and it matters: only the reporting of the
 * result failed here, not the operation.
 */
function logOutputWritingHint(error: unknown): void {
  if (error instanceof OutputFormattingError) {
    core.info(
      "The operation itself may have completed; the failure was in writing its outputs."
    );
  }
}

/** Stack traces go to the debug channel, not the log. */
function logStack(error: unknown): void {
  if (error instanceof Error && error.stack) {
    core.debug(`Stack trace: ${error.stack}`);
  }
}

/**
 * Log the context that is not already in the message.
 *
 * Deliberately not the run id, actor, ref or SHA the old handler printed —
 * GitHub Actions shows all of those around the log already.
 */
function logContext(failure: Failure): void {
  switch (failure.type) {
    case "input-validation":
      logInvalidInput(failure.error);
      break;
    case "result":
      logExitCode(failure.result);
      break;
    case "operation":
      logOutputWritingHint(failure.error);
      break;
    default:
      break;
  }

  logStack("error" in failure ? failure.error : undefined);
}

/**
 * Report a failure: one message, one fail-on-error decision, one call.
 */
export function reportFailure(failure: Failure): void {
  const message = describe(failure);

  logContext(failure);

  if (shouldFail(failure)) {
    core.setFailed(message);
    return;
  }

  core.warning(message);
  core.info("🔄 Continuing workflow as fail-on-error is disabled");
}
