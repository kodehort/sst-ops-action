/**
 * Input validation utilities for GitHub Actions inputs
 * Provides comprehensive validation with clear error messages
 */

import { z } from "zod";
import {
  COMMENT_MODES,
  type CommentMode,
  DEFAULT_MAX_OUTPUT_SIZE,
  isValidCommentMode,
  isValidOperation,
  SST_OPERATIONS,
  type SSTOperation,
  validateMaxOutputSize,
} from "../types/index.js";
import type { SSTRunner } from "./cli.js";
import { SST_RUNNERS } from "./cli.js";
import { isZodError } from "./zod-error.js";

/**
 * The value each optional input takes when it is not set.
 *
 * Exported so the schema and the stage-computation step read the same
 * constant. Deploy may compute its stage from Git context, which needs the
 * prefix and truncation length even though those inputs belong to the stage
 * operation, and that was the second place they used to be defaulted.
 */
export const INPUT_DEFAULTS = {
  commentMode: "on-success",
  maxOutputSize: DEFAULT_MAX_OUTPUT_SIZE,
  prefix: "pr-",
  runner: "bun",
  truncationLength: 26,
} as const;

const STAGE_VALIDATION_PATTERN = /^[a-zA-Z0-9-_]+$/;
const PREFIX_VALIDATION_PATTERN = /^[a-z0-9-]*$/;
const REFS_SEPARATOR_PATTERN = /[\n,]/;

/**
 * Common field schemas used across operations
 */
const CommonFieldSchemas = {
  commentMode: z
    .string()
    .default(INPUT_DEFAULTS.commentMode)
    .refine((val) => isValidCommentMode(val), {
      message: `Invalid comment mode. Must be one of: ${COMMENT_MODES.join(", ")}`,
    })
    .transform((val) => val as CommentMode),

  failOnError: z.boolean().default(true),

  maxOutputSize: z
    .number()
    .or(
      z.string().transform((val) => {
        const parsed = Number.parseInt(val, 10);
        if (Number.isNaN(parsed)) {
          throw new Error("max-output-size must be a valid number");
        }
        return parsed;
      })
    )
    .transform((val) => validateMaxOutputSize(val))
    .default(INPUT_DEFAULTS.maxOutputSize),
  operation: z
    .string()
    .min(1, "Operation is required and cannot be empty")
    .refine((val) => isValidOperation(val), {
      message: `Invalid operation. Must be one of: ${SST_OPERATIONS.join(", ")}`,
    })
    .transform((val) => val as SSTOperation),

  optionalStage: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        (val.trim().length > 0 && STAGE_VALIDATION_PATTERN.test(val.trim())),
      "Stage must contain only alphanumeric characters, hyphens, and underscores"
    )
    .transform((val) => val?.trim() || ""),

  prefix: z
    .string()
    .refine((val) => val.length <= 10, {
      message: "Prefix must be 10 characters or less",
    })
    .refine((val) => PREFIX_VALIDATION_PATTERN.test(val), {
      message:
        "Prefix must contain only lowercase letters, numbers, and hyphens",
    })
    .default(INPUT_DEFAULTS.prefix),

  refs: z
    .string()
    .optional()
    .transform((val) =>
      (val ?? "")
        .split(REFS_SEPARATOR_PATTERN)
        .map((ref) => ref.trim())
        .filter(Boolean)
    ),

  runner: z
    .string()
    .default(INPUT_DEFAULTS.runner)
    .refine((val): val is SSTRunner => SST_RUNNERS.includes(val as SSTRunner), {
      message: `Invalid runner. Must be one of: ${SST_RUNNERS.join(", ")}`,
    })
    .transform((val) => val as SSTRunner),

  stage: z
    .string()
    .min(1, "Stage cannot be empty")
    .refine(
      (val) =>
        val.trim().length > 0 && STAGE_VALIDATION_PATTERN.test(val.trim()),
      "Stage must contain only alphanumeric characters, hyphens, and underscores"
    )
    .transform((val) => val.trim()),

  token: z.string().min(1, "Token cannot be empty"),

  truncationLength: z
    .number()
    .or(
      z.string().transform((val) => {
        const parsed = Number.parseInt(val, 10);
        if (Number.isNaN(parsed)) {
          throw new Error("truncation-length must be a valid number");
        }
        return parsed;
      })
    )
    .refine((val) => val > 0 && val <= 100, {
      message: "Truncation length must be between 1 and 100 characters",
    })
    .default(INPUT_DEFAULTS.truncationLength),
};

