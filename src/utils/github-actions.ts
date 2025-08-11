/**
 * GitHub Actions integration utilities
 * Handles parsing inputs and setting outputs using @actions/core
 */

import * as core from '@actions/core';
import { OutputFormatter } from '../outputs/formatter.js';
import type { OperationResult } from '../types/index.js';
import {
  type OperationInputsType,
  parseOperationInputs,
  ValidationError,
} from './validation.js';

/**
 * Parse stage operation inputs
 */
function parseStageInputs(): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  const truncationLengthStr = core.getInput('truncation-length');
  if (truncationLengthStr) {
    inputs.truncationLength = Number.parseInt(truncationLengthStr, 10);
  }

  const prefixStr = core.getInput('prefix');
  if (prefixStr) {
    inputs.prefix = prefixStr;
  }

  return inputs;
}

/**
 * Parse infrastructure operation inputs
 */
function parseInfrastructureInputs(): Record<string, unknown> {
  const inputs: Record<string, unknown> = {
    token: core.getInput('token'),
  };

  const commentMode = core.getInput('comment-mode');
  if (commentMode) {
    inputs.commentMode = commentMode;
  }

  const failOnErrorInput = core.getInput('fail-on-error');
  if (failOnErrorInput) {
    inputs.failOnError = core.getBooleanInput('fail-on-error');
  }

  const maxOutputSizeStr = core.getInput('max-output-size');
  if (maxOutputSizeStr) {
    inputs.maxOutputSize = Number.parseInt(maxOutputSizeStr, 10);
  }

  const runnerStr = core.getInput('runner');
  if (runnerStr) {
    inputs.runner = runnerStr;
  }

  return inputs;
}

/**
 * Create validation error message for GitHub Actions
 */
function createValidationErrorMessage(error: ValidationError): string {
  const message = `Input validation failed for '${error.field}': ${error.message}`;
  const details =
    error.suggestions.length > 0
      ? `\n\nSuggestions:\n${error.suggestions.map((s) => `  • ${s}`).join('\n')}`
      : '';
  return message + details;
}

/**
 * Parse and validate all GitHub Actions inputs from the environment
 */
export function getActionInputs(): OperationInputsType {
  try {
    // Get the operation first to determine which inputs to read
    const operation = core.getInput('operation') || 'deploy';

    // Build base inputs
    const rawInputs: Record<string, unknown> = {
      operation,
      stage: core.getInput('stage') || '',
    };

    // Add operation-specific inputs
    if (operation === 'stage') {
      Object.assign(rawInputs, parseStageInputs());
    } else {
      Object.assign(rawInputs, parseInfrastructureInputs());
    }

    return parseOperationInputs(rawInputs);
  } catch (error) {
    if (error instanceof ValidationError) {
      const message = createValidationErrorMessage(error);
      core.setFailed(message);
      throw error;
    }
    throw error;
  }
}

/**
 * Set all GitHub Actions outputs from an operation result
 * Uses OutputFormatter for consistent formatting and validation
 */
