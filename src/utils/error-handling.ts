/**
 * Comprehensive error handling utilities for validation and operation errors
 * Provides structured error categorization and recovery suggestions
 */

import * as core from '@actions/core';
import type { SSTOperation } from '../types/index.js';
import { ValidationError } from './validation.js';

/**
 * Error categories for systematic error handling
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  PARSING = 'parsing',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
  context?: Record<string, unknown>;
}

/**
 * Categorize errors based on their characteristics and provide recovery suggestions
 */
export function categorizeError(
  error: Error,
  context?: Record<string, unknown>
): ErrorInfo {
  const message = error.message.toLowerCase();

  // Validation errors
  if (error instanceof ValidationError) {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.HIGH,
      message: error.message,
      originalError: error,
      suggestions: error.suggestions,
      recoverable: false,
      retryable: false,
      ...(context && { context }),
    };
  }

  // Authentication errors
  if (
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('401')
  ) {
    return {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.CRITICAL,
      message: error.message,
      originalError: error,
      suggestions: [
        'Check that your GitHub token is valid and not expired',
        'Ensure the token has the necessary permissions for this repository',
        'Try regenerating your personal access token',
        'Verify that secrets are properly configured in repository settings',
      ],
      recoverable: false,
      retryable: false,
      ...(context && { context }),
    };
  }

  // Permission errors
  if (
    message.includes('permission') ||
    message.includes('forbidden') ||
    message.includes('403')
  ) {
    return {
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.HIGH,
      message: error.message,
      originalError: error,
      suggestions: [
        'Ensure the GitHub token has write permissions to the repository',
        'Check that the repository settings allow actions to create comments',
        'Verify AWS credentials have appropriate permissions for the SST operation',
        'Contact repository administrators if permissions cannot be resolved',
      ],
      recoverable: false,
      retryable: false,
      ...(context && { context }),
    };
  }

  // Network and timeout errors
  if (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('econnreset')
  ) {
    return {
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      originalError: error,
      suggestions: [
        'Network issues are often temporary - consider retrying the operation',
        'Check if AWS services are experiencing outages',
        'Verify internet connectivity and DNS resolution',
        'Consider increasing timeout values if the operation is expected to be long-running',
      ],
      recoverable: true,
      retryable: true,
      ...(context && { context }),
    };
  }

  if (
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused')
  ) {
    return {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      originalError: error,
      suggestions: [
        'Check internet connectivity and network configuration',
        'Verify that required services (AWS, GitHub API) are accessible',
        'Check for firewall or proxy restrictions',
        'Ensure DNS resolution is working correctly',
      ],
      recoverable: true,
      retryable: true,
      ...(context && { context }),
    };
  }

  // Parsing errors
  if (
    message.includes('parse') ||
    message.includes('json') ||
    message.includes('yaml') ||
    message.includes('syntax')
  ) {
    return {
      category: ErrorCategory.PARSING,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      originalError: error,
      suggestions: [
        'Check that SST CLI output format matches expected structure',
        'Verify SST CLI version compatibility with this action',
        'Review raw SST command output for unexpected format changes',
        'Check for special characters or encoding issues in output',
      ],
      recoverable: false,
      retryable: false,
      ...(context && { context }),
    };
  }

  // System and runtime errors
  if (
    message.includes('enoent') ||
    message.includes('file not found') ||
    message.includes('command not found')
  ) {
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message: error.message,
      originalError: error,
      suggestions: [
        'Ensure SST CLI is installed and available in PATH',
        'Verify that all required dependencies are installed',
        'Check that the workflow is running in the correct working directory',
        'Ensure Node.js and npm/bun are properly configured',
      ],
      recoverable: false,
      retryable: false,
      ...(context && { context }),
    };
  }

  // Default case for unknown errors
  return {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    message: error.message,
    originalError: error,
    suggestions: [
      'Check the full error message and stack trace for more details',
      'Review GitHub Actions logs for additional context',
      'Ensure all inputs and configuration are correct',
      'Contact support if the issue persists',
    ],
    recoverable: true,
    retryable: false,
    ...(context && { context }),
  };
}

/**
 * Handle validation errors specifically
 */
export function handleValidationError(error: ValidationError): void {
  core.error(`❌ Input validation failed for '${error.field}'`);
  core.error(`   Value: ${JSON.stringify(error.value)}`);
  core.error(`   Error: ${error.message}`);

  if (error.suggestions.length > 0) {
    core.info('💡 Suggestions to fix this error:');
    error.suggestions.forEach((suggestion, index) => {
      core.info(`   ${index + 1}. ${suggestion}`);
    });
  }

  // Set failed status with detailed message
  const detailedMessage = `Input validation failed for '${error.field}': ${error.message}`;
  core.setFailed(detailedMessage);
}

/**
 * Handle operational errors with recovery suggestions
 */