/**
 * Base schema for SST infrastructure operations
 */
const BaseInfrastructureSchema = z.object({
  commentMode: CommonFieldSchemas.commentMode,
  failOnError: CommonFieldSchemas.failOnError,
  maxOutputSize: CommonFieldSchemas.maxOutputSize,
  runner: CommonFieldSchemas.runner,
  token: CommonFieldSchemas.token,
});

/**
 * Operation-specific input schemas using discriminated unions
 */
const DeployInputsSchema = z
  .object({
    operation: z.literal("deploy"),
    stage: CommonFieldSchemas.optionalStage,
  })
  .extend(BaseInfrastructureSchema.shape)
  .strict();

const DiffInputsSchema = z
  .object({
    operation: z.literal("diff"),
    stage: CommonFieldSchemas.stage,
  })
  .extend(BaseInfrastructureSchema.shape)
  .strict();

const RemoveInputsSchema = z
  .object({
    operation: z.literal("remove"),
    stage: CommonFieldSchemas.stage,
  })
  .extend(BaseInfrastructureSchema.shape)
  .strict();

const StageInputsSchema = z
  .object({
    failOnError: CommonFieldSchemas.failOnError,
    operation: z.literal("stage"),
    prefix: CommonFieldSchemas.prefix,
    refs: CommonFieldSchemas.refs,
    truncationLength: CommonFieldSchemas.truncationLength,
  })
  .strict();

/**
 * Discriminated union schema for all operation types
 */
export const OperationInputsSchema = z.discriminatedUnion("operation", [
  DeployInputsSchema,
  DiffInputsSchema,
  RemoveInputsSchema,
  StageInputsSchema,
]);

/**
 * Inferred TypeScript type from the operation schema
 */
export type OperationInputsType = z.infer<typeof OperationInputsSchema>;

/**
 * Validation error with additional context for GitHub Actions
 */
export class ValidationError extends Error {
  readonly field: string;
  readonly value: unknown;
  readonly suggestions: string[];

  constructor(
    message: string,
    field: string,
    value: unknown,
    suggestions: string[] = [],
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
    this.suggestions = suggestions;
  }
}

/**
 * Filter raw inputs to only include fields relevant for the given operation
 */
function filterInputsByOperation(
  rawInputs: Record<string, unknown>
): Record<string, unknown> {
  const operation = rawInputs.operation as string;

  if (operation === "stage") {
    // Stage operations only need these fields. fail-on-error is included
    // because action.yml documents it as applying to every operation type.
    return {
      failOnError: rawInputs.failOnError,
      operation: rawInputs.operation,
      prefix: rawInputs.prefix,
      refs: rawInputs.refs,
      truncationLength: rawInputs.truncationLength,
    };
  }
  // Infrastructure operations (deploy, diff, remove) need these fields
  return {
    commentMode: rawInputs.commentMode,
    failOnError: rawInputs.failOnError,
    maxOutputSize: rawInputs.maxOutputSize,
    operation: rawInputs.operation,
    runner: rawInputs.runner,
    stage: rawInputs.stage,
    token: rawInputs.token,
  };
}

/**
 * Parse and validate operation-specific GitHub Actions inputs
 */
