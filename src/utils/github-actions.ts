/**
 * GitHub Actions integration utilities
 * Handles parsing inputs and setting outputs using @actions/core
 */

import * as core from '@actions/core';
import type { OperationResult } from '../types/index.js';
import {
  type ActionInputs,
  parseActionInputs,
  ValidationError,
} from './validation.js';

/**
 * Parse and validate all GitHub Actions inputs from the environment
 */
export function getActionInputs(): ActionInputs {
  try {
    const rawInputs = {
      operation: core.getInput('operation') || undefined,
      stage: core.getInput('stage'),
      token: core.getInput('token'),
      commentMode: core.getInput('comment-mode') || undefined,
      failOnError:
        core.getBooleanInput('fail-on-error') ||
        core.getInput('fail-on-error') ||
        undefined,
      maxOutputSize: core.getInput('max-output-size') || undefined,
    };

    // Remove undefined values to let schema defaults work
    const cleanInputs = Object.fromEntries(
      Object.entries(rawInputs).filter(([, value]) => value !== undefined)
    );

    return parseActionInputs(cleanInputs);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Create actionable error message for GitHub Actions
      const message = `Input validation failed for '${error.field}': ${error.message}`;
      const details =
        error.suggestions.length > 0
          ? `\n\nSuggestions:\n${error.suggestions.map((s) => `  • ${s}`).join('\n')}`
          : '';

      core.setFailed(message + details);
      throw error;
    }
    throw error;
  }
}

/**
 * Set all GitHub Actions outputs from an operation result
 */
export function setActionOutputs(result: OperationResult): void {
  // Required outputs (always set)
  core.setOutput('success', String(result.success));
  core.setOutput('operation', result.operation);
  core.setOutput('stage', result.stage);
  core.setOutput('completion_status', result.completionStatus);

  // Common optional outputs
  core.setOutput('app', result.app || '');
  core.setOutput('permalink', result.permalink || '');
  core.setOutput('truncated', String(result.truncated));
  core.setOutput(
    'resource_changes',
    String(('resourceChanges' in result ? result.resourceChanges : 0) || 0)
  );

  // Operation-specific outputs
  switch (result.operation) {
    case 'deploy':
      if ('urls' in result) {
        core.setOutput('urls', JSON.stringify(result.urls || []));
      }
      if ('resources' in result) {
        core.setOutput('resources', JSON.stringify(result.resources || []));
      }
      break;

    case 'diff':
      if ('changeSummary' in result) {
        core.setOutput('diff_summary', result.changeSummary || '');
      }
      if ('plannedChanges' in result) {
        core.setOutput('planned_changes', String(result.plannedChanges || 0));
      }
      break;

    case 'remove':
      if ('resourcesRemoved' in result) {
        core.setOutput(
          'resources_removed',
          String(result.resourcesRemoved || 0)
        );
      }
      if ('removedResources' in result) {
        core.setOutput(
          'removed_resources',
          JSON.stringify(result.removedResources || [])
        );
      }
      break;
  }

  // Set error output if operation failed
  if (!result.success && result.error) {
    core.setOutput('error', result.error);
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
    error.suggestions.forEach((suggestion) => {
      core.info(`  • ${suggestion}`);
    });
  }
}

/**
 * Log operation start with input summary
 */
export function logOperationStart(inputs: ActionInputs): void {
  core.info(`🚀 Starting SST ${inputs.operation} operation`);
  core.info(`📍 Stage: ${inputs.stage}`);
  core.info(`💬 Comment mode: ${inputs.commentMode}`);
  core.info(`⚠️  Fail on error: ${inputs.failOnError}`);

  // Log additional context for debugging
  core.debug(`Max output size: ${inputs.maxOutputSize} bytes`);
  core.debug(
    `Token type: ${
      inputs.token.startsWith('ghp_')
        ? 'Personal Access Token'
        : inputs.token.startsWith('github_pat_')
          ? 'GitHub App Token'
          : 'Test Token'
    }`
  );
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
 * Create GitHub Actions summary for the operation
 */
export function createActionSummary(result: OperationResult): void {
  const statusEmoji = result.success ? '✅' : '❌';
  const statusColor = result.success ? '🟢' : '🔴';

  let summary = `# ${statusEmoji} SST ${result.operation.charAt(0).toUpperCase() + result.operation.slice(1)} Operation\n\n`;

  // Operation details
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

  // Operation-specific details
  if (
    result.operation === 'deploy' &&
    'urls' in result &&
    result.urls?.length
  ) {
    summary += '## 🌐 Deployed URLs\n\n';
    result.urls.forEach((url) => {
      summary += `- **${url.name}** (${url.type}): ${url.url}\n`;
    });
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

  // Error details
  if (!result.success && result.error) {
    summary += '## ❌ Error Details\n\n';
    summary += '```\n';
    summary += result.error;
    summary += '\n```\n\n';
  }

  // Truncation warning
  if (result.truncated) {
    summary +=
      '> ⚠️ **Note**: Output was truncated due to size limits. Check the raw output for complete details.\n\n';
  }

  // Write summary
  core.summary.addRaw(summary).write();
}

/**
 * Mask sensitive values in GitHub Actions logs
 */
export function maskSensitiveValues(inputs: ActionInputs): void {
  // Mask the token to prevent accidental exposure in logs
  if (inputs.token !== 'fake-token') {
    core.setSecret(inputs.token);
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
  const majorVersion = Number.parseInt(nodeVersion.slice(1).split('.')[0], 10);

  if (majorVersion < 20) {
    throw new Error(
      `Node.js ${nodeVersion} is not supported. Requires Node.js 20 or higher.`
    );
  }
}
