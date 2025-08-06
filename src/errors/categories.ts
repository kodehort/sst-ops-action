/**
 * Error categories and classification system for SST operations
 * Provides specific categorization for different failure modes
 */

/**
 * Comprehensive error categories for SST operations
 */
export enum ErrorCategory {
  CLI_EXECUTION = 'cli_execution',
  OUTPUT_PARSING = 'output_parsing',
  GITHUB_API = 'github_api',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  PERMISSIONS = 'permissions',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  RESOURCE_CONFLICT = 'resource_conflict',
  QUOTA_EXCEEDED = 'quota_exceeded',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
}

/**
 * Error severity levels for prioritization
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  MANUAL_INTERVENTION = 'manual_intervention',
  CONFIGURATION_UPDATE = 'configuration_update',
  NOT_RECOVERABLE = 'not_recoverable',
}

/**
 * Comprehensive error information structure
 */
export interface ActionError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
  recoveryStrategy: RecoveryStrategy;
  debugInfo?: {
    operation?: string;
    stage?: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    duration?: number;
  };
  context?: Record<string, unknown>;
}

/**
 * Error pattern matchers for categorization
 */
export interface ErrorPattern {
  patterns: RegExp[];
  category: ErrorCategory;
  severity: ErrorSeverity;
  getSuggestions: (error: Error) => string[];
  recoverable: boolean;
  retryable: boolean;
  recoveryStrategy: RecoveryStrategy;
}

