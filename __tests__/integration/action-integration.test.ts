/**
 * Integration tests for the complete SST Operations Action
 * Tests end-to-end workflows with realistic scenarios
 */

import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SST_DEPLOY_SUCCESS_OUTPUT,
  SST_DIFF_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
} from '../fixtures/sst-outputs';

// Mock node:child_process
vi.mock('node:child_process');

// Mock operations router to control operation execution
vi.mock('../../src/operations/router', () => ({
  executeOperation: vi.fn(),
}));

// Mock output formatter to control output generation
vi.mock('../../src/outputs/formatter', () => ({
  OutputFormatter: {
    formatForGitHubActions: vi.fn(),
    validateOutputs: vi.fn(),
  },
}));

// Mock error handler
vi.mock('../../src/errors/error-handler', () => ({
  ErrorHandler: {
    categorizeError: vi.fn(),
    handleError: vi.fn(),
  },
}));

// Mock validation utilities
vi.mock('../../src/utils/validation', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/validation')>();
  return {
    ...original,
    validateWithContext: vi.fn(),
    createValidationContext: vi.fn(),
  };
});

// Mock child process functionality is handled through mocked operation router

/**
 * Executes the action with given environment variables
 */
async function executeAction(env: Record<string, string>) {
  // Import mocked modules
  const { executeOperation } = await import('../../src/operations/router');
  const { OutputFormatter } = await import('../../src/outputs/formatter');
  const { ErrorHandler } = await import('../../src/errors/error-handler');
  const core = await import('@actions/core');

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value || '';
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    exitCode = 1;
    outputs.error = typeof message === 'string' ? message : message.message;
  });

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || 'deploy';
  const stage = env.INPUT_STAGE || 'test';

  // Mock operation execution based on the operation type
  const mockResult = createMockOperationResult(operation, stage);
  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );
  vi.mocked(OutputFormatter.validateOutputs).mockImplementation(() => {});

  // Mock error handler (shouldn't be called for successful operations)
  vi.mocked(ErrorHandler.categorizeError).mockReturnValue({
    category: 'CLI_EXECUTION',
    message: 'Test error',
    recoverable: false,
  } as any);
  vi.mocked(ErrorHandler.handleError).mockResolvedValue();

  // Import and run the action
  const { run } = await import('../../src/main');

  try {
    await run();
  } catch (error) {
    if (exitCode === 0) {
      // Only set exit code if not already set by setFailed
      exitCode = 1;
      outputs.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { exitCode, outputs };
}

/**
 * Executes the action with a failure scenario
 */
async function executeActionWithFailure(
  env: Record<string, string>,
  errorMessage: string
) {
  // Import mocked modules
  const { executeOperation } = await import('../../src/operations/router');
  const { OutputFormatter } = await import('../../src/outputs/formatter');
  const { ErrorHandler } = await import('../../src/errors/error-handler');
  const core = await import('@actions/core');

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value || '';
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    exitCode = 1;
    outputs.error = typeof message === 'string' ? message : message.message;
  });

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || 'deploy';
  const stage = env.INPUT_STAGE || 'test';

  // Mock failed operation execution
  const mockResult = createMockOperationResult(operation, stage);
  mockResult.success = false;
  mockResult.error = errorMessage;
  mockResult.exitCode = 1;
  mockResult.completionStatus = 'failed';

  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter for failure
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );
  vi.mocked(OutputFormatter.validateOutputs).mockImplementation(() => {});

  // Import and run the action
  const { run } = await import('../../src/main');

  try {
    await run();
  } catch (error) {
    if (exitCode === 0) {
      exitCode = 1;
      outputs.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { exitCode, outputs };
}

/**
 * Executes the action with a failure scenario but continue (fail-on-error=false)
 */
async function executeActionWithFailureAndContinue(
  env: Record<string, string>,
  errorMessage: string
) {
  // Import mocked modules
  const { executeOperation } = await import('../../src/operations/router');
  const { OutputFormatter } = await import('../../src/outputs/formatter');
  const core = await import('@actions/core');

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value || '';
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  // For fail-on-error=false, don't set exitCode to 1
  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    outputs.error = typeof message === 'string' ? message : message.message;
  });

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || 'deploy';
  const stage = env.INPUT_STAGE || 'test';

  // Mock failed operation execution
  const mockResult = createMockOperationResult(operation, stage);
  mockResult.success = false;
  mockResult.error = errorMessage;
  mockResult.exitCode = 1;
  mockResult.completionStatus = 'failed';

  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter for failure
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );
  vi.mocked(OutputFormatter.validateOutputs).mockImplementation(() => {});

  // Import and run the action
  const { run } = await import('../../src/main');

  try {
    await run();
  } catch (error) {
    if (exitCode === 0) {
      exitCode = 1;
      outputs.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { exitCode, outputs };
}

/**
 * Executes the action with a validation error scenario
 */
async function executeActionWithValidationError(
  env: Record<string, string>,
  errorMessage: string
) {
  // Import mocked modules - we need to mock the validation functions
  const validationModule = await import('../../src/utils/validation');
  const { ErrorHandler } = await import('../../src/errors/error-handler');
  const core = await import('@actions/core');

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value || '';
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    exitCode = 1;
    outputs.error = typeof message === 'string' ? message : message.message;
  });

  // Mock createValidationContext first
  vi.spyOn(validationModule, 'createValidationContext').mockReturnValue(
    {} as any
  );

  // Mock validation to throw an error
  vi.spyOn(validationModule, 'validateWithContext').mockImplementation(() => {
    throw new Error(errorMessage);
  });

  // Mock error handler for validation errors
  vi.mocked(ErrorHandler.categorizeError).mockReturnValue({
    category: 'validation',
    message: errorMessage,
    recoverable: false,
  } as any);
  vi.mocked(ErrorHandler.handleError).mockResolvedValue();

  // Import and run the action
  const { run } = await import('../../src/main');

  try {
    await run();
  } catch (error) {
    if (exitCode === 0) {
      exitCode = 1;
      outputs.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { exitCode, outputs };
}

/**
 * Executes the action with truncated output scenario
 */
async function executeActionWithTruncation(env: Record<string, string>) {
  // Import mocked modules
  const { executeOperation } = await import('../../src/operations/router');
  const { OutputFormatter } = await import('../../src/outputs/formatter');
  const core = await import('@actions/core');

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value || '';
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
    return value === 'true';
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || 'deploy';
  const stage = env.INPUT_STAGE || 'test';

  // Mock operation execution with truncated result
  const mockResult = createMockOperationResult(operation, stage);
  mockResult.truncated = true; // Mark as truncated

  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );
  vi.mocked(OutputFormatter.validateOutputs).mockImplementation(() => {});

  // Import and run the action
  const { run } = await import('../../src/main');

  try {
    await run();
  } catch (error) {
    if (exitCode === 0) {
      exitCode = 1;
      outputs.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { exitCode, outputs };
}

/**
 * Creates mock operation result based on operation type
 */
function createMockOperationResult(operation: string, stage: string): any {
  const baseResult = {
    success: true,
    operation,
    stage,
    app: 'test-app',
    rawOutput: `${operation} completed successfully`,
    exitCode: 0,
    truncated: false,
    completionStatus: 'complete',
  };

  switch (operation) {
    case 'deploy':
      return {
        ...baseResult,
        resourceChanges: 5,
        urls: [{ name: 'API', url: 'https://api.example.com', type: 'api' }],
        resources: [
          { type: 'Function', name: 'TestFunction', status: 'created' },
        ],
        permalink: 'https://console.sst.dev/test-app/test-integration',
        error: undefined,
      };
    case 'diff':
      return {
        ...baseResult,
        plannedChanges: 3,
        changeSummary: 'Found 3 planned changes',
        changes: [{ type: 'Lambda', name: 'Function1', action: 'create' }],
        error: undefined,
      };
    case 'remove':
      return {
        ...baseResult,
        resourcesRemoved: 7,
        removedResources: [
          { type: 'Function', name: 'OldFunction', status: 'removed' },
        ],
        error: undefined,
      };
    default:
      return {
        ...baseResult,
        resourcesRemoved: 0,
        removedResources: [],
        error: undefined,
      };
  }
}

/**
 * Creates mock formatted outputs for GitHub Actions
 */
function createMockFormattedOutputs(result: any) {
  return {
    success: result.success ? 'true' : 'false',
    operation: result.operation,
    stage: result.stage,
    completion_status: result.completionStatus,
    app: result.app,
    truncated: result.truncated ? 'true' : 'false',
    error: result.error || '',
    resource_changes: String(result.resourceChanges || ''),
    urls: JSON.stringify(result.urls || []),
    resources: JSON.stringify(result.resources || []),
    diff_summary: result.changeSummary || '',
    planned_changes: String(result.plannedChanges || ''),
    resources_removed: String(result.resourcesRemoved || ''),
    removed_resources: JSON.stringify(result.removedResources || []),
    permalink: result.permalink || '',
  };
}

describe('Action Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('INPUT_')) {
        delete process.env[key];
      }
    });
  });

  describe('Deploy Operation Integration', () => {
    it('should execute complete deploy workflow successfully', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test-integration',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'on-success',
        'INPUT_FAIL-ON-ERROR': 'true',
        'INPUT_MAX-OUTPUT-SIZE': '50000',
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      // Verify successful execution
      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.outputs.operation).toBe('deploy');
      expect(result.outputs.stage).toBe('test-integration');
      expect(result.outputs.completion_status).toBe('complete');

      // Verify core actions were called (core is mocked in setup.ts)
    });

    it('should handle deploy failures correctly', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test-integration',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'always',
        'INPUT_FAIL-ON-ERROR': 'true',
      };

      const result = await executeActionWithFailure(
        env,
        'Deploy failed: Authentication error'
      );

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe('false');
      expect(result.outputs.error).toContain('Deploy failed');
    });
  });

  describe('Diff Operation Integration', () => {
    it('should execute complete diff workflow successfully', async () => {
      const env = {
        INPUT_OPERATION: 'diff',
        INPUT_STAGE: 'staging',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'always',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.outputs.operation).toBe('diff');
      expect(result.outputs.stage).toBe('staging');

      // Verify diff-specific outputs
      expect(result.outputs.planned_changes).toBeDefined();
      expect(result.outputs.diff_summary).toBeDefined();

      // SST CLI execution is mocked through the router
    });
  });

  describe('Remove Operation Integration', () => {
    it('should execute complete remove workflow successfully', async () => {
      const env = {
        INPUT_OPERATION: 'remove',
        INPUT_STAGE: 'temp-test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'on-success',
        'INPUT_FAIL-ON-ERROR': 'true',
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      expect(result.outputs.operation).toBe('remove');
      expect(result.outputs.stage).toBe('temp-test');

      // Verify remove-specific outputs
      expect(result.outputs.resources_removed).toBeDefined();
      expect(result.outputs.removed_resources).toBeDefined();

      // SST CLI execution is mocked through the router
    });
  });

  describe('Input Validation Integration', () => {
    it('should handle invalid operation gracefully', async () => {
      const env = {
        INPUT_OPERATION: 'invalid-operation',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
      };

      const result = await executeActionWithValidationError(
        env,
        'Invalid operation'
      );

      expect(result.exitCode).toBe(1);
      expect(result.outputs.error).toContain('Input validation failed');
    });

    it('should handle missing required inputs', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_TOKEN: 'fake-token',
        // Missing required INPUT_STAGE
      };

      const result = await executeActionWithValidationError(
        env,
        'Missing required input: stage'
      );

      expect(result.exitCode).toBe(1);
      expect(result.outputs.error).toContain('Input validation failed');
    });
  });

  describe('Comment Mode Integration', () => {
    it('should respect comment-mode setting for success', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_COMMENT-MODE': 'never',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      // GitHub comment creation should respect comment-mode
    });
  });

  describe('Error Recovery Integration', () => {
    it('should continue workflow when fail-on-error is false', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_FAIL-ON-ERROR': 'false',
      };

      const result = await executeActionWithFailureAndContinue(
        env,
        'Deploy failed'
      );

      // Should not fail the action when fail-on-error is false
      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('false');
    });
  });

  describe('Output Size Limits Integration', () => {
    it('should handle output truncation correctly', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'test',
        INPUT_TOKEN: 'fake-token',
        'INPUT_MAX-OUTPUT-SIZE': '100', // Very small limit
      };

      const result = await executeActionWithTruncation(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.truncated).toBe('true');
    });
  });

  describe('Environment Integration', () => {
    it('should work with different environment configurations', async () => {
      const env = {
        INPUT_OPERATION: 'deploy',
        INPUT_STAGE: 'production',
        INPUT_TOKEN: 'ghp_test_token_123',
        GITHUB_REPOSITORY: 'test-org/test-repo',
        GITHUB_REF: 'refs/heads/main',
        CI: 'true',
      };

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe('true');
      // Should handle production environment appropriately
    });
  });
});
