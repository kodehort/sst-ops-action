/**
 * Runtime Validation Schemas for Operation Results
 * Ensures type safety at runtime, not just compile time
 */

import { z } from "zod";

/**
 * Metadata schema common to all operations
 */
const OperationMetadataSchema = z
  .object({
    app: z.string().optional(),
    cliExitCode: z.number().optional(),
    rawOutput: z.string().optional(),
    truncated: z.boolean().optional(),
  })
  .optional();

/**
 * Raw deploy operation result schema
 * Validates the result from DeployOperation.execute() before transformation
 */
export const RawDeployResultSchema = z.object({
  error: z.string().optional(),
  metadata: OperationMetadataSchema,
  outputs: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  permalink: z.string().optional(),
  resourceChanges: z.number().optional(),
  resources: z
    .array(
      z.object({
        name: z.string(),
        status: z.string(),
        timing: z.string().optional(),
        type: z.string(),
      })
    )
    .optional(),
  stage: z.string(),
  success: z.boolean(),
});

export type RawDeployResult = z.infer<typeof RawDeployResultSchema>;

/**
 * Raw diff operation result schema
 * Validates the result from DiffOperation.execute() before transformation
 */
export const RawDiffResultSchema = z.object({
  changes: z
    .array(
      z.object({
        action: z.string(),
        details: z.string().optional(),
        name: z.string(),
        type: z.string(),
      })
    )
    .optional(),
  changesDetected: z.number().optional(),
  error: z.string().optional(),
  metadata: OperationMetadataSchema,
  stage: z.string(),
  success: z.boolean(),
  summary: z.string().optional(),
});

export type RawDiffResult = z.infer<typeof RawDiffResultSchema>;

/**
 * Raw remove operation result schema
 * Validates the result from RemoveOperation.execute() before transformation
 */
export const RawRemoveResultSchema = z.object({
  completionStatus: z.enum(["complete", "partial", "failed"]).optional(),
  error: z.string().optional(),
  metadata: OperationMetadataSchema,
  removedResources: z
    .array(
      z.object({
        name: z.string(),
        status: z.string(),
        type: z.string(),
      })
    )
    .optional(),
  resourcesRemoved: z.number().optional(),
  stage: z.string(),
  success: z.boolean(),
});

export type RawRemoveResult = z.infer<typeof RawRemoveResultSchema>;

/**
 * Validate raw deploy result
 * @param result Raw result from DeployOperation
 * @returns Validated result with proper typing
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateRawDeployResult(result: unknown): RawDeployResult {
  try {
    return RawDeployResultSchema.parse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue: z.ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`
      );
      throw new Error(
        `Deploy operation result validation failed:\n${issues.join("\n")}`,
        { cause: error }
      );
    }
    throw error as Error;
  }
}

/**
 * Validate raw diff result
 * @param result Raw result from DiffOperation
 * @returns Validated result with proper typing
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateRawDiffResult(result: unknown): RawDiffResult {
  try {
    return RawDiffResultSchema.parse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue: z.ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`
      );
      throw new Error(
        `Diff operation result validation failed:\n${issues.join("\n")}`,
        { cause: error }
      );
    }
    throw error as Error;
  }
}

/**
 * Validate raw remove result
 * @param result Raw result from RemoveOperation
 * @returns Validated result with proper typing
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateRawRemoveResult(result: unknown): RawRemoveResult {
  try {
    return RawRemoveResultSchema.parse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue: z.ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`
      );
      throw new Error(
        `Remove operation result validation failed:\n${issues.join("\n")}`,
        { cause: error }
      );
    }
    throw error as Error;
  }
}
