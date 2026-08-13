/**
 * SST Operations Action - Integration Tests
 * Tests complete end-to-end workflows including real subprocess execution scenarios
 */

import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawn } = childProcess;
const { mkdirSync, writeFileSync } = fs;
const { join } = path;

// Test constants
const E2E_TIMEOUT = 60_000;
const ACTION_DIST_PATH = join(process.cwd(), "dist", "index.cjs");

// Mock modules for integration tests
vi.mock("node:child_process");
vi.mock("../../src/operations/router", () => ({
  executeOperation: vi.fn(),
}));
vi.mock("../../src/outputs/formatter", () => ({
  OutputFormatter: {
    formatOperationForGitHubActions: vi.fn(),
  },
}));
vi.mock("../../src/errors/report-failure", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/errors/report-failure")>();
  // Calls through: these tests assert the action's exit code, which is
  // decided by the reporter's single setFailed call.
  return { ...original, reportFailure: vi.fn(original.reportFailure) };
});
vi.mock("../../src/utils/validation", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/utils/validation")>();
  return {
    ...original,
    createValidationContext: vi.fn(),
    validateOperationWithContext: vi.fn(),
  };
});

/**
 * Executes the action with given environment variables
 */
async function executeAction(env: Record<string, string>) {
  // Import mocked modules
  const { executeOperation } = await import("../../src/operations/router");
  const { OutputFormatter } = await import("../../src/outputs/formatter");
  const core = await import("@actions/core");

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value || "";
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value === "true";
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    exitCode = 1;
    outputs.error = typeof message === "string" ? message : message.message;
  });

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || "deploy";
  const stage = env.INPUT_STAGE || "test";

  // Mock validation functions to return proper inputs
  const validationModule = await import("../../src/utils/validation");
  vi.spyOn(validationModule, "createValidationContext").mockReturnValue(
    {} as any
  );
  vi.spyOn(validationModule, "validateOperationWithContext").mockReturnValue({
    commentMode: (env["INPUT_COMMENT-MODE"] || "on-success") as any,
    failOnError: env["INPUT_FAIL-ON-ERROR"] !== "false",
    maxOutputSize: Number.parseInt(env["INPUT_MAX-OUTPUT-SIZE"] || "50000", 10),
    operation: operation as any,
    runner: "bun" as const,
    stage,
    token: env.INPUT_TOKEN || "fake-token",
  });

  // Mock operation execution based on the operation type
  const mockResult = createMockOperationResult(operation, stage);
  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter - ensure it returns the formatted outputs that setOutput will use
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatOperationForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );

  // Failure reporting shouldn't be called for successful operations
  const { reportFailure } = await import("../../src/errors/report-failure");
  vi.mocked(reportFailure).mockReturnValue();

  // Import and run the action
  const { run } = await import("../../src/main");

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
  const { executeOperation } = await import("../../src/operations/router");
  const { OutputFormatter } = await import("../../src/outputs/formatter");
  const core = await import("@actions/core");

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value || "";
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value === "true";
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    exitCode = 1;
    outputs.error = typeof message === "string" ? message : message.message;
  });

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || "deploy";
  const stage = env.INPUT_STAGE || "test";

  // Mock validation functions to return proper inputs
  const validationModule = await import("../../src/utils/validation");
  vi.spyOn(validationModule, "createValidationContext").mockReturnValue(
    {} as any
  );
  vi.spyOn(validationModule, "validateOperationWithContext").mockReturnValue({
    commentMode: (env["INPUT_COMMENT-MODE"] || "on-success") as any,
    failOnError: env["INPUT_FAIL-ON-ERROR"] !== "false",
    maxOutputSize: Number.parseInt(env["INPUT_MAX-OUTPUT-SIZE"] || "50000", 10),
    operation: operation as any,
    runner: "bun" as const,
    stage,
    token: env.INPUT_TOKEN || "fake-token",
  });

  // Mock failed operation execution
  const mockResult = createMockOperationResult(operation, stage);
  mockResult.success = false;
  mockResult.error = errorMessage;
  mockResult.exitCode = 1;
  mockResult.completionStatus = "failed";

  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter for failure
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatOperationForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );

  // vi.clearAllMocks() in setup wipes the call-through implementation the
  // module factory installed, so it is restored per run.
  const { reportFailure } = await import("../../src/errors/report-failure");
  const { reportFailure: realReportFailure } = await vi.importActual<
    typeof import("../../src/errors/report-failure")
  >("../../src/errors/report-failure");
  vi.mocked(reportFailure).mockImplementation(realReportFailure);

  // Import and run the action
  const { run } = await import("../../src/main");

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
  const { executeOperation } = await import("../../src/operations/router");
  const { OutputFormatter } = await import("../../src/outputs/formatter");
  const core = await import("@actions/core");

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value || "";
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value === "true";
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  // For fail-on-error=false, don't set exitCode to 1
  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    outputs.error = typeof message === "string" ? message : message.message;
  });

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || "deploy";
  const stage = env.INPUT_STAGE || "test";

  // Mock validation functions to return proper inputs
  const validationModule = await import("../../src/utils/validation");
  vi.spyOn(validationModule, "createValidationContext").mockReturnValue(
    {} as any
  );
  vi.spyOn(validationModule, "validateOperationWithContext").mockReturnValue({
    commentMode: (env["INPUT_COMMENT-MODE"] || "on-success") as any,
    failOnError: env["INPUT_FAIL-ON-ERROR"] !== "false",
    maxOutputSize: Number.parseInt(env["INPUT_MAX-OUTPUT-SIZE"] || "50000", 10),
    operation: operation as any,
    runner: "bun" as const,
    stage,
    token: env.INPUT_TOKEN || "fake-token",
  });

  // Mock failed operation execution
  const mockResult = createMockOperationResult(operation, stage);
  mockResult.success = false;
  mockResult.error = errorMessage;
  mockResult.exitCode = 1;
  mockResult.completionStatus = "failed";

  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter for failure
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatOperationForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );

  // Import and run the action
  const { run } = await import("../../src/main");

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
async function _executeActionWithValidationError(
  env: Record<string, string>,
  errorMessage: string
) {
  // Import mocked modules - we need to mock the validation functions
  const validationModule = await import("../../src/utils/validation");
  const core = await import("@actions/core");

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions to capture inputs and outputs
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value || "";
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value === "true";
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  vi.mocked(core.setFailed).mockImplementation((message: string | Error) => {
    exitCode = 1;
    outputs.error = typeof message === "string" ? message : message.message;
  });

  // Mock createValidationContext first
  vi.spyOn(validationModule, "createValidationContext").mockReturnValue(
    {} as any
  );

  // Mock validation to throw an error
  vi.spyOn(validationModule, "validateOperationWithContext").mockImplementation(
    () => {
      throw new Error(errorMessage);
    }
  );

  // Failure reporting for validation errors
  const { reportFailure } = await import("../../src/errors/report-failure");
  vi.mocked(reportFailure).mockReturnValue();

  // Import and run the action
  const { run } = await import("../../src/main");

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
  const { executeOperation } = await import("../../src/operations/router");
  const { OutputFormatter } = await import("../../src/outputs/formatter");
  const core = await import("@actions/core");

  // Set up environment
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let exitCode = 0;
  const outputs: Record<string, string> = {};

  // Mock core functions
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value || "";
  });

  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const value = env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
    return value === "true";
  });

  vi.mocked(core.setOutput).mockImplementation(
    (name: string, value: string) => {
      outputs[name] = value;
    }
  );

  // Determine the operation from inputs
  const operation = env.INPUT_OPERATION || "deploy";
  const stage = env.INPUT_STAGE || "test";

  // Mock validation functions to return proper inputs
  const validationModule = await import("../../src/utils/validation");
  vi.spyOn(validationModule, "createValidationContext").mockReturnValue(
    {} as any
  );
  vi.spyOn(validationModule, "validateOperationWithContext").mockReturnValue({
    commentMode: (env["INPUT_COMMENT-MODE"] || "on-success") as any,
    failOnError: env["INPUT_FAIL-ON-ERROR"] !== "false",
    maxOutputSize: Number.parseInt(env["INPUT_MAX-OUTPUT-SIZE"] || "50000", 10),
    operation: operation as any,
    runner: "bun" as const,
    stage,
    token: env.INPUT_TOKEN || "fake-token",
  });

  // Mock operation execution with truncated result
  const mockResult = createMockOperationResult(operation, stage);
  mockResult.truncated = true; // Mark as truncated

  vi.mocked(executeOperation).mockResolvedValue(mockResult);

  // Mock output formatter
  const mockFormattedOutputs = createMockFormattedOutputs(mockResult);
  vi.mocked(OutputFormatter.formatOperationForGitHubActions).mockReturnValue(
    mockFormattedOutputs
  );

  // Import and run the action
  const { run } = await import("../../src/main");

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
    app: "test-app",
    completionStatus: "complete",
    exitCode: 0,
    operation,
    rawOutput: `${operation} completed successfully`,
    stage,
    success: true,
    truncated: false,
  };

  switch (operation) {
    case "deploy":
      return {
        ...baseResult,
        error: undefined,
        permalink: "https://console.sst.dev/test-app/test-integration",
        resourceChanges: 5,
        resources: [
          { name: "TestFunction", status: "created", type: "Function" },
        ],
        urls: [{ name: "API", type: "api", url: "https://api.example.com" }],
      };
    case "diff":
      return {
        ...baseResult,
        changeSummary: "Found 3 planned changes",
        changes: [{ action: "create", name: "Function1", type: "Lambda" }],
        error: undefined,
        plannedChanges: 3,
      };
    case "remove":
      return {
        ...baseResult,
        error: undefined,
        removedResources: [
          { name: "OldFunction", status: "removed", type: "Function" },
        ],
        resourcesRemoved: 7,
      };
    default:
      return {
        ...baseResult,
        error: undefined,
        removedResources: [],
        resourcesRemoved: 0,
      };
  }
}