export function parseOperationInputs(
  rawInputs: Record<string, unknown>
): OperationInputsType {
  try {
    // Filter inputs to only include relevant fields for the operation
    const filteredInputs = filterInputsByOperation(rawInputs);
    return OperationInputsSchema.parse(filteredInputs);
  } catch (error) {
    if (isZodError(error) && error.issues.length > 0) {
      // Transform Zod errors into more user-friendly validation errors
      const [issue] = error.issues; // Focus on first error for clarity
      if (!issue) {
        throw error;
      }

      const fieldName = issue.path.length > 0 ? issue.path[0] : "unknown";
      const operation = (rawInputs.operation as string) || "unknown";
      const suggestions = suggestionsFor({
        field: String(fieldName),
        operation,
      });

      // biome-ignore lint/style/useErrorCause: cause is forwarded via the options param to super() in ValidationError's constructor
      throw new ValidationError(
        issue.message,
        String(fieldName),
        rawInputs[String(fieldName)],
        suggestions,
        { cause: error }
      );
    }
    throw error;
  }
}

/**
 * Help text shown alongside a validation failure, keyed by field.
 *
 * This was four nested switch statements, and they took the Zod issue as a
 * parameter and ignored it — so the "suggestions" could never respond to what
 * actually went wrong, only to which field it happened on. That is a lookup,
 * so it is written as one.
 *
 * Lists of valid values are joined from the constant that defines them rather
 * than restated in prose, so adding an operation or a comment mode cannot
 * leave the help text describing the old set.
 */
const FIELD_SUGGESTIONS: Record<string, readonly string[]> = {
  commentMode: [
    `Valid comment modes are: ${COMMENT_MODES.join(", ")}`,
    'Use "always" to comment on every run',
    'Use "on-success" to comment only when operation succeeds',
    'Use "on-failure" to comment only when operation fails',
    'Use "never" to disable PR comments',
  ],

  failOnError: [
    "Supported values: true, false, yes, no, 1, 0, on, off, enabled, disabled",
    'Use "true" or "yes" to fail the workflow on errors',
    'Use "false" or "no" to continue workflow even if operation fails',
    "Values are case-insensitive",
  ],

  // No `maxOutputSize` entry: that input is coerced and range-checked before
  // Zod runs, so it throws a plain Error and never reaches this lookup.

  operation: [
    `Valid operations are: ${SST_OPERATIONS.join(", ")}`,
    'Use "deploy" for deploying infrastructure to AWS',
    'Use "diff" to preview infrastructure changes without deploying',
    'Use "remove" to clean up and delete deployed resources',
    'Use "stage" to compute stage names from Git context',
  ],

  prefix: [
    "Prefix is added to stage names that start with numbers",
    "Only applies to stage operations",
    "Must be lowercase letters, numbers, and hyphens only",
    'Default "pr-" creates names like "pr-123" for PR #123',
  ],

  runner: [
    `Valid runners are: ${SST_RUNNERS.join(", ")}`,
    'Use "bun" (default) for Bun runtime',
    'Use "npm" for npm with package scripts',
    'Use "pnpm" for pnpm runtime',
    'Use "yarn" for yarn runtime',
    'Use "sst" for direct SST binary execution',
  ],

  truncationLength: [
    "Truncation length controls maximum stage name length (1-100 characters)",
    "Only applies to stage operations for DNS compatibility",
    "Default is 26 characters to fit Route53 limits",
    "Use smaller values for shorter stage names",
  ],
};

/**
 * Fields whose advice depends on which operation was requested.
 *
 * `fallback` covers an operation that is not in the map, which happens when
 * the operation input is itself missing or unrecognised.
 */
const OPERATION_SPECIFIC_SUGGESTIONS: Record<
  string,
  {
    byOperation: Record<string, readonly string[]>;
    fallback: readonly string[];
  }
