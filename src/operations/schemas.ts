/**
 * Runtime Validation Schemas for Operation Results
 * Ensures type safety at runtime, not just compile time
 */

import { z } from 'zod';

/**
 * Metadata schema common to all operations
 */
const OperationMetadataSchema = z
  .object({
    app: z.string().optional(),
    rawOutput: z.string().optional(),
    cliExitCode: z.number().optional(),
    truncated: z.boolean().optional(),
  })
  .optional();

/**
 * Raw deploy operation result schema
 * Validates the result from DeployOperation.execute() before transformation
 */
export const RawDeployResultSchema = z.object({
  success: z.boolean(),
  stage: z.string(),
  metadata: OperationMetadataSchema,
  error: z.string().optional(),
  resourceChanges: z.number().optional(),
  outputs: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  resources: z
    .array(
      z.object({
        type: z.string(),
        name: z.string(),
        status: z.string(),
        timing: z.string().optional(),
      })
    )
    .optional(),
  permalink: z.string().optional(),
});

export type RawDeployResult = z.infer<typeof RawDeployResultSchema>;

/**
 * Raw diff operation result schema
 * Validates the result from DiffOperation.execute() before transformation
 */
export const RawDiffResultSchema = z.object({
  success: z.boolean(),
  stage: z.string(),
  metadata: OperationMetadataSchema,
  error: z.string().optional(),
  changesDetected: z.number().optional(),
  summary: z.string().optional(),
  changes: z
    .array(
      z.object({
        resourceType: z.string(),
        resourceName: z.string(),
        action: z.string(),
        details: z.string().optional(),
      })
    )
    .optional(),
});

export type RawDiffResult = z.infer<typeof RawDiffResultSchema>;

/**
 * Raw remove operation result schema
 * Validates the result from RemoveOperation.execute() before transformation
 */
export const RawRemoveResultSchema = z.object({
  success: z.boolean(),
  stage: z.string(),
  metadata: OperationMetadataSchema,
  error: z.string().optional(),
  completionStatus: z.enum(['complete', 'partial', 'failed']).optional(),
  resourcesRemoved: z.number().optional(),
  removedResources: z
    .array(
      z.object({
        resourceType: z.string(),
        resourceName: z.string(),
        status: z.string(),
      })
    )
    .optional(),
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
        (issue: z.ZodIssue) => `  - ${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(
        `Deploy operation result validation failed:\n${issues.join('\n')}`
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
        (issue: z.ZodIssue) => `  - ${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(
        `Diff operation result validation failed:\n${issues.join('\n')}`
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
        (issue: z.ZodIssue) => `  - ${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(
        `Remove operation result validation failed:\n${issues.join('\n')}`
      );
    }
    throw error as Error;
  }
}