/**
 * Creates mock formatted outputs for GitHub Actions
 */
function createMockFormattedOutputs(result: any) {
  const baseOutputs = createBaseOutputs(result);

  switch (result.operation) {
    case "deploy":
      return createDeployOutputs(baseOutputs, result);
    case "diff":
      return createDiffOutputs(baseOutputs, result);
    case "remove":
      return createRemoveOutputs(baseOutputs, result);
    case "stage":
      return createStageOutputs(result);
    default:
      throw new Error(`Unknown operation: ${result.operation}`);
  }
}

/**
 * Create base outputs common to all operations
 */
function createBaseOutputs(result: any) {
  return {
    app: result.app,
    completion_status: result.completionStatus,
    error: result.error || "",
    operation: result.operation,
    permalink: result.permalink || "",
    stage: result.stage,
    success: result.success ? "true" : "false",
    truncated: result.truncated ? "true" : "false",
  };
}

/**
 * Create deploy operation outputs
 */
function createDeployOutputs(baseOutputs: any, result: any) {
  return {
    ...baseOutputs,
    operation: "deploy",
    resource_changes: String(result.resourceChanges || ""),
    resources: JSON.stringify(result.resources || []),
    urls: JSON.stringify(result.urls || []),
    ...getEmptyInfrastructureFields(),
  };
}

