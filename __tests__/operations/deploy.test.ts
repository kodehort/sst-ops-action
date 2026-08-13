/**
 * Test suite for DeployOperation
 * Tests deploy operation execution with SST CLI integration and GitHub integration
 * Covers all deployment scenarios: success, partial, failure
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubClient } from "../../src/github/client";
import type { InfrastructureInputs } from "../../src/inputs/resolve";
import { DeployOperation } from "../../src/operations/deploy";
import { DeployParser } from "../../src/parsers/deploy-parser";
import type { DeployResult } from "../../src/types";
import type { SSTCLIExecutor, SSTCommandResult } from "../../src/utils/cli";
import { SST_DEPLOY_FAILURE_OUTPUT } from "../fixtures/sst-outputs";
import { infrastructureInputs } from "../utils/resolved-inputs";

describe("Deploy Operation - SST Deployment Workflows", () => {
  let deployOperation: DeployOperation;
  let mockSSTExecutor: SSTCLIExecutor;
  let mockGitHubClient: GitHubClient;

  const mockOperationOptions: InfrastructureInputs = {
    ...infrastructureInputs("deploy"),
    commentMode: "on-success",
    failOnError: true,
    maxOutputSize: 50_000,
    stage: "staging",
    token: "ghp_test_token",
  };

  const mockCLIResult: SSTCommandResult = {
    command: "sst deploy --stage staging",
    duration: 45_000,
    exitCode: 0,
    operation: "deploy",
    output: "SST Deploy\nApp: test-app\nStage: staging\n\n✓ Complete\n",
    stage: "staging",
    stderr: "",
    stdout: "SST Deploy\nApp: test-app\nStage: staging\n\n✓ Complete\n",
    success: true,
    truncated: false,
  };

  const mockDeployResult: DeployResult = {
    app: "test-app",
    completionStatus: "complete",
    exitCode: 0,
    operation: "deploy",
    outputs: [
      { key: "API", value: "https://api.staging.example.com" },
      { key: "Web", value: "https://staging.example.com" },
    ],
    rawOutput: mockCLIResult.output,
    resourceChanges: 3,
    resources: [
      { name: "test-app-staging-handler", status: "created", type: "Function" },
      { name: "test-app-staging-api", status: "created", type: "Api" },
      { name: "test-app-staging-web", status: "created", type: "Website" },
    ],
    stage: "staging",
    success: true,
    truncated: false,
  };

  beforeEach(() => {
    // Create mock executor
    mockSSTExecutor = {
      executeSST: vi.fn(),
    } as unknown as SSTCLIExecutor;

    // Create mock GitHub client
    mockGitHubClient = {
      createOrUpdateComment: vi.fn(),
      createWorkflowSummary: vi.fn(),
      uploadArtifact: vi.fn(),
    } as unknown as GitHubClient;

    // Create operation instance with mocks
    deployOperation = new DeployOperation(mockSSTExecutor, mockGitHubClient);
  });

  describe("Operation Execution", () => {
    it("should deploy application successfully and integrate with GitHub", async () => {
      // Mock the parser
      const mockParse = vi
        .spyOn(DeployParser.prototype, "parse")
        .mockReturnValue(mockDeployResult);

      // Mock CLI execution
      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);

      // Mock GitHub integration
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Act
      const result = await deployOperation.execute(mockOperationOptions);

      // Assert
      expect(result).toEqual(mockDeployResult);

      // Verify CLI execution
      expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith(
        "deploy",
        "staging",
        {
          maxOutputSize: 50_000,
          // No longer optional: the resolver applies the default, so the CLI
          // always gets a runner.
          runner: "bun",
          timeout: 900_000,
        }
      );

      // Verify parsing
      // The size limit used to be handed to the parser, which applied the
      // same budget the CLI had already enforced. It gets the captured
      // truncation flag instead.
      expect(mockParse).toHaveBeenCalledWith(
        mockCLIResult.output,
        "staging",
        0,
        mockCLIResult.truncated
      );

      // Verify GitHub integration
      expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
        mockDeployResult,
        "on-success"
      );
      expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(
        mockDeployResult
      );
    });

    it("should propagate SST CLI execution failures", async () => {
      const cliError = new Error("SST command failed");

      vi.mocked(mockSSTExecutor.executeSST).mockRejectedValue(cliError);

      await expect(
        deployOperation.execute(mockOperationOptions)
      ).rejects.toThrow("SST command failed");
    });

    it("should continue deployment when GitHub integration fails", async () => {
      const _mockParse = vi
        .spyOn(DeployParser.prototype, "parse")
        .mockReturnValue(mockDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockRejectedValue(
        new Error("GitHub API error")
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Should still return result despite GitHub integration failure
      const result = await deployOperation.execute(mockOperationOptions);
      expect(result).toEqual(mockDeployResult);
    });

    it("should report failed deployment with error details", async () => {
      const failureCLIResult: SSTCommandResult = {
        command: "sst deploy --stage staging",
        duration: 30_000,
        exitCode: 1,
        operation: "deploy",
        output: SST_DEPLOY_FAILURE_OUTPUT,
        stage: "staging",
        stderr: "Deployment failed due to permission errors",
        stdout: SST_DEPLOY_FAILURE_OUTPUT,
        success: false,
        truncated: false,
      };

      const failureDeployResult: DeployResult = {
        app: "my-sst-app",
        completionStatus: "failed",
        error: "Deployment failed due to permission errors",
        exitCode: 1,
        operation: "deploy",
        outputs: [],
        permalink:
          "https://console.sst.dev/my-sst-app/staging/deployments/ghi789",
        rawOutput: SST_DEPLOY_FAILURE_OUTPUT,
        resourceChanges: 1,
        resources: [
          {
            name: "my-sst-app-staging-handler",
            status: "created",
            type: "Function",
          },
        ],
        stage: "staging",
        success: false,
        truncated: false,
      };

      // Mock parser to return failure result
      const _mockParse = vi
        .spyOn(DeployParser.prototype, "parse")
        .mockReturnValue(failureDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(failureCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      const result = await deployOperation.execute(mockOperationOptions);

      expect(result).toEqual(failureDeployResult);
      expect(result.success).toBe(false);
      expect(result.completionStatus).toBe("failed");
      expect(result.error).toBe("Deployment failed due to permission errors");
    });

    it("should respect user-configured comment mode settings", async () => {
      const _mockParse = vi
        .spyOn(DeployParser.prototype, "parse")
        .mockReturnValue(mockDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Test with 'always' comment mode
      const alwaysOptions = {
        ...mockOperationOptions,
        commentMode: "always" as const,
      };
      await deployOperation.execute(alwaysOptions);

      expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
        mockDeployResult,
        "always"
      );
    });

    it("should truncate large CLI outputs while preserving key information", async () => {
      const largeCLIResult: SSTCommandResult = {
        ...mockCLIResult,
        output: `${mockCLIResult.output}... output truncated`,
        truncated: true,
      };

      const truncatedDeployResult: DeployResult = {
        ...mockDeployResult,
        rawOutput: largeCLIResult.output,
        truncated: true,
      };

      const _mockParse = vi
        .spyOn(DeployParser.prototype, "parse")
        .mockReturnValue(truncatedDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(largeCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      const result = await deployOperation.execute(mockOperationOptions);

      expect(result.truncated).toBe(true);
      expect(result.rawOutput).toContain("output truncated");
    });
  });

  describe("Migration Compatibility", () => {
    it("should maintain same interface as composite action for seamless migration", async () => {
      // Verify that the operation interface matches what composite actions expect
      expect(deployOperation).toHaveProperty("execute");

      // Verify execute method signature
      expect(typeof deployOperation.execute).toBe("function");
      expect(deployOperation.execute.length).toBe(1); // Takes one parameter (options)

      // Mock successful execution
      const _mockParse = vi
        .spyOn(DeployParser.prototype, "parse")
        .mockReturnValue(mockDeployResult);

      vi.mocked(mockSSTExecutor.executeSST).mockResolvedValue(mockCLIResult);
      vi.mocked(mockGitHubClient.createOrUpdateComment).mockResolvedValue(
        undefined
      );
      vi.mocked(mockGitHubClient.createWorkflowSummary).mockResolvedValue(
        undefined
      );

      // Execute with minimal options (as composite actions might)
      const minimalOptions: InfrastructureInputs = {
        ...infrastructureInputs("deploy"),
        stage: "staging",
      };

      const result = await deployOperation.execute(minimalOptions);

      // Verify result structure matches expected format for migration compatibility
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("operation", "deploy");
      expect(result).toHaveProperty("stage", "staging");
      expect(result).toHaveProperty("app");
      expect(result).toHaveProperty("resourceChanges");
      expect(result).toHaveProperty("outputs");
      expect(result).toHaveProperty("resources");
      expect(result).toHaveProperty("completionStatus");
    });
  });
});
