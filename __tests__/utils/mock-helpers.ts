/**
 * Shared Mock Helpers - Common Mock Configurations
 * Reduces duplication across test files by providing standard mock setups
 */

import { vi } from 'vitest';
import type { GitHubClient } from '../../src/github/client';
import type { OperationOptions } from '../../src/types';
import type { SSTCLIExecutor } from '../../src/utils/cli';

/**
 * Standard operation options for testing
 */
export const createMockOperationOptions = (
  overrides: Partial<OperationOptions> = {}
): OperationOptions => ({
  stage: 'test',
  token: 'fake-token',
  commentMode: 'on-success',
  failOnError: true,
  maxOutputSize: 50_000,
  runner: 'bun',
  environment: {
    NODE_ENV: 'test',
    CI: 'true',
    GITHUB_ACTIONS: 'true',
  },
  ...overrides,
});

/**
 * Mock SST CLI Executor with common behaviors
 */
export const createMockSSTExecutor = (): SSTCLIExecutor => {
  const mockExecutor = {
    executeSST: vi.fn(),
  } as unknown as SSTCLIExecutor;

  // Default successful execution
  vi.mocked(mockExecutor.executeSST).mockResolvedValue({
    output: 'Mock SST execution completed',
    exitCode: 0,
    duration: 30_000,
    command: 'sst deploy --stage test',
    truncated: false,
    stdout: 'Mock SST execution completed',
    stderr: '',
    success: true,
    stage: 'test',
    operation: 'deploy',
  });

  return mockExecutor;
};

/**
 * Mock GitHub Client with common behaviors
 */
export const createMockGitHubClient = (): GitHubClient => {
  const mockClient = {
    createOrUpdateComment: vi.fn(),
    createWorkflowSummary: vi.fn(),
    uploadArtifact: vi.fn(),
  } as unknown as GitHubClient;

  // Default successful GitHub integration
  vi.mocked(mockClient.createOrUpdateComment).mockResolvedValue(undefined);
  vi.mocked(mockClient.createWorkflowSummary).mockResolvedValue(undefined);
  vi.mocked(mockClient.uploadArtifacts).mockResolvedValue(undefined);

  return mockClient;
};

/**
 * Mock GitHub Actions core module functions
 */
export const setupCoreMocks = () => {
  const mocks = {
    getInput: vi.fn(),
    getBooleanInput: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  // Set default behaviors
  mocks.getInput.mockImplementation((name: string) => {
    const defaults: Record<string, string> = {
      operation: 'deploy',
      stage: 'test',
      token: 'fake-token',
      'comment-mode': 'on-success',
      'max-output-size': '50000',
    };
    return defaults[name] || '';
  });

  mocks.getBooleanInput.mockImplementation((name: string) => {
    if (name === 'fail-on-error') {
      return true;
    }
    return false;
  });

  return mocks;
};

/**
 * Mock environment configuration for tests
 */
export const createMockEnvironment = (
  overrides: Record<string, string> = {}
): Record<string, string> => ({
  NODE_ENV: 'test',
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'test-org/test-repo',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'abc123def456',
  GITHUB_ACTOR: 'test-actor',
  GITHUB_EVENT_NAME: 'push',
  ...overrides,
});

/**
 * Setup common GitHub Actions input environment variables
 */
export const setupInputEnvironment = (
  inputs: Record<string, string>
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [
      `INPUT_${key.toUpperCase().replace(/-/g, '_')}`,
      value,
    ])
  );
};

/**
 * Mock validation module functions
 */
export const createMockValidation = () => ({
  validateOperationWithContext: vi.fn().mockReturnValue({
    operation: 'deploy',
    stage: 'test',
    token: 'fake-token',
    commentMode: 'on-success',
    failOnError: true,
    maxOutputSize: 50_000,
    runner: 'bun',
  }),
  createValidationContext: vi.fn().mockReturnValue({}),
});

/**
 * Mock error handler functions
 */
export const createMockErrorHandler = () => ({
  handleError: vi.fn().mockResolvedValue(undefined),
  createInputValidationError: vi.fn(),
  createSubprocessError: vi.fn(),
  createOutputParsingError: vi.fn(),
  fromValidationError: vi.fn(),
  isParsingError: vi.fn().mockReturnValue(false),
});

/**
 * Mock output formatter functions
 */
export const createMockOutputFormatter = () => ({
  formatOperationForGitHubActions: vi.fn().mockReturnValue({
    success: 'true',
    operation: 'deploy',
    stage: 'test',
    completion_status: 'complete',
    app: 'test-app',
    permalink: '',
    truncated: 'false',
    error: '',
    resource_changes: '0',
    urls: '[]',
    resources: '[]',
    diff_summary: '',
    planned_changes: '',
    resources_removed: '',
    removed_resources: '',
  }),
  validateOutputs: vi.fn(),
});

/**
 * Reset all mock functions - call in beforeEach
 */
export const resetAllMocks = () => {
  vi.clearAllMocks();
};

/**
 * Helper to create a full mock test suite setup
 */
export const createFullMockSetup = () => {
  const sstExecutor = createMockSSTExecutor();
  const githubClient = createMockGitHubClient();
  const operationOptions = createMockOperationOptions();
  const environment = createMockEnvironment();
  const validation = createMockValidation();
  const errorHandler = createMockErrorHandler();
  const outputFormatter = createMockOutputFormatter();

  return {
    sstExecutor,
    githubClient,
    operationOptions,
    environment,
    validation,
    errorHandler,
    outputFormatter,
    resetAll: resetAllMocks,
  };
};