> = {
  stage: {
    byOperation: {
      deploy: [
        "Deploy operations can auto-compute stage from Git context",
        "Leave empty to use branch/PR name as stage",
        'Or provide explicit stage: "production", "staging", "dev-123"',
        "Uses alphanumeric characters, hyphens, and underscores only",
      ],
      diff: [
        "Diff operations require explicit stage name",
        "Cannot preview changes without knowing target stage",
        'Examples: "production", "staging", "dev-123", "pr-456"',
        "Must match an existing deployed stage for comparison",
      ],
      remove: [
        "Remove operations require explicit stage for safety",
        "Will not auto-compute stage to prevent accidental deletions",
        'Examples: "staging", "dev-123", "pr-456"',
        "Use caution with production stages",
      ],
    },
    fallback: [
      "Stage must contain only alphanumeric characters, hyphens, and underscores",
      'Examples: "production", "staging", "dev-123", "pr-456"',
    ],
  },

  token: {
    byOperation: {
      deploy: [
        "Deploy operations require GitHub token for authentication",
        `Use \`${"$"}{{ secrets.GITHUB_TOKEN }}\` or personal access token`,
        "Token needed to comment on PRs and access AWS credentials",
        'Use "fake-token" only for local testing',
      ],
      diff: [
        "Diff operations require GitHub token for PR comments",
        `Use \`${"$"}{{ secrets.GITHUB_TOKEN }}\` for automatic token`,
        "Token needed to post comparison results to pull requests",
        'Use "fake-token" only for local testing',
      ],
      remove: [
        "Remove operations require GitHub token for confirmation",
        `Use \`${"$"}{{ secrets.GITHUB_TOKEN }}\` or personal access token`,
        "Token needed for authentication and result reporting",
        'Use "fake-token" only for local testing',
      ],
      stage: [
        "Stage operations do not require GitHub token",
        "This operation only computes stage names from Git context",
        "No infrastructure access or API calls needed",
      ],
    },
    fallback: [
      `Use a valid GitHub token (e.g., \`${"$"}{{ secrets.GITHUB_TOKEN }}\`)`,
      "Token must be provided and cannot be empty",
      'Use "fake-token" only for testing',
    ],
  },
};

/**
 * Look up the help text for a failed field.
 *
 * @returns The suggestions, or an empty list for a field with no advice
 */
function suggestionsFor({
  field,
  operation,
}: {
  field: string;
  operation: string;
}): string[] {
  const perOperation = OPERATION_SPECIFIC_SUGGESTIONS[field];
  if (perOperation) {
    return [...(perOperation.byOperation[operation] ?? perOperation.fallback)];
  }

  return [...(FIELD_SUGGESTIONS[field] ?? [])];
}

/**
 * Create operation-specific validation context
 */
export interface ValidationContext {
  allowFakeTokens: boolean;
  isProduction: boolean;
}

/**
 * Enhanced validation with operation-specific rules using discriminated unions
 */
export function validateOperationWithContext(
  rawInputs: Record<string, unknown>,
  context: Partial<ValidationContext> = {}
): OperationInputsType {
  const inputs = parseOperationInputs(rawInputs);

  // Operation-specific validation rules
  switch (inputs.operation) {
    case "remove":
      // Remove operations should not be run on production without extra confirmation
      if (context.isProduction && inputs.stage.toLowerCase().includes("prod")) {
        throw new ValidationError(
          "Remove operation on production stage requires explicit confirmation",
          "operation",
          inputs.operation,
          [
            "Consider using a different stage name for production removal",
            "Ensure this is intentional as it will delete resources",
            "Use staging or development stages for testing removal",
          ]
        );
      }
      break;

    case "diff":
      // Diff operations require explicit stage - already validated by schema
      break;

    case "deploy":
      // Deploy operations should validate token format more strictly in production
      if (
        context.isProduction &&
        !context.allowFakeTokens &&
        inputs.token === "fake-token"
      ) {
        throw new ValidationError(
          "Production deployments require a real GitHub token",
          "token",
          inputs.token,
          [
            `Use \`${"$"}{{ secrets.GITHUB_TOKEN }}\` or a valid personal access token`,
          ]
        );
      }
      break;

    case "stage":
      // Stage operations are utility only - no additional validation needed
      break;

    default: {
      // Exhaustive check for TypeScript
      const _exhaustive: never = inputs;
      break;
    }
  }

  return inputs;
}

/**
 * Helper to create validation context from GitHub Actions environment
 */
export function createValidationContext(
  env: Record<string, string | undefined> = process.env
): ValidationContext {
  return {
    allowFakeTokens: Boolean(env.NODE_ENV === "test" || env.CI !== "true"),
    isProduction: Boolean(
      env.GITHUB_REF === "refs/heads/main" ||
        env.GITHUB_REF?.includes("refs/tags/")
    ),
  };
}