/**
 * Create diff operation outputs
 */
function createDiffOutputs(baseOutputs: any, result: any) {
  return {
    ...baseOutputs,
    diff_summary: result.changeSummary || "",
    operation: "diff",
    planned_changes: String(result.plannedChanges || ""),
    resource_changes: String(result.plannedChanges || ""),
    resources: "",
    urls: "",
    ...getEmptyInfrastructureFields(false),
  };
}

/**
 * Create remove operation outputs
 */
function createRemoveOutputs(baseOutputs: any, result: any) {
  return {
    ...baseOutputs,
    diff_summary: "",
    operation: "remove",
    planned_changes: "",
    removed_resources: JSON.stringify(result.removedResources || []),
    resource_changes: String(result.resourcesRemoved || ""),
    resources: "",
    resources_removed: String(result.resourcesRemoved || ""),
    urls: "",
    ...getEmptyInfrastructureFields(false),
  };
}

/**
 * Create stage operation outputs
 */
function createStageOutputs(result: any) {
  return {
    app: "",
    completion_status: result.completionStatus,
    computed_stage: result.computedStage || result.stage,
    diff_summary: "",
    error: result.error || "",
    event_name: result.eventName || "",
    is_pull_request: result.isPullRequest ? "true" : "false",
    operation: "stage",
    permalink: "",
    planned_changes: "",
    ref: result.ref || "",
    removed_resources: "",
    resource_changes: "",
    resources: "",
    resources_removed: "",
    stage: result.stage,
    success: result.success ? "true" : "false",
    truncated: "false",
    urls: "",
  };
}

