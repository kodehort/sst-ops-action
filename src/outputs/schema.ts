/**
 * GitHub Actions Output Validation Schema
 * Ensures all outputs match the schema defined in action.yml
 */

import { z } from "zod";
import { rethrowZodError } from "../utils/zod-error";

/**
 * Zod schema for GitHub Actions outputs
 * Matches the outputs defined in action.yml exactly
 *
 * All values must be strings as required by GitHub Actions
 * Boolean values are represented as "true" or "false"
 * Numeric values are represented as numeric strings
 * Empty values are represented as empty strings
 */
const GitHubActionsOutputSchema = z.object({
  // Common optional outputs
  app: z.string().default(""),
  completion_status: z.enum(["complete", "partial", "failed"]),

  // Operation-specific outputs for stage
  computed_stage: z.string().default(""),

  // Operation-specific outputs for diff
  diff_summary: z.string().default(""),
  error: z.string().default(""),
  event_name: z.string().default(""),
  is_pull_request: z
    .string()
    .regex(/^(true|false|)$/, {
      message: 'is_pull_request must be "true", "false", or empty',
    })
    .default("false"),
  operation: z.enum(["deploy", "diff", "remove", "stage"]),

  // Operation-specific outputs for deploy
  outputs: z.string().default("[]"), // JSON string
  permalink: z
    .string()
    .refine(
      (val: string) =>
        val === "" || val.startsWith("http://") || val.startsWith("https://"),
      {
        message: "permalink must be empty or a valid URL",
      }
    )
    .default(""),
  planned_changes: z
    .string()
    .regex(/^\d*$/, {
      message: "planned_changes must be a numeric string or empty",
    })
    .default("0"),
  ref: z.string().default(""),
  removed_resources: z.string().default("[]"), // JSON string
  resource_changes: z
    .string()
    .regex(/^\d*$/, {
      message: "resource_changes must be a numeric string or empty",
    })
    .default("0"),
  resources: z.string().default("[]"), // JSON string

  // Operation-specific outputs for remove
  resources_removed: z
    .string()
    .regex(/^\d*$/, {
      message: "resources_removed must be a numeric string or empty",
    })
    .default("0"),
  stage: z.string().min(1, "stage cannot be empty"),
  // Required outputs - always present
  success: z.string().regex(/^(true|false)$/, {
    message: 'success must be "true" or "false"',
  }),
  truncated: z
    .string()
    .regex(/^(true|false|)$/, {
      message: 'truncated must be "true", "false", or empty',
    })
    .default("false"),
});

/**
 * Type inference from Zod schema
 * Represents validated GitHub Actions outputs
 */
export type ValidatedOutputs = z.infer<typeof GitHubActionsOutputSchema>;

/**
 * Additional validation for JSON fields
 * Ensures that JSON string fields contain valid JSON
 */
function validateJSONFields(outputs: ValidatedOutputs): void {
  const jsonFields = ["outputs", "resources", "removed_resources"] as const;

  for (const field of jsonFields) {
    const value = outputs[field];
    if (value && value !== "[]" && value !== "{}") {
      try {
        JSON.parse(value);
      } catch (error) {
        throw new Error(
          `Invalid JSON in field '${field}': ${error instanceof Error ? error.message : "unknown error"}`,
          { cause: error }
        );
      }
    }
  }
}

/**
 * Validate outputs against the schema
 * @param outputs Raw outputs to validate
 * @returns Validated outputs with proper typing
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateOutputs(outputs: unknown): ValidatedOutputs {
  try {
    const validated = GitHubActionsOutputSchema.parse(outputs);

    // Additional validation for JSON fields
    validateJSONFields(validated);

    return validated;
  } catch (error) {
    rethrowZodError(error, "GitHub Actions output");
  }
}
