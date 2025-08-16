/**
 * Input validation utilities for GitHub Actions inputs
 * Provides comprehensive validation with clear error messages
 */

import * as z from 'zod/v4';
import type { CommentMode, SSTOperation } from '../types/index.js';
import {
  isValidCommentMode,
  isValidOperation,
  validateMaxOutputSize,
} from '../types/index.js';
import type { SSTRunner } from './cli.js';
import { SST_RUNNERS } from './cli.js';

const STAGE_VALIDATION_PATTERN = /^[a-zA-Z0-9-_]+$/;
const PREFIX_VALIDATION_PATTERN = /^[a-z0-9-]*$/;

/**
 * Common field schemas used across operations
 */
const CommonFieldSchemas = {
  operation: z
    .string()
    .min(1, 'Operation is required and cannot be empty')
    .refine((val) => isValidOperation(val), {
      message: 'Invalid operation. Must be one of: deploy, diff, remove, stage',
    })
    .transform((val) => val as SSTOperation),

  stage: z
    .string()
    .min(1, 'Stage cannot be empty')
    .refine(
      (val) =>
        val.trim().length > 0 && STAGE_VALIDATION_PATTERN.test(val.trim()),
      'Stage must contain only alphanumeric characters, hyphens, and underscores'
    )
    .transform((val) => val.trim()),

  optionalStage: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        (val.trim().length > 0 && STAGE_VALIDATION_PATTERN.test(val.trim())),
      'Stage must contain only alphanumeric characters, hyphens, and underscores'
    )
    .transform((val) => val?.trim() || ''),

  token: z.string().min(1, 'Token cannot be empty'),

  commentMode: z
    .string()
    .default('on-success')
    .refine((val) => isValidCommentMode(val), {
      message:
        'Invalid comment mode. Must be one of: always, on-success, on-failure, never',
    })
    .transform((val) => val as CommentMode),

  failOnError: z.boolean().default(true),

  maxOutputSize: z
    .number()
    .or(
      z.string().transform((val) => {
        const parsed = Number.parseInt(val, 10);
        if (Number.isNaN(parsed)) {
          throw new Error('max-output-size must be a valid number');
        }
        return parsed;
      })
    )
    .transform((val) => validateMaxOutputSize(val))
    .default(50_000),

  runner: z
    .string()
    .default('bun')
    .refine((val): val is SSTRunner => SST_RUNNERS.includes(val as SSTRunner), {
      message: `Invalid runner. Must be one of: ${SST_RUNNERS.join(', ')}`,
    })
    .transform((val) => val as SSTRunner),

  truncationLength: z
    .number()
    .or(
      z.string().transform((val) => {
        const parsed = Number.parseInt(val, 10);
        if (Number.isNaN(parsed)) {
          throw new Error('truncation-length must be a valid number');
        }
        return parsed;
      })
    )
    .refine((val) => val > 0 && val <= 100, {
      message: 'Truncation length must be between 1 and 100 characters',
    })
    .default(26),

  prefix: z
    .string()
    .refine((val) => val.length <= 10, {
      message: 'Prefix must be 10 characters or less',
    })
    .refine((val) => PREFIX_VALIDATION_PATTERN.test(val), {
      message:
        'Prefix must contain only lowercase letters, numbers, and hyphens',
    })
    .default('pr-'),
};

/**
 * Base schema for SST infrastructure operations
 */
const BaseInfrastructureSchema = z.object({
  token: CommonFieldSchemas.token,
  commentMode: CommonFieldSchemas.commentMode.optional(),
  failOnError: CommonFieldSchemas.failOnError.optional(),
  maxOutputSize: CommonFieldSchemas.maxOutputSize.optional(),
  runner: CommonFieldSchemas.runner.optional(),
});

/**
 * Operation-specific input schemas using discriminated unions
 */
const DeployInputsSchema = z
  .object({
    operation: z.literal('deploy'),
    stage: CommonFieldSchemas.optionalStage.optional(),
  })
  .extend(BaseInfrastructureSchema.shape)
  .strict();

const DiffInputsSchema = z
  .object({
    operation: z.literal('diff'),
    stage: CommonFieldSchemas.stage,
  })
  .extend(BaseInfrastructureSchema.shape)
  .strict();

const RemoveInputsSchema = z
  .object({
    operation: z.literal('remove'),
    stage: CommonFieldSchemas.stage,
  })
  .extend(BaseInfrastructureSchema.shape)
  .strict();

