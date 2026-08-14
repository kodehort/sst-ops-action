/**
 * Type system exports and utilities
 * Central export point for all type definitions and validation utilities
 */

// Core operation types
export type {
  BaseOperationResult,
  CommentMode,
  DeployResult,
  DiffResult,
  OperationResult,
  RemoveResult,
  SSTOperation,
  StageResult,
} from "./operations.js";

// The value lists behind the operation and comment-mode types, re-exported so
// callers get the single source rather than restating it.
export { COMMENT_MODES, SST_OPERATIONS } from "./operations.js";

import type { CommentMode, SSTOperation } from "./operations.js";
import { COMMENT_MODES, SST_OPERATIONS } from "./operations.js";

/**
 * The capture budget applied when `max-output-size` is absent.
 *
 * Stated once, here, beside the validator that enforces the range. It used to
 * be three values: `action.yml` and the input schema said 50000 while the CLI
 * seam used `50 * 1024`. That 51200 was only reachable through the
 * `max-output-size: 0` bug, so setting `0` produced a budget documented
 * nowhere.
 */
export const DEFAULT_MAX_OUTPUT_SIZE = 50_000;

/** The largest budget the input accepts. `0` means no budget at all. */
export const MAX_OUTPUT_SIZE_LIMIT = 1024 * 1024;

export function isValidOperation(operation: string): operation is SSTOperation {
  return SST_OPERATIONS.includes(operation as SSTOperation);
}

export function isValidCommentMode(mode: string): mode is CommentMode {
  return COMMENT_MODES.includes(mode as CommentMode);
}

/**
 * Validation utilities
 */
export function validateMaxOutputSize(size: unknown): number {
  const parsed = typeof size === "string" ? Number.parseInt(size, 10) : size;

  if (typeof parsed !== "number" || Number.isNaN(parsed) || parsed < 0) {
    throw new Error("Max output size must be a non-negative number");
  }

  // Set reasonable bounds (1000 min, 1MB max)
  if (parsed > 0 && parsed < 1000) {
    throw new Error(
      "Max output size must be at least 1000 bytes (except 0 for unlimited)"
    );
  }

  if (parsed > MAX_OUTPUT_SIZE_LIMIT) {
    throw new Error(
      `Max output size cannot exceed 1MB (${MAX_OUTPUT_SIZE_LIMIT} bytes)`
    );
  }

  return parsed;
}
