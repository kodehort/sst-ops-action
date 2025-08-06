/**
 * Input validation utilities for GitHub Actions inputs
 * Provides comprehensive validation with clear error messages
 */

import { z } from 'zod';
import type { CommentMode, SSTOperation } from '../types/index.js';
import {
  isValidCommentMode,
  isValidOperation,
  validateMaxOutputSize,
} from '../types/index.js';

// Top-level regex patterns for performance
const STAGE_VALIDATION_PATTERN = /^[a-zA-Z0-9-_]+$/;

/**
 * Zod schema for validating all GitHub Actions inputs
 */
export const ActionInputsSchema = z.object({
  operation: z
    .string()
    .default('deploy')
    .refine(
      (val) => isValidOperation(val),
      (val) => ({
        message: `Invalid operation: ${val}. Must be one of: deploy, diff, remove`,
        path: ['operation'],
      })
    )
    .transform((val) => val as SSTOperation),

  stage: z
    .string()
    .min(1, 'Stage cannot be empty')
    .refine(
      (val) => STAGE_VALIDATION_PATTERN.test(val.trim()),
      'Stage must contain only alphanumeric characters, hyphens, and underscores'
    )
    .transform((val) => val.trim()),

  token: z
    .string()
    .min(1, 'Token cannot be empty')
    .refine(
      (val) => {
        // Allow fake-token for testing or actual GitHub tokens
        return (
          val === 'fake-token' ||
          val.startsWith('ghp_') ||
          val.startsWith('github_pat_')
        );
      },
      {
        message:
          'Token must be a valid GitHub token (starting with ghp_ or github_pat_) or "fake-token" for testing',
      }
    ),

  commentMode: z
    .string()
    .default('on-success')
    .refine(
      (val) => isValidCommentMode(val),
      (val) => ({
        message: `Invalid comment mode: ${val}. Must be one of: always, on-success, on-failure, never`,
        path: ['commentMode'],
      })
    )
    .transform((val) => val as CommentMode),

  failOnError: z
    .boolean()
    .or(
      z.string().transform((val) => {
        // Handle string boolean conversion from GitHub Actions
        if (val === 'true') {
          return true;
        }
        if (val === 'false') {
          return false;
        }
        throw new Error('fail-on-error must be "true" or "false"');
      })
    )
    .default(true),

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
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type ActionInputs = z.infer<typeof ActionInputsSchema>;

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
 * Parse and validate GitHub Actions inputs with comprehensive error handling
 */
export function parseActionInputs(
  rawInputs: Record<string, unknown>
): ActionInputs {
  try {
    return ActionInputsSchema.parse(rawInputs);
  } catch (error) {
    if (error instanceof z.ZodError && error.issues.length > 0) {
      // Transform Zod errors into more user-friendly validation errors
      const issue = error.issues[0]; // Focus on first error for clarity
      const fieldName = issue.path.length > 0 ? issue.path[0] : 'unknown';
      const suggestions = generateSuggestions(String(fieldName), issue);

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
 * Generate helpful suggestions based on validation errors
 */
function generateSuggestions(field: string, _issue: z.ZodIssue): string[] {
  switch (field) {
    case 'operation':
      return [
        'Valid operations are: deploy, diff, remove',
        'Use "deploy" for deploying infrastructure',
        'Use "diff" to preview changes without deploying',
        'Use "remove" to clean up resources',
      ];

    case 'stage':
      return [
        'Stage must be a non-empty string',
        'Use only alphanumeric characters, hyphens, and underscores',
        'Examples: "production", "staging", "dev-123", "pr-456"',
      ];

    case 'token':
      return [
        'Use a valid GitHub token (e.g., `${{ secrets.GITHUB_TOKEN }}`)','
        'GitHub personal access tokens start with "ghp_"',
        'GitHub App tokens start with "github_pat_"',
        'Use "fake-token" only for testing',
      ];

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
        'Must be "true" or "false" (as string)',
        'Use "true" to fail the workflow on errors',
        'Use "false" to continue workflow even if operation fails',
      ];

    case 'maxOutputSize':
      return [
        'Must be a number between 1000 and 1000000 (1MB)',
        'Specify output size limit in bytes',
        'Default is 50000 bytes (50KB)',
        'Use larger values for verbose SST outputs',
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
      const suggestions = generateSuggestions(fieldName, issue);

      throw new ValidationError(issue.message, fieldName, value, suggestions);
    }
    throw error;
  }
}

/**
 * Type-safe input validators for specific GitHub Actions input fields
 */
export const InputValidators = {
  operation: (value: unknown) =>
    validateInput(value, ActionInputsSchema.shape.operation, 'operation'),

  stage: (value: unknown) =>
    validateInput(value, ActionInputsSchema.shape.stage, 'stage'),

  token: (value: unknown) =>
    validateInput(value, ActionInputsSchema.shape.token, 'token'),

  commentMode: (value: unknown) =>
    validateInput(value, ActionInputsSchema.shape.commentMode, 'commentMode'),

  failOnError: (value: unknown) =>
    validateInput(value, ActionInputsSchema.shape.failOnError, 'failOnError'),

  maxOutputSize: (value: unknown) =>
    validateInput(
      value,
      ActionInputsSchema.shape.maxOutputSize,
      'maxOutputSize'
    ),
};

/**
 * Create operation-specific validation context
 */
export interface ValidationContext {
  operation: SSTOperation;
  stage: string;
  isProduction: boolean;
  allowFakeTokens: boolean;
}

/**
 * Enhanced validation with operation-specific rules
 */
export function validateWithContext(
  rawInputs: Record<string, unknown>,
  context: Partial<ValidationContext> = {}
): ActionInputs {
  const inputs = parseActionInputs(rawInputs);

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
      // Diff operations are safe but validate stage exists
      if (!inputs.stage.trim()) {
        throw new ValidationError(
          'Diff operation requires a valid stage to compare against',
          'stage',
          inputs.stage,
          ['Provide a stage name to show infrastructure differences for']
        );
      }
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
          ['Use `${{ secrets.GITHUB_TOKEN }}` or a valid personal access token']
        );
      }
      break;

    default:
      // Default case for exhaustive checking
      break;
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
    operation: (env.INPUT_OPERATION || 'deploy') as SSTOperation,
    stage: env.INPUT_STAGE || '',
    isProduction: Boolean(
      env.GITHUB_REF === 'refs/heads/main' ||
        env.GITHUB_REF?.includes('refs/tags/')
    ),
    allowFakeTokens: Boolean(env.NODE_ENV === 'test' || env.CI !== 'true'),
  };
}
