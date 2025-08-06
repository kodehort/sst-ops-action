/**
 * Enhanced error handler for SST operations
 * Provides comprehensive error categorization, recovery suggestions, and debugging artifacts
 */

import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import type { OperationOptions, SSTOperation } from '../types';
import { ValidationError } from '../utils/validation';
import {
  type ActionError,
  ERROR_PATTERNS,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from './categories';

/**
 * Enhanced error handler for SST operations
 */
export class ErrorHandler {
  /**
   * Categorize error with enhanced pattern matching and context awareness
   */
  static categorizeError(
    error: Error,
    context?: {
      operation?: SSTOperation;
      stage?: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      duration?: number;
    }
  ): ActionError {
    // Handle validation errors specially
    if (error instanceof ValidationError) {
      const result: ActionError = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.HIGH,
        message: error.message,
        originalError: error,
        suggestions: error.suggestions,
        recoverable: false,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
        context: { field: error.field, value: error.value },
      };

      if (context) {
        result.debugInfo = {
          ...context,
          ...(context.operation && { operation: String(context.operation) }),
        };
      }

      return result;
    }

    // Try to match against known error patterns
    const errorMessage = error.message.toLowerCase();
    const combinedMessage = context?.stderr
      ? `${errorMessage} ${context.stderr.toLowerCase()}`
      : errorMessage;

    for (const pattern of ERROR_PATTERNS) {
      if (pattern.patterns.some((regex) => regex.test(combinedMessage))) {
        const result: ActionError = {
          category: pattern.category,
          severity: pattern.severity,
          message: error.message,
          originalError: error,
          suggestions: pattern.getSuggestions(error),
          recoverable: pattern.recoverable,
          retryable: pattern.retryable,
          recoveryStrategy: pattern.recoveryStrategy,
        };

        if (context) {
          result.debugInfo = {
            ...context,
            ...(context.operation && { operation: String(context.operation) }),
          };
        }

        return result;
      }
    }

    // Default categorization for unknown errors
    const result: ActionError = {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      originalError: error,
      suggestions: [
        'Review the full error message and stack trace for more details',
        'Check GitHub Actions logs for additional context',
        'Ensure all inputs and configuration are correct',
        'Contact support if the issue persists with error details',
      ],
      recoverable: true,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
    };

    if (context) {
      result.debugInfo = {
        ...context,
        ...(context.operation && { operation: String(context.operation) }),
      };
    }

    return result;
  }

  /**
   * Handle errors with comprehensive logging, artifacts, and GitHub Actions integration
   */
  static async handleError(
    error: ActionError,
    options: OperationOptions
  ): Promise<void> {
    // Log structured error information
    await ErrorHandler.logError(error, options);

    // Create debugging artifacts
    await ErrorHandler.createErrorArtifacts(error, options);

    // Create GitHub Actions job summary
    await ErrorHandler.createJobSummary(error, options);

    // Set failure state if not recoverable or fail-on-error is true
    if (!error.recoverable || options.failOnError) {
      const failureMessage = ErrorHandler.formatFailureMessage(error, options);
      core.setFailed(failureMessage);
    } else {
      // For recoverable errors with fail-on-error false, just log as warning
      core.warning(`Recoverable ${error.category} error: ${error.message}`);
    }
  }

  /**
   * Log error with structured information
   */
  private static async logError(
    error: ActionError,
    options: OperationOptions
  ): Promise<void> {
    const severityEmoji = {
      [ErrorSeverity.LOW]: '🟡',
      [ErrorSeverity.MEDIUM]: '🟠',
      [ErrorSeverity.HIGH]: '🔴',
      [ErrorSeverity.CRITICAL]: '🚨',
    };

    // Main error log
    core.error(
      `${severityEmoji[error.severity]} ${options.stage} ${error.category.replace('_', ' ')} error: ${error.message}`
    );

    // Debug information
    if (error.debugInfo) {
      core.debug(`Debug Info: ${JSON.stringify(error.debugInfo, null, 2)}`);
    }

    // Recovery information
    core.info(`🔄 Recoverable: ${error.recoverable ? 'Yes' : 'No'}`);
    core.info(`⏱️  Retryable: ${error.retryable ? 'Yes' : 'No'}`);
    core.info(
      `🔧 Recovery Strategy: ${error.recoveryStrategy.replace('_', ' ')}`
    );

    // Log suggestions
    if (error.suggestions.length > 0) {
      core.info('💡 Suggested solutions:');
      error.suggestions.forEach((suggestion, index) => {
        core.info(`   ${index + 1}. ${suggestion}`);
      });
    }

    // Operation-specific context
    if (error.debugInfo?.operation) {
      core.info(
        `📋 Operation: ${error.debugInfo.operation} (stage: ${error.debugInfo.stage || 'unknown'})`
      );

      if (error.debugInfo.exitCode !== undefined) {
        core.info(`🚪 Exit Code: ${error.debugInfo.exitCode}`);
      }

      if (error.debugInfo.duration !== undefined) {
        core.info(`⏰ Duration: ${error.debugInfo.duration}ms`);
      }
    }
  }

  /**
   * Create debugging artifacts for troubleshooting
   */
  private static async createErrorArtifacts(
    error: ActionError,
    options: OperationOptions
  ): Promise<void> {
    try {
      const artifactDir = join(tmpdir(), 'sst-error-artifacts');
      await io.mkdirP(artifactDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Error summary artifact
      const errorSummary = {
        timestamp,
        operation: error.debugInfo?.operation || 'unknown',
        stage: options.stage,
        category: error.category,
        severity: error.severity,
        message: error.message,
        suggestions: error.suggestions,
        recoverable: error.recoverable,
        retryable: error.retryable,
        recoveryStrategy: error.recoveryStrategy,
        debugInfo: error.debugInfo,
        context: error.context,
        stackTrace: error.originalError?.stack,
      };

      await writeFile(
        join(artifactDir, `error-summary-${timestamp}.json`),
        JSON.stringify(errorSummary, null, 2)
      );

      // Raw output artifacts if available
      if (error.debugInfo?.stdout) {
        await writeFile(
          join(artifactDir, `stdout-${timestamp}.txt`),
          error.debugInfo.stdout
        );
      }

      if (error.debugInfo?.stderr) {
        await writeFile(
          join(artifactDir, `stderr-${timestamp}.txt`),
          error.debugInfo.stderr
        );
      }

      // Environment context
      const envContext = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
        env: {
          CI: process.env.CI,
          GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
          GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
          GITHUB_REF: process.env.GITHUB_REF,
          GITHUB_SHA: process.env.GITHUB_SHA,
        },
        inputs: {
          operation: error.debugInfo?.operation,
          stage: options.stage,
          commentMode: options.commentMode,
          failOnError: options.failOnError,
        },
      };

      await writeFile(
        join(artifactDir, `environment-${timestamp}.json`),
        JSON.stringify(envContext, null, 2)
      );

      core.info(`📁 Error artifacts created in: ${artifactDir}`);
    } catch (artifactError) {
      core.warning(
        `Failed to create error artifacts: ${artifactError instanceof Error ? artifactError.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create comprehensive GitHub Actions job summary
   */
  private static async createJobSummary(
    error: ActionError,
    options: OperationOptions
  ): Promise<void> {
    try {
      const severityEmoji = {
        [ErrorSeverity.LOW]: '🟡',
        [ErrorSeverity.MEDIUM]: '🟠',
        [ErrorSeverity.HIGH]: '🔴',
        [ErrorSeverity.CRITICAL]: '🚨',
      };

      const recoveryEmoji = {
        [RecoveryStrategy.RETRY]: '🔄',
        [RecoveryStrategy.MANUAL_INTERVENTION]: '🔧',
        [RecoveryStrategy.CONFIGURATION_UPDATE]: '⚙️',
        [RecoveryStrategy.NOT_RECOVERABLE]: '❌',
      };

      let summary = `# ${severityEmoji[error.severity]} SST Operation Failed\n\n`;

      // Error overview table
      summary += '| Property | Value |\n';
      summary += '|----------|-------|\n';
      summary += `| **Operation** | ${error.debugInfo?.operation || 'Unknown'} |\n`;
      summary += `| **Stage** | \`${options.stage}\` |\n`;
      summary += `| **Category** | ${error.category.replace('_', ' ')} |\n`;
      summary += `| **Severity** | ${severityEmoji[error.severity]} ${error.severity.toUpperCase()} |\n`;
      summary += `| **Recoverable** | ${error.recoverable ? '✅ Yes' : '❌ No'} |\n`;
      summary += `| **Retryable** | ${error.retryable ? '✅ Yes' : '❌ No'} |\n`;
      summary += `| **Strategy** | ${recoveryEmoji[error.recoveryStrategy]} ${error.recoveryStrategy.replace('_', ' ')} |\n\n`;

      // Error message
      summary += '## 🚫 Error Details\n\n';
      summary += '```\n';
      summary += error.message;
      summary += '\n```\n\n';

      // Debug information if available
      if (error.debugInfo?.stderr) {
        summary += '## 🔍 Error Output\n\n';
        summary += '<details>\n<summary>Show stderr output</summary>\n\n```\n';
        summary += error.debugInfo.stderr.slice(0, 2000); // Limit size
        if (error.debugInfo.stderr.length > 2000) {
          summary += '\n... (truncated)';
        }
        summary += '\n```\n</details>\n\n';
      }

      // Recovery suggestions
      if (error.suggestions.length > 0) {
        summary += '## 💡 Recommended Actions\n\n';
        error.suggestions.forEach((suggestion, index) => {
          summary += `${index + 1}. ${suggestion}\n`;
        });
        summary += '\n';
      }

      // Next steps based on recovery strategy
      summary += '## 🔧 Next Steps\n\n';

      switch (error.recoveryStrategy) {
        case RecoveryStrategy.RETRY:
          summary +=
            '🔄 **Retry the operation** - This error is typically temporary and may resolve on retry.\n\n';
          break;
        case RecoveryStrategy.CONFIGURATION_UPDATE:
          summary +=
            '⚙️ **Update configuration** - Review and update your SST configuration or inputs.\n\n';
          break;
        case RecoveryStrategy.MANUAL_INTERVENTION:
          summary +=
            '🔧 **Manual investigation required** - Review the error details and apply the suggested solutions.\n\n';
          break;
        case RecoveryStrategy.NOT_RECOVERABLE:
          summary +=
            '❌ **Manual fix required** - This error requires investigation and manual resolution.\n\n';
          break;
      }

      if (error.debugInfo?.operation) {
        summary += '### Debug Information\n\n';
        summary += `- **Exit Code**: ${error.debugInfo.exitCode || 'N/A'}\n`;
        summary += `- **Duration**: ${error.debugInfo.duration || 'N/A'}ms\n`;
        summary += `- **Timestamp**: ${new Date().toISOString()}\n\n`;
      }

      summary += '### Support Resources\n\n';
      summary += '- [SST Documentation](https://docs.sst.dev)\n';
      summary +=
        '- [Troubleshooting Guide](https://github.com/serverless-stack/sst/discussions)\n';
      summary +=
        '- [GitHub Actions Debug Logs](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)\n';

      await core.summary.addRaw(summary).write();
      core.info('📋 Error summary added to job summary');
    } catch (summaryError) {
      core.warning(
        `Failed to create job summary: ${summaryError instanceof Error ? summaryError.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Format failure message for GitHub Actions
   */
  private static formatFailureMessage(
    error: ActionError,
    options: OperationOptions
  ): string {
    let message = `${error.category.replace('_', ' ')} error in ${options.stage}`;

    if (error.debugInfo?.operation) {
      message += ` ${error.debugInfo.operation} operation`;
    }

    message += `: ${error.message}`;

    // Add recovery hint
    if (error.retryable) {
      message += ' (retryable)';
    } else if (error.recoverable) {
      message += ' (recoverable)';
    }

    return message;
  }

  /**
   * Check if error indicates a partial success scenario
   */
  static isPartialSuccess(error: ActionError): boolean {
    return (
      error.category === ErrorCategory.OUTPUT_PARSING ||
      (error.recoverable && error.severity !== ErrorSeverity.CRITICAL)
    );
  }

  /**
   * Get appropriate exit code for error type
   */
  static getExitCode(error: ActionError): number {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 2;
      case ErrorSeverity.HIGH:
        return 1;
      default:
        return error.recoverable ? 0 : 1;
    }
  }

  /**
   * Create error from SST CLI execution failure
   */
  static createCLIError(
    message: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    operation: SSTOperation,
    stage: string,
    duration?: number
  ): ActionError {
    const error = new Error(message);

    return ErrorHandler.categorizeError(error, {
      operation,
      stage,
      exitCode,
      stdout,
      stderr,
      ...(duration !== undefined && { duration }),
    });
  }

  /**
   * Create error from parsing failure
   */
  static createParsingError(
    message: string,
    operation: SSTOperation,
    stage: string,
    rawOutput: string
  ): ActionError {
    const error = new Error(`Failed to parse ${operation} output: ${message}`);

    return ErrorHandler.categorizeError(error, {
      operation,
      stage,
      stdout: rawOutput,
    });
  }

  /**
   * Create error from GitHub API failure
   */
  static createGitHubError(
    message: string,
    operation: SSTOperation,
    stage: string
  ): ActionError {
    const error = new Error(`GitHub API error: ${message}`);

    return ErrorHandler.categorizeError(error, {
      operation,
      stage,
    });
  }
}