const StageInputsSchema = z
  .object({
    operation: z.literal('stage'),
    truncationLength: CommonFieldSchemas.truncationLength.optional(),
    prefix: CommonFieldSchemas.prefix.optional(),
  })
  .strict();

/**
 * Discriminated union schema for all operation types
 */
export const OperationInputsSchema = z.discriminatedUnion('operation', [
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
    suggestions: string[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
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

  if (operation === 'stage') {
    // Stage operations only need these fields
    return {
      operation: rawInputs.operation,
      truncationLength: rawInputs.truncationLength,
      prefix: rawInputs.prefix,
    };
  }
  // Infrastructure operations (deploy, diff, remove) need these fields
  return {
    operation: rawInputs.operation,
    stage: rawInputs.stage,
    token: rawInputs.token,
    commentMode: rawInputs.commentMode,
    failOnError: rawInputs.failOnError,
    maxOutputSize: rawInputs.maxOutputSize,
    runner: rawInputs.runner,
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
    if (error instanceof z.ZodError && error.issues.length > 0) {
      // Transform Zod errors into more user-friendly validation errors
      const issue = error.issues[0]; // Focus on first error for clarity
      if (!issue) {
        throw error;
      }

      const fieldName = issue.path.length > 0 ? issue.path[0] : 'unknown';
      const operation = (rawInputs.operation as string) || 'unknown';
      const suggestions = generateOperationSuggestions(
        String(fieldName),
        issue,
        operation
      );

      throw new ValidationError(
        issue.message,
        String(fieldName),
        rawInputs[String(fieldName)],
        suggestions
      );
    }
    throw error;
  }
}

/**
 * Generate operation-specific helpful suggestions based on validation errors
 */
function generateOperationSuggestions(
  field: string,
  _issue: z.ZodIssue,
  operation: string
): string[] {
  switch (field) {
    case 'operation':
      return [
        'Valid operations are: deploy, diff, remove, stage',
        'Use "deploy" for deploying infrastructure to AWS',
        'Use "diff" to preview infrastructure changes without deploying',
        'Use "remove" to clean up and delete deployed resources',
        'Use "stage" to compute stage names from Git context',
      ];

    case 'stage':
      return generateStagesuggestions(operation);

    case 'token':
      return generateTokenSuggestions(operation);

    case 'truncationLength':
      return [
        'Truncation length controls maximum stage name length (1-100 characters)',
        'Only applies to stage operations for DNS compatibility',
        'Default is 26 characters to fit Route53 limits',
        'Use smaller values for shorter stage names',
      ];

    case 'prefix':
      return [
        'Prefix is added to stage names that start with numbers',
        'Only applies to stage operations',
        'Must be lowercase letters, numbers, and hyphens only',
        'Default "pr-" creates names like "pr-123" for PR #123',
      ];

    default:
      return generateGeneralSuggestions(field);
  }
}

/**
 * Generate stage-specific suggestions based on operation type
 */
function generateStagesuggestions(operation: string): string[] {
  switch (operation) {
    case 'deploy':
      return [
        'Deploy operations can auto-compute stage from Git context',
        'Leave empty to use branch/PR name as stage',
        'Or provide explicit stage: "production", "staging", "dev-123"',
        'Uses alphanumeric characters, hyphens, and underscores only',
      ];
    case 'diff':
      return [
        'Diff operations require explicit stage name',
        'Cannot preview changes without knowing target stage',
        'Examples: "production", "staging", "dev-123", "pr-456"',
        'Must match an existing deployed stage for comparison',
      ];
    case 'remove':
      return [
        'Remove operations require explicit stage for safety',
        'Will not auto-compute stage to prevent accidental deletions',
        'Examples: "staging", "dev-123", "pr-456"',
        'Use caution with production stages',
      ];
    default:
      return [
        'Stage must contain only alphanumeric characters, hyphens, and underscores',
        'Examples: "production", "staging", "dev-123", "pr-456"',
      ];
  }
}

/**
 * Generate token-specific suggestions based on operation type
 */
function generateTokenSuggestions(operation: string): string[] {
  switch (operation) {
    case 'deploy':
      return [
        'Deploy operations require GitHub token for authentication',
        `Use \`${'$'}{{ secrets.GITHUB_TOKEN }}\` or personal access token`,
        'Token needed to comment on PRs and access AWS credentials',
        'Use "fake-token" only for local testing',
      ];
    case 'diff':
      return [
        'Diff operations require GitHub token for PR comments',
        `Use \`${'$'}{{ secrets.GITHUB_TOKEN }}\` for automatic token`,
        'Token needed to post comparison results to pull requests',
        'Use "fake-token" only for local testing',
      ];
    case 'remove':
      return [
        'Remove operations require GitHub token for confirmation',
        `Use \`${'$'}{{ secrets.GITHUB_TOKEN }}\` or personal access token`,
        'Token needed for authentication and result reporting',
        'Use "fake-token" only for local testing',
      ];
    case 'stage':
      return [
        'Stage operations do not require GitHub token',
        'This operation only computes stage names from Git context',
        'No infrastructure access or API calls needed',
      ];
    default:
      return [
        `Use a valid GitHub token (e.g., \`${'$'}{{ secrets.GITHUB_TOKEN }}\`)`,
        'Token must be provided and cannot be empty',
        'Use "fake-token" only for testing',
      ];
  }
}

/**
 * Generate general field suggestions
 */
function generateGeneralSuggestions(field: string): string[] {
  switch (field) {
    case 'commentMode':
      return [
        'Valid comment modes are: always, on-success, on-failure, never',
        'Use "always" to comment on every run',
        'Use "on-success" to comment only when operation succeeds',
        'Use "on-failure" to comment only when operation fails',
        'Use "never" to disable PR comments',
      ];

    case 'failOnError':
      return [
        'Supported values: true, false, yes, no, 1, 0, on, off, enabled, disabled',
        'Use "true" or "yes" to fail the workflow on errors',
        'Use "false" or "no" to continue workflow even if operation fails',
        'Values are case-insensitive',
      ];

    case 'maxOutputSize':
      return [
        'Must be a number between 1000 and 1000000 (1MB)',
        'Specify output size limit in bytes',
        'Default is 50000 bytes (50KB)',
        'Use larger values for verbose SST outputs',
      ];

    case 'runner':
      return [
        'Valid runners are: bun, npm, pnpm, yarn, sst',
        'Use "bun" (default) for Bun runtime',
        'Use "npm" for npm with package scripts',
        'Use "pnpm" for PNPM runtime',
        'Use "yarn" for Yarn runtime',
        'Use "sst" for direct SST binary execution',
      ];

    default:
      return [];
  }
}

/**
 * Validate individual GitHub Actions input with detailed error reporting
 */
export function validateInput<T>(
  value: unknown,
  schema: z.ZodSchema<T>,
  fieldName: string
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError && error.issues.length > 0) {
      const issue = error.issues[0];
      if (!issue) {
        throw error;
      }

      const suggestions = generateOperationSuggestions(
        fieldName,
        issue,
        'unknown'
      );

      throw new ValidationError(issue.message, fieldName, value, suggestions);
    }
    throw error;
  }
}

