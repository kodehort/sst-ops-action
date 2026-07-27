/**
 * Shared Mock Helpers - Common Mock Configurations
 * Reduces duplication across test files by providing standard mock setups
 */

import { vi } from "vitest";
import type { GitHubClient } from "../../src/github/client";
import type { OperationOptions } from "../../src/types";
import type { SSTCLIExecutor } from "../../src/utils/cli";

/**
 * Standard operation options for testing
 */
export const createMockOperationOptions = (
  overrides: Partial<OperationOptions> = {}
): OperationOptions => ({
  commentMode: "on-success",
  failOnError: true,
  maxOutputSize: 50_000,
  runner: "bun",
  stage: "test",
  token: "fake-token",
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
    command: "sst deploy --stage test",
    duration: 30_000,
    exitCode: 0,
    operation: "deploy",
    output: "Mock SST execution completed",
    stage: "test",
    stderr: "",
    stdout: "Mock SST execution completed",
    success: true,
    truncated: false,
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
    debug: vi.fn(),
    error: vi.fn(),
    getBooleanInput: vi.fn(),
    getInput: vi.fn(),
    info: vi.fn(),
    setFailed: vi.fn(),
    setOutput: vi.fn(),
    warning: vi.fn(),
  };

  // Set default behaviors
  mocks.getInput.mockImplementation((name: string) => {
    const defaults: Record<string, string> = {
      "comment-mode": "on-success",
      "max-output-size": "50000",
      operation: "deploy",
      stage: "test",
      token: "fake-token",
    };
    return defaults[name] || "";
  });

  mocks.getBooleanInput.mockImplementation((name: string) => {
    if (name === "fail-on-error") {
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
  CI: "true",
  GITHUB_ACTIONS: "true",
  GITHUB_ACTOR: "test-actor",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "test-org/test-repo",
  GITHUB_SHA: "abc123def456",
  NODE_ENV: "test",
  ...overrides,
});

/**
 * Setup common GitHub Actions input environment variables
 */
export const setupInputEnvironment = (
  inputs: Record<string, string>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [
      `INPUT_${key.toUpperCase().replace(/-/g, "_")}`,
      value,
    ])
  );

/**
 * Mock validation module functions
 */
export const createMockValidation = () => ({
  createValidationContext: vi.fn().mockReturnValue({}),
  validateOperationWithContext: vi.fn().mockReturnValue({
    commentMode: "on-success",
    failOnError: true,
    maxOutputSize: 50_000,
    operation: "deploy",
    runner: "bun",
    stage: "test",
    token: "fake-token",
  }),
});

/**
 * Mock error handler functions
 */
export const createMockErrorHandler = () => ({
  createInputValidationError: vi.fn(),
  createOutputParsingError: vi.fn(),
  createSubprocessError: vi.fn(),
  fromValidationError: vi.fn(),
  handleError: vi.fn().mockResolvedValue(undefined),
  isParsingError: vi.fn().mockReturnValue(false),
});

/**
 * Mock output formatter functions
 */
export const createMockOutputFormatter = () => ({
  formatOperationForGitHubActions: vi.fn().mockReturnValue({
    app: "test-app",
    completion_status: "complete",
    diff_summary: "",
    error: "",
    operation: "deploy",
    permalink: "",
    planned_changes: "",
    removed_resources: "",
    resource_changes: "0",
    resources: "[]",
    resources_removed: "",
    stage: "test",
    success: "true",
    truncated: "false",
    urls: "[]",
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
    environment,
    errorHandler,
    githubClient,
    operationOptions,
    outputFormatter,
    resetAll: resetAllMocks,
    sstExecutor,
    validation,
  };
};