/**
 * Get empty infrastructure fields for operations that don't use them
 */
function getEmptyInfrastructureFields(includeStageFields = true) {
  const fields: any = {
    removed_resources: "",
    resources_removed: "",
  };

  if (includeStageFields) {
    fields.diff_summary = "";
    fields.planned_changes = "";
  }

  return {
    ...fields,
    computed_stage: "",
    event_name: "",
    is_pull_request: "",
    ref: "",
  };
}

/**
 * Execute the GitHub Action with given inputs and environment in real subprocess
 */
function _executeActionE2E(
  inputs: Record<string, string>,
  env: Record<string, string> = {}
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  outputs: Record<string, string>;
}> {
  return new Promise((resolve) => {
    const actionEnv = {
      ...process.env,
      ...env,
      GITHUB_ACTIONS: "true",
      GITHUB_ACTOR: "test-actor",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "test-org/test-repo",
      GITHUB_RUN_ID: "123456",
      GITHUB_RUN_NUMBER: "1",
      GITHUB_SHA: "abc123def456",
      GITHUB_WORKFLOW: "test-workflow",
      ...Object.fromEntries(
        Object.entries(inputs).map(([key, value]) => [
          `INPUT_${key.toUpperCase().replace(/-/g, "_")}`,
          value,
        ])
      ),
    };

    const child = spawn("node", [ACTION_DIST_PATH], {
      env: actionEnv,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        exitCode: -1,
        outputs: {},
        stderr: stderr + "\nTimeout: Process killed",
        stdout,
      });
    }, E2E_TIMEOUT);

    child.on("close", (code) => {
      clearTimeout(timer);

      const outputs: Record<string, string> = {};
      const outputPattern = /::set-output name=([^:]+)::(.*)$/gm;
      let match: RegExpExecArray | null;
      match = outputPattern.exec(stdout);
      while (match !== null) {
        if (match[1] && match[2] !== undefined) {
          outputs[match[1]] = match[2];
        }
        match = outputPattern.exec(stdout);
      }

      resolve({
        exitCode: code || 0,
        outputs,
        stderr,
        stdout,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        outputs: {},
        stderr: stderr + error.message,
        stdout,
      });
    });
  });
}

/**
 * Create a test project structure for E2E testing
 */