/**
 * Create operation-specific validation context
 */
export interface ValidationContext {
  isProduction: boolean;
  allowFakeTokens: boolean;
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
    case 'remove':
      // Remove operations should not be run on production without extra confirmation
      if (context.isProduction && inputs.stage.toLowerCase().includes('prod')) {
        throw new ValidationError(
          'Remove operation on production stage requires explicit confirmation',
          'operation',
          inputs.operation,
          [
            'Consider using a different stage name for production removal',
            'Ensure this is intentional as it will delete resources',
            'Use staging or development stages for testing removal',
          ]
        );
      }
      break;

    case 'diff':
      // Diff operations require explicit stage - already validated by schema
      break;

    case 'deploy':
      // Deploy operations should validate token format more strictly in production
      if (
        context.isProduction &&
        !context.allowFakeTokens &&
        inputs.token === 'fake-token'
      ) {
        throw new ValidationError(
          'Production deployments require a real GitHub token',
          'token',
          inputs.token,
          [
            `Use \`${'$'}{{ secrets.GITHUB_TOKEN }}\` or a valid personal access token`,
          ]
        );
      }
      break;

    case 'stage':
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
    isProduction: Boolean(
      env.GITHUB_REF === 'refs/heads/main' ||
        env.GITHUB_REF?.includes('refs/tags/')
    ),
    allowFakeTokens: Boolean(env.NODE_ENV === 'test' || env.CI !== 'true'),
  };
}