export function setActionOutputs(result: OperationResult): void {
  try {
    // Use OutputFormatter for consistent formatting
    const standardizedOutputs =
      OutputFormatter.formatOperationForGitHubActions(result);

    // Validate outputs before setting
    OutputFormatter.validateOutputs(standardizedOutputs);

    // Ensure operation-specific consistency
    OutputFormatter.validateOperationConsistency(
      standardizedOutputs,
      result.operation
    );

    // Set all outputs using GitHub Actions core
    for (const [key, value] of Object.entries(standardizedOutputs)) {
      core.setOutput(key, value);
    }

    // Log successful output formatting for debugging
    core.debug(
      `Successfully formatted and set ${Object.keys(standardizedOutputs).length} outputs`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown output formatting error';
    core.error(`Failed to format outputs: ${errorMessage}`);

    // Fallback: set minimal required outputs to prevent workflow failure
    core.setOutput('success', String(result.success));
    core.setOutput('operation', result.operation);
    core.setOutput('stage', result.stage);
    core.setOutput('completion_status', result.completionStatus);
    core.setOutput('error', result.error || errorMessage);

    throw error;
  }
}

/**
 * Log validation error with structured information for debugging
 */
export function logValidationError(error: ValidationError): void {
  core.error(`Input validation failed for field '${error.field}'`);
  core.error(`Value provided: ${JSON.stringify(error.value)}`);
  core.error(`Error: ${error.message}`);

  if (error.suggestions.length > 0) {
    core.info('Suggestions to fix this error:');
    for (const suggestion of error.suggestions) {
      core.info(`  • ${suggestion}`);
    }
  }
}

/**
 * Get stage name for logging
 */
function getStageForLogging(inputs: OperationInputsType): string {
  if (inputs.operation === 'stage') {
    return 'computed';
  }
  if (inputs.operation === 'deploy') {
    return inputs.stage || 'auto';
  }
  return inputs.stage;
}

/**
 * Determine token type for logging
 */
function getTokenType(token: string): string {
  if (token.startsWith('ghp_')) {
    return 'Personal Access Token';
  }
  if (token.startsWith('github_pat_')) {
    return 'GitHub App Token';
  }
  return 'Test Token';
}

/**
 * Log infrastructure operation inputs
 */
function logInfrastructureInputs(inputs: OperationInputsType): void {
  const infraInputs = inputs as typeof inputs & {
    token: string;
    commentMode?: string;
    failOnError?: boolean;
    maxOutputSize?: number;
  };

  core.info(`💬 Comment mode: ${infraInputs.commentMode || 'on-success'}`);
  core.info(`⚠️  Fail on error: ${infraInputs.failOnError ?? true}`);
  core.debug(`Max output size: ${infraInputs.maxOutputSize || 50_000} bytes`);
  core.debug(`Token type: ${getTokenType(infraInputs.token)}`);
}

/**
 * Log stage operation inputs
 */
function logStageInputs(inputs: OperationInputsType): void {
  const stageInputs = inputs as typeof inputs & {
    truncationLength?: number;
    prefix?: string;
  };

  core.info(`✂️  Truncation length: ${stageInputs.truncationLength || 26}`);
  core.info(`🏷️  Prefix: ${stageInputs.prefix || 'pr-'}`);
}

/**
 * Log operation start with input summary
 */
export function logOperationStart(inputs: OperationInputsType): void {
  core.info(`🚀 Starting SST ${inputs.operation} operation`);

  const stage = getStageForLogging(inputs);
  core.info(`📍 Stage: ${stage}`);

  // Log operation-specific inputs
  if (inputs.operation !== 'stage') {
    logInfrastructureInputs(inputs);
  } else {
    logStageInputs(inputs);
  }
}

/**
 * Log operation completion with result summary
 */
export function logOperationComplete(result: OperationResult): void {
  const statusEmoji = result.success ? '✅' : '❌';
  const statusText = result.completionStatus;

  core.info(`${statusEmoji} SST ${result.operation} ${statusText}`);

  if (result.success) {
    core.info(
      `📊 Resource changes: ${('resourceChanges' in result ? result.resourceChanges : 0) || 0}`
    );

    if (
      result.operation === 'deploy' &&
      'urls' in result &&
      result.urls?.length
    ) {
      core.info(`🌐 Deployed URLs: ${result.urls.length}`);
    }

    if (result.permalink) {
      core.info(`🔗 Console: ${result.permalink}`);
    }
  } else {
    core.error(`❌ Operation failed: ${result.error || 'Unknown error'}`);
  }

  if (result.truncated) {
    core.warning('⚠️ Output was truncated due to size limits');
  }
}

/**
 * Handle operation failure with appropriate GitHub Actions response
 */
export function handleOperationFailure(
  result: OperationResult,
  failOnError: boolean
): void {
  const errorMessage = result.error || 'SST operation failed';

  if (failOnError) {
    core.setFailed(`${result.operation} failed: ${errorMessage}`);
  } else {
    core.warning(
      `${result.operation} failed but continuing due to fail-on-error: false`
    );
    core.warning(`Error: ${errorMessage}`);
  }
}

/**
 * Create basic operation summary table
 */
function createOperationTable(result: OperationResult): string {
  const statusEmoji = result.success ? '✅' : '❌';
  const statusColor = result.success ? '🟢' : '🔴';

  let summary = `# ${statusEmoji} SST ${result.operation.charAt(0).toUpperCase() + result.operation.slice(1)} Operation\n\n`;

  summary += '| Field | Value |\n';
  summary += '|-------|-------|\n';
  summary += `| ${statusColor} Status | ${result.completionStatus} |\n`;
  summary += `| 🏷️ Stage | \`${result.stage}\` |\n`;
  summary += `| 📱 App | \`${result.app || 'N/A'}\` |\n`;
  summary += `| 📊 Resource Changes | ${('resourceChanges' in result ? result.resourceChanges : 0) || 0} |\n`;

  if (result.permalink) {
    summary += `| 🔗 Console | [View in SST Console](${result.permalink}) |\n`;
  }

  summary += '\n';
  return summary;
}

/**
 * Add operation-specific details to summary
 */
function addOperationDetails(
  result: OperationResult,
  initialSummary: string
): string {
  let summary = initialSummary;

  if (
    result.operation === 'deploy' &&
    'urls' in result &&
    result.urls?.length
  ) {
    summary += '## 🌐 Deployed URLs\n\n';
    for (const url of result.urls) {
      summary += `- **${url.name}** (${url.type}): ${url.url}\n`;
    }
    summary += '\n';
  }

  if (
    result.operation === 'diff' &&
    'changeSummary' in result &&
    result.changeSummary
  ) {
    summary += '## 📋 Change Summary\n\n';
    summary += `${result.changeSummary}\n\n`;
  }

  if (result.operation === 'remove' && 'resourcesRemoved' in result) {
    summary += '## 🗑️ Resources Removed\n\n';
    summary += `Total resources removed: **${result.resourcesRemoved || 0}**\n\n`;
  }

  return summary;
}

/**
 * Add error and warning details to summary
 */
function addErrorDetails(
  result: OperationResult,
  initialSummary: string
): string {
  let summary = initialSummary;

  if (!result.success && result.error) {
    summary += '## ❌ Error Details\n\n';
    summary += '```\n';
    summary += result.error;
    summary += '\n```\n\n';
  }

  if (result.truncated) {
    summary +=
      '> ⚠️ **Note**: Output was truncated due to size limits. Check the raw output for complete details.\n\n';
  }

  return summary;
}

/**
 * Create GitHub Actions summary for the operation
 */
export function createActionSummary(result: OperationResult): void {
  let summary = createOperationTable(result);
  summary = addOperationDetails(result, summary);
  summary = addErrorDetails(result, summary);

  core.summary.addRaw(summary).write();
}

/**
 * Mask sensitive values in GitHub Actions logs
 */
export function maskSensitiveValues(inputs: OperationInputsType): void {
  // Mask the token to prevent accidental exposure in logs
  // Only infrastructure operations have tokens
  if (inputs.operation !== 'stage') {
    const infraInputs = inputs as typeof inputs & { token: string };
    if (infraInputs.token !== 'fake-token') {
      core.setSecret(infraInputs.token);
    }
  }
}

/**
 * Validate GitHub Actions environment and requirements
 */
export function validateGitHubActionsEnvironment(): void {
  // Check required environment variables
  const requiredEnvVars = ['GITHUB_REPOSITORY', 'GITHUB_SHA'];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }

  // Check GitHub Actions runtime
  if (!process.env.GITHUB_ACTIONS) {
    core.warning('Not running in GitHub Actions environment');
  }

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = Number.parseInt(
    nodeVersion.slice(1).split('.')[0] || '0',
    10
  );

  if (majorVersion < 20) {
    throw new Error(
      `Node.js ${nodeVersion} is not supported. Requires Node.js 20 or higher.`
    );
  }
}
