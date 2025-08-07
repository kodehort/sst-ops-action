/**
 * Error categories and classification system for SST operations
 * Provides specific categorization for different failure modes
 */

/**
 * Comprehensive error categories for SST operations
 */
export const ERROR_CATEGORY_VALUES = [
  'cli_execution',
  'output_parsing',
  'github_api',
  'validation',
  'timeout',
  'permissions',
  'network',
  'authentication',
  'resource_conflict',
  'quota_exceeded',
  'configuration',
  'system'
] as const;

export type ErrorCategory = typeof ERROR_CATEGORY_VALUES[number];

/**
 * Error severity levels for prioritization
 */
export const ERROR_SEVERITY_VALUES = [
  'low',
  'medium',
  'high',
  'critical'
] as const;

export type ErrorSeverity = typeof ERROR_SEVERITY_VALUES[number];

/**
 * Error recovery strategies
 */
export const RECOVERY_STRATEGY_VALUES = [
  'retry',
  'manual_intervention',
  'configuration_update',
  'not_recoverable'
] as const;

export type RecoveryStrategy = typeof RECOVERY_STRATEGY_VALUES[number];

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
    category: 'authentication',
    severity: 'high',
    getSuggestions: () => [
      'Configure AWS credentials using AWS CLI or environment variables',
      'Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set',
      'Check AWS_SESSION_TOKEN if using temporary credentials',
      'Ensure AWS profile is correctly configured',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: 'configuration_update',
  },

  // Permissions Errors (check before generic CLI errors)
  {
    patterns: [
      /access.*denied/i,
      /permission.*denied/i,
      /insufficient.*permissions/i,
      /forbidden/i,
      /not authorized/i,
      /unauthorized/i,
      /s3:.*permission/i,
      /cloudformation.*permission/i,
      /iam.*permission/i,
    ],
    category: 'permissions',
    severity: 'high',
    getSuggestions: () => [
      'Check AWS IAM permissions for the user/role',
      'Verify GitHub token has necessary repository permissions',
      'Review CloudFormation stack permissions',
      'Check S3 bucket permissions and policies',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: 'configuration_update',
  },

  // CLI Execution Errors (more general patterns)
  {
    patterns: [
      /sst: command not found/i,
      /sst.*not found/i,
      /command.*sst.*not found/i,
    ],
    category: 'cli_execution',
    severity: 'critical',
    getSuggestions: () => [
      'Ensure SST CLI is installed: npm install -g @serverless-stack/cli',
      'Check that PATH environment variable includes node_modules/.bin',
      'Verify Node.js version compatibility (Node 18+ recommended)',
      'Try installing SST CLI locally: npm install @serverless-stack/cli',
    ],
    recoverable: false,
    retryable: false,
    recoveryStrategy: 'configuration_update',
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
    category: 'cli_execution',
    severity: 'high',
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
    recoveryStrategy: 'manual_intervention',
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
    category: 'output_parsing',
    severity: 'low',
    getSuggestions: () => [
      'Check SST CLI version compatibility with this action',
      'Verify that SST command completed successfully',
      'Review raw output logs for formatting issues',
      'Report parsing issue if SST CLI format has changed',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: 'manual_intervention',
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
    category: 'github_api',
    severity: 'medium',
    getSuggestions: () => [
      'GitHub API rate limit exceeded - wait and retry',
      'Consider using a GitHub App token for higher rate limits',
      'Distribute API calls across multiple tokens if applicable',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: 'retry',
  },

  // Timeout Errors
  {
    patterns: [/timeout/i, /timed out/i, /etimedout/i],
    category: 'timeout',
    severity: 'medium',
    getSuggestions: () => [
      'Operation timed out - consider retrying',
      'Increase timeout values for long-running operations',
      'Check network connectivity and service availability',
      'Break down large operations into smaller chunks',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: 'retry',
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
    category: 'network',
    severity: 'medium',
    getSuggestions: () => [
      'Check internet connectivity',
      'Verify DNS resolution for required services',
      'Check for firewall or proxy restrictions',
      'Confirm AWS services are accessible from current location',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: 'retry',
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
    category: 'resource_conflict',
    severity: 'medium',
    getSuggestions: () => [
      'Check for existing resources with the same name',
      'Consider using different resource names or stages',
      'Review CloudFormation stack for conflicts',
      'Use SST diff to preview changes before deployment',
    ],
    recoverable: true,
    retryable: false,
    recoveryStrategy: 'configuration_update',
  },

  // Quota Exceeded
  {
    patterns: [/quota.*exceeded/i, /limit.*exceeded/i, /too many.*requests/i],
    category: 'quota_exceeded',
    severity: 'high',
    getSuggestions: () => [
      'AWS service quota exceeded - request limit increase',
      'Clean up unused resources to free quota',
      'Consider using different AWS regions for resource distribution',
      'Review AWS Service Quotas console for current limits',
    ],
    recoverable: true,
    retryable: true,
    recoveryStrategy: 'manual_intervention',
  },

  // Configuration Errors
  {
    patterns: [
      /configuration.*error/i,
      /invalid.*configuration/i,
      /sst\.config/i,
    ],
    category: 'configuration',
    severity: 'high',
    getSuggestions: () => [
      'Review SST configuration file (sst.config.ts/js)',
      'Check for syntax errors in configuration',
      'Verify all required configuration properties are set',
      'Ensure configuration matches the current SST version requirements',
    ],
    recoverable: false,
    retryable: false,
    recoveryStrategy: 'configuration_update',
  },

  // System Resource Exhaustion
  {
    patterns: [
      /out of memory/i,
      /memory exhausted/i,
      /system memory exhausted/i,
      /cannot allocate memory/i,
      /disk.*full/i,
      /no space left/i,
      /resource.*exhausted/i,
    ],
    category: 'system',
    severity: 'critical',
    getSuggestions: () => [
      'System resources exhausted - increase available memory or disk space',
      'Consider using a larger instance type or increasing resource limits',
      'Clean up temporary files and unused resources',
      'Contact system administrator for resource allocation',
    ],
    recoverable: false,
    retryable: false,
    recoveryStrategy: 'not_recoverable',
  },
];