export function handleOperationalError(
  error: Error,
  operation: SSTOperation,
  context?: Record<string, unknown>
): void {
  const errorInfo = categorizeError(error, { ...context, operation });

  // Log structured error information
  core.error(
    `❌ ${operation} operation failed [${errorInfo.category}:${errorInfo.severity}]`
  );
  core.error(`   ${errorInfo.message}`);

  if (errorInfo.context) {
    core.debug(`Context: ${JSON.stringify(errorInfo.context, null, 2)}`);
  }

  // Log recovery suggestions
  if (errorInfo.suggestions.length > 0) {
    core.info(`💡 Suggestions to resolve this ${errorInfo.category} error:`);
    errorInfo.suggestions.forEach((suggestion, index) => {
      core.info(`   ${index + 1}. ${suggestion}`);
    });
  }

  // Indicate if error is recoverable
  if (errorInfo.recoverable) {
    core.info(
      '🔄 This error may be recoverable - consider retrying the operation'
    );
  }

  if (errorInfo.retryable) {
    core.info('⏱️  This error appears to be temporary and may resolve on retry');
  }

  // Set appropriate failure status
  const failureMessage = `${operation} operation failed: ${errorInfo.message}`;
  core.setFailed(failureMessage);
}

/**
 * Create error summary for GitHub Actions job summary
 */
export function createErrorSummary(
  error: Error,
  operation: SSTOperation,
  context?: Record<string, unknown>
): void {
  const errorInfo = categorizeError(error, context);
  const severityEmoji = {
    [ErrorSeverity.LOW]: '🟡',
    [ErrorSeverity.MEDIUM]: '🟠',
    [ErrorSeverity.HIGH]: '🔴',
    [ErrorSeverity.CRITICAL]: '🚨',
  };

  let summary = `# ❌ SST ${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed\n\n`;

  // Error overview
  summary += '| Field | Value |\n';
  summary += '|-------|-------|\n';
  summary += `| ${severityEmoji[errorInfo.severity]} Severity | ${errorInfo.severity.toUpperCase()} |\n`;
  summary += `| 🏷️ Category | ${errorInfo.category} |\n`;
  summary += `| 🔄 Recoverable | ${errorInfo.recoverable ? 'Yes' : 'No'} |\n`;
  summary += `| ⏱️ Retryable | ${errorInfo.retryable ? 'Yes' : 'No'} |\n\n`;

  // Error message
  summary += '## 🚫 Error Message\n\n';
  summary += '```\n';
  summary += errorInfo.message;
  summary += '\n```\n\n';

  // Recovery suggestions
  if (errorInfo.suggestions.length > 0) {
    summary += '## 💡 Suggested Solutions\n\n';
    errorInfo.suggestions.forEach((suggestion, index) => {
      summary += `${index + 1}. ${suggestion}\n`;
    });
    summary += '\n';
  }

  // Context information
  if (errorInfo.context) {
    summary += '## 📋 Additional Context\n\n';
    summary += '```json\n';
    summary += JSON.stringify(errorInfo.context, null, 2);
    summary += '\n```\n\n';
  }

  // Next steps
  summary += '## 🔧 Next Steps\n\n';

  if (errorInfo.retryable) {
    summary +=
      '- **Retry**: This error may be temporary. Try running the workflow again.\n';
  }

  if (errorInfo.recoverable) {
    summary +=
      '- **Review**: Check the suggestions above and update your configuration.\n';
  } else {
    summary +=
      '- **Investigation Required**: This error requires manual investigation and fixes.\n';
  }

  summary +=
    '- **Support**: If the issue persists, check the [troubleshooting guide](https://github.com/your-org/sst-operations-action/blob/main/TROUBLESHOOTING.md).\n';

  // Write summary
  core.summary.addRaw(summary).write();
}

/**
 * Safe error handling wrapper for async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: SSTOperation,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    handleOperationalError(err, operationName, context);
    throw err; // Re-throw to maintain error flow
  }
}

/**
 * Validation-specific error wrapper
 */
export function withValidationHandling<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ValidationError) {
      handleValidationError(error);
    }
    throw error;
  }
}

/**
 * Check if error indicates a temporary issue that might resolve on retry
 */
export function isTemporaryError(error: Error): boolean {
  const errorInfo = categorizeError(error);
  return (
    errorInfo.retryable ||
    errorInfo.category === ErrorCategory.NETWORK ||
    errorInfo.category === ErrorCategory.TIMEOUT
  );
}

/**
 * Check if error can potentially be recovered from
 */
export function isRecoverableError(error: Error): boolean {
  const errorInfo = categorizeError(error);
  return (
    errorInfo.recoverable &&
    errorInfo.category !== ErrorCategory.SYSTEM &&
    errorInfo.category !== ErrorCategory.AUTHENTICATION
  );
}