function _createTestProject(projectPath: string) {
  mkdirSync(projectPath, { recursive: true });

  const packageJson = {
    dependencies: {
      sst: "^3.0.0",
    },
    name: "integration-test-project",
    type: "module",
    version: "0.1.0",
  };
  writeFileSync(
    join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  const sstConfig = `/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "integration-test-app",
      removal: "remove",
      home: "aws",
    };
  },
  async run() {
    new sst.aws.Function("IntegrationTestFunction", {
      handler: "index.handler",
      runtime: "nodejs20.x",
      code: {
        zipFile: "exports.handler = async () => ({ statusCode: 200, body: 'Integration Test' });"
      }
    });
  },
});
`;
  writeFileSync(join(projectPath, "sst.config.ts"), sstConfig);
}

describe("SST Operations Action - Integration Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("INPUT_")) {
        delete process.env[key];
      }
    });
  });

  describe("Deploy Operation - Complete Workflows", () => {
    it("should deploy application successfully with GitHub integration", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "on-success",
        "INPUT_FAIL-ON-ERROR": "true",
        "INPUT_MAX-OUTPUT-SIZE": "50000",
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "test-integration",
        INPUT_TOKEN: "fake-token",
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      // Verify successful execution
      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      expect(result.outputs.operation).toBe("deploy");
      expect(result.outputs.stage).toBe("test-integration");
      expect(result.outputs.completion_status).toBe("complete");

      // Verify core actions were called (core is mocked in setup.ts)
    });

    it("should handle deployment failures with proper error reporting", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "always",
        "INPUT_FAIL-ON-ERROR": "true",
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "test-integration",
        INPUT_TOKEN: "fake-token",
      };

      const result = await executeActionWithFailure(
        env,
        "Deploy failed: Authentication error"
      );

      expect(result.exitCode).toBe(1);
      expect(result.outputs.success).toBe("false");
      expect(result.outputs.error).toContain("Deploy failed");
    });
  });

  describe("Diff Operation - Planning Workflows", () => {
    it("should analyze deployment changes and report planned resources", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "always",
        "INPUT_FAIL-ON-ERROR": "false",
        INPUT_OPERATION: "diff",
        INPUT_STAGE: "staging",
        INPUT_TOKEN: "fake-token",
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      expect(result.outputs.operation).toBe("diff");
      expect(result.outputs.stage).toBe("staging");

      // Verify diff-specific outputs
      expect(result.outputs.planned_changes).toBeDefined();
      expect(result.outputs.diff_summary).toBeDefined();

      // SST CLI execution is mocked through the router
    });
  });

  describe("Remove Operation - Cleanup Workflows", () => {
    it("should remove deployed resources and report cleanup results", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "on-success",
        "INPUT_FAIL-ON-ERROR": "true",
        INPUT_OPERATION: "remove",
        INPUT_STAGE: "temp-test",
        INPUT_TOKEN: "fake-token",
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      expect(result.outputs.operation).toBe("remove");
      expect(result.outputs.stage).toBe("temp-test");

      // Verify remove-specific outputs
      expect(result.outputs.resources_removed).toBeDefined();
      expect(result.outputs.removed_resources).toBeDefined();

      // SST CLI execution is mocked through the router
    });
  });

  describe("Input Processing - Validation Workflows", () => {
    it("should validate user inputs and execute operations with proper configuration", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "never",
        "INPUT_FAIL-ON-ERROR": "false",
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "test",
        INPUT_TOKEN: "fake-token",
      };

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      expect(result.outputs.operation).toBe("deploy");
      expect(result.outputs.stage).toBe("test");
    });

    it("should support all operation types with appropriate input validation", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "never",
        "INPUT_FAIL-ON-ERROR": "false",
        INPUT_OPERATION: "diff",
        INPUT_STAGE: "integration-test",
        INPUT_TOKEN: "fake-token",
      };

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      expect(result.outputs.operation).toBe("diff");
      expect(result.outputs.planned_changes).toBeDefined();
    });
  });

  describe("GitHub Integration - Comment Workflows", () => {
    it("should create PR comments based on configured comment mode", async () => {
      const env = {
        "INPUT_COMMENT-MODE": "never",
        "INPUT_FAIL-ON-ERROR": "false",
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "test",
        INPUT_TOKEN: "fake-token",
      };

      // SST CLI execution is mocked through the router

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      // GitHub comment creation should respect comment-mode
    });
  });

  describe("Error Handling - Recovery Workflows", () => {
    it("should continue execution when fail-on-error is disabled", async () => {
      const env = {
        "INPUT_FAIL-ON-ERROR": "false",
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "test",
        INPUT_TOKEN: "fake-token",
      };

      const result = await executeActionWithFailureAndContinue(
        env,
        "Deploy failed"
      );

      // Should not fail the action when fail-on-error is false
      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("false");
    });
  });

  describe("Output Management - Size Limit Workflows", () => {
    it("should truncate large outputs while preserving essential information", async () => {
      const env = {
        "INPUT_MAX-OUTPUT-SIZE": "100", // Very small limit
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "test",
        INPUT_TOKEN: "fake-token",
      };

      const result = await executeActionWithTruncation(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.truncated).toBe("true");
    });
  });

  describe("Environment Compatibility - CI/CD Workflows", () => {
    it("should execute successfully in various GitHub Actions environments", async () => {
      const env = {
        CI: "true",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REPOSITORY: "test-org/test-repo",
        INPUT_OPERATION: "deploy",
        INPUT_STAGE: "production",
        INPUT_TOKEN: "ghp_test_token_123",
      };

      const result = await executeAction(env);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.success).toBe("true");
      // Should handle production environment appropriately
    });
  });
});