/**
 * Predefined error patterns for common SST operation failures
 * Order matters: more specific patterns should come first
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  // Authentication Errors (check first before generic CLI errors)
  {
    patterns: [
      /aws credentials/i,
      /aws access key/i,
      /invalid.*credentials/i,
      /unable to locate credentials/i,
      /credential.*provider.*error/i,
      /the aws access key id you provided does not exist/i,
      /aws.*not.*configured/i,
      /authentication.*error/i,
      /credentials.*not.*found/i,
    ],
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
    getSuggestions: () => [
      'Configure AWS credentials using AWS CLI or environment variables',
      'Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set',
      'Check AWS_SESSION_TOKEN if using temporary credentials',
      'Ensure AWS profile is correctly configured',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
  },

  // Permissions Errors (check before generic CLI errors)
  {
    patterns: [
      /access.*denied/i,
      /permission.*denied/i,
      /insufficient.*permissions/i,
      /forbidden.*access/i,
      /not authorized/i,
      /unauthorized/i,
      /s3:.*permission/i,
      /cloudformation.*permission/i,
      /iam.*permission/i,
    ],
    category: ErrorCategory.PERMISSIONS,
    severity: ErrorSeverity.HIGH,
    getSuggestions: () => [
      'Check AWS IAM permissions for the user/role',
      'Verify GitHub token has necessary repository permissions',
      'Review CloudFormation stack permissions',
      'Check S3 bucket permissions and policies',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
  },

  // CLI Execution Errors (more general patterns)
  {
    patterns: [
      /sst: command not found/i,
      /sst.*not found/i,
      /command.*sst.*not found/i,
    ],
    category: ErrorCategory.CLI_EXECUTION,
    severity: ErrorSeverity.CRITICAL,
    getSuggestions: () => [
      'Ensure SST CLI is installed: npm install -g @serverless-stack/cli',
      'Check that PATH environment variable includes node_modules/.bin',
      'Verify Node.js version compatibility (Node 18+ recommended)',
      'Try installing SST CLI locally: npm install @serverless-stack/cli',
    ],
    recoverable: false,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
  },
  {
    patterns: [
      /sst.*exited with code/i,
      /sst.*command failed/i,
      /deploy.*failed/i,
      /command.*failed/i,
      /exit code \d+/i,
      /process exited with code/i,
      /command not found/i,
      /execution.*failed/i,
    ],
    category: ErrorCategory.CLI_EXECUTION,
    severity: ErrorSeverity.HIGH,
    getSuggestions: (error) => {
      const suggestions = [
        'Review the SST CLI error output for specific failure details',
        'Check AWS credentials and permissions',
        'Verify SST configuration files (sst.config.ts/js)',
      ];

      if (error.message.includes('timeout')) {
        suggestions.push(
          'Consider increasing timeout values for long-running deployments'
        );
      }

      return suggestions;
    },
    recoverable: true,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
  },

  // Output Parsing Errors
  {
    patterns: [
      /failed to parse.*output/i,
      /unexpected.*format/i,
      /json.*parse.*error/i,
      /invalid.*json/i,
      /parse.*error/i,
      /malformed.*output/i,
    ],
    category: ErrorCategory.OUTPUT_PARSING,
    severity: ErrorSeverity.LOW,
    getSuggestions: () => [
      'Check SST CLI version compatibility with this action',
      'Verify that SST command completed successfully',
      'Review raw output logs for formatting issues',
      'Report parsing issue if SST CLI format has changed',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
  },

  // GitHub API Errors
  {
    patterns: [
      /github.*api.*error/i,
      /rate limit.*exceeded/i,
      /api rate limit/i,
      /github.*token/i,
      /secondary.*rate.*limit/i,
    ],
    category: ErrorCategory.GITHUB_API,
    severity: ErrorSeverity.MEDIUM,
    getSuggestions: () => [
      'GitHub API rate limit exceeded - wait and retry',
      'Consider using a GitHub App token for higher rate limits',
      'Distribute API calls across multiple tokens if applicable',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: RecoveryStrategy.RETRY,
  },

  // Timeout Errors
  {
    patterns: [/timeout/i, /timed out/i, /etimedout/i],
    category: ErrorCategory.TIMEOUT,
    severity: ErrorSeverity.MEDIUM,
    getSuggestions: () => [
      'Operation timed out - consider retrying',
      'Increase timeout values for long-running operations',
      'Check network connectivity and service availability',
      'Break down large operations into smaller chunks',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: RecoveryStrategy.RETRY,
  },

  // Network Errors
  {
    patterns: [
      /network.*error/i,
      /connection.*refused/i,
      /econnrefused/i,
      /enotfound/i,
      /connection.*reset/i,
      /network.*timeout/i,
      /dns.*resolution.*failed/i,
      /connection.*failed/i,
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    getSuggestions: () => [
      'Check internet connectivity',
      'Verify DNS resolution for required services',
      'Check for firewall or proxy restrictions',
      'Confirm AWS services are accessible from current location',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: RecoveryStrategy.RETRY,
  },

  // Resource Conflicts
  {
    patterns: [
      /resource.*already exists/i,
      /conflict.*resource/i,
      /duplicate.*resource/i,
      /already exists/i,
      /conflicting.*resource/i,
      /resource.*conflict/i,
    ],
    category: ErrorCategory.RESOURCE_CONFLICT,
    severity: ErrorSeverity.MEDIUM,
    getSuggestions: () => [
      'Check for existing resources with the same name',
      'Consider using different resource names or stages',
      'Review CloudFormation stack for conflicts',
      'Use SST diff to preview changes before deployment',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
  },

  // Quota Exceeded
  {
    patterns: [/quota.*exceeded/i, /limit.*exceeded/i, /too many.*requests/i],
    category: ErrorCategory.QUOTA_EXCEEDED,
    severity: ErrorSeverity.HIGH,
    getSuggestions: () => [
      'AWS service quota exceeded - request limit increase',
      'Clean up unused resources to free quota',
      'Consider using different AWS regions for resource distribution',
      'Review AWS Service Quotas console for current limits',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
  },

  // Configuration Errors
  {
    patterns: [
      /configuration.*error/i,
      /invalid.*configuration/i,
      /sst\.config/i,
    ],
    category: ErrorCategory.CONFIGURATION,
    severity: ErrorSeverity.HIGH,
    getSuggestions: () => [
      'Review SST configuration file (sst.config.ts/js)',
      'Check for syntax errors in configuration',
      'Verify all required configuration properties are set',
      'Ensure configuration matches the current SST version requirements',
    ],
    recoverable: false,
    retryable: false,
    recoveryStrategy: RecoveryStrategy.CONFIGURATION_UPDATE,
  },
];
