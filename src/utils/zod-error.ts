/**
 * Shared Zod error handling
 * Keeps the "validation failed" message format identical across every schema
 * boundary, so callers only supply the subject being validated.
 */

import { z } from "zod";

/**
 * Whether a caught error is a schema failure.
 *
 * One definition, so a caller that needs the issues rather than the standard
 * message does not hand-roll the check against its own import of the schema
 * library — which is how the two ended up importing it by different paths.
 */
export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

/**
 * Rethrow a ZodError as a plain Error listing one indented line per issue.
 * Any other error is rethrown untouched.
 *
 * @param error The caught error
 * @param subject What was being validated, e.g. "Deploy operation result"
 * @throws {Error} Always
 */
export function rethrowZodError(error: unknown, subject: string): never {
  if (isZodError(error)) {
    const issues = error.issues.map(
      (issue: z.ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`
    );
    throw new Error(`${subject} validation failed:\n${issues.join("\n")}`, {
      cause: error,
    });
  }
  throw error as Error;
}
