import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the classes needed for the router
vi.mock("@/github/client");
vi.mock("@/utils/cli");

import { GitHubClient } from "@/github/client";
import { OperationFactory } from "@/operations/factory";
import { executeOperation } from "@/operations/router";
import type {
  DeployResult,
  DiffResult,
  OperationOptions,
  RemoveResult,
} from "@/types";
import { SSTCLIExecutor } from "@/utils/cli";

describe("OperationRouter", () => {
  let mockOperation: {
    execute: ReturnType<typeof vi.fn>;
  };

  const defaultOptions: OperationOptions = {
    commentMode: "on-success",
    failOnError: true,
    maxOutputSize: 50_000,
    runner: "bun",
    stage: "test-stage",
    token: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock operation
    mockOperation = {
      execute: vi.fn(),
    };

    // Mock OperationFactory methods
    vi.spyOn(OperationFactory.prototype, "createOperation").mockReturnValue(
      mockOperation as any
    );
    vi.spyOn(OperationFactory, "isValidOperationType").mockReturnValue(true);
    vi.spyOn(OperationFactory, "getSupportedOperations").mockReturnValue([
      "deploy",
      "diff",
      "remove",
      "stage",
    ]);

    // Mock GitHubClient and SSTCLIExecutor constructors
    // Vitest v4 requires function/class for constructor mocks (not arrow functions)
    vi.mocked(GitHubClient).mockImplementation(function (this: any) {
      this.commentOnPR = vi.fn();
      this.updateWorkflowSummary = vi.fn();
    } as any);

    vi.mocked(SSTCLIExecutor).mockImplementation(function (this: any) {
      this.execute = vi.fn();
    } as any);
  });

  describe("executeOperation", () => {
    it("should validate operation type before execution", async () => {
      // Invalid operations should now throw during error result creation
      await expect(
        executeOperation("invalid" as any, defaultOptions)
      ).rejects.toThrow(
        "Cannot create error result for unknown operation: invalid"
      );
    });

    it("should handle deploy operation successfully", async () => {
      const mockDeployResult = {
        metadata: {
          app: "test-app",
          cliExitCode: 0,
          rawOutput: "Deploy successful",
          truncated: false,
        },
        outputs: [
          { key: "api", value: "https://api.example.com" },
          { key: "web", value: "https://web.example.com" },
        ],
        permalink: "https://console.sst.dev/deploy/123",
        resourceChanges: 3,
        resources: [
          {
            name: "handler",
            status: "created",
            timing: "2s",
            type: "function",
          },
        ],
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation("deploy", defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("deploy");
      expect((result as DeployResult).resourceChanges).toBe(3);
      expect((result as DeployResult).outputs).toHaveLength(2);
      expect((result as DeployResult).resources).toHaveLength(1);
      expect((result as DeployResult).permalink).toBe(
        "https://console.sst.dev/deploy/123"
      );
    });

    it("should handle diff operation successfully", async () => {
      const mockDiffResult = {
        changes: [
          {
            action: "create",
            details: "New Lambda function",
            name: "handler",
            type: "function",
          },
        ],
        changesDetected: 2,
        metadata: {
          app: "test-app",
          cliExitCode: 0,
          rawOutput: "Diff completed",
          truncated: false,
        },
        stage: "test-stage",
        success: true,
        summary: "Infrastructure changes detected",
      };

      mockOperation.execute.mockResolvedValue(mockDiffResult);

      const result = await executeOperation("diff", defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("diff");
      expect((result as DiffResult).plannedChanges).toBe(2);
      expect((result as DiffResult).changeSummary).toBe(
        "Infrastructure changes detected"
      );
      expect((result as DiffResult).changes).toHaveLength(1);
    });

    it("should handle remove operation successfully", async () => {
      const mockRemoveResult = {
        completionStatus: "complete" as const,
        metadata: {
          app: "test-app",
          cliExitCode: 0,
          rawOutput: "Remove completed",
          truncated: false,
        },
        removedResources: [
          {
            name: "handler",
            status: "removed",
            type: "function",
          },
        ],
        resourcesRemoved: 5,
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockRemoveResult);

      const result = await executeOperation("remove", defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("remove");
      expect((result as RemoveResult).resourcesRemoved).toBe(5);
      expect((result as RemoveResult).removedResources).toHaveLength(1);
    });

    it("should handle stage operation successfully", async () => {
      const mockStageResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        computedStage: "pr-123",
        eventName: "pull_request",
        exitCode: 0,
        isPullRequest: true,
        operation: "stage" as const,
        rawOutput: "",
        ref: "refs/heads/feature-branch",
        stage: "test-stage",
        success: true,
        truncated: false,
      };

      mockOperation.execute.mockResolvedValue(mockStageResult);

      const result = await executeOperation("stage", defaultOptions);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("stage");
      expect(result).toEqual(mockStageResult);
    });

    it("should handle operation execution errors", async () => {
      const mockError = new Error("Operation failed");
      mockOperation.execute.mockRejectedValue(mockError);

      const result = await executeOperation("deploy", defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Operation failed");
      expect(result.operation).toBe("deploy");
      expect(result.stage).toBe("test-stage");
    });

    it("should normalize URL types correctly", async () => {
      const mockDeployResult = {
        metadata: { app: "test-app" },
        outputs: [
          { key: "valid-api", value: "https://api.example.com" },
          { key: "invalid-type", value: "https://custom.example.com" },
        ],
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation("deploy", defaultOptions);

      const deployResult = result as DeployResult;
      expect(deployResult.outputs?.[0]?.key).toBe("valid-api");
      expect(deployResult.outputs?.[1]?.key).toBe("invalid-type");
    });

    it("should normalize resource status correctly", async () => {
      const mockDeployResult = {
        metadata: { app: "test-app" },
        resources: [
          { name: "valid", status: "created", type: "function" },
          { name: "invalid", status: "invalid-status", type: "function" },
        ],
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation("deploy", defaultOptions);

      const deployResult = result as DeployResult;
      expect(deployResult.resources?.[0]?.status).toBe("created");
      expect(deployResult.resources?.[1]?.status).toBe("created"); // Should normalize to 'created'
    });

    it("should normalize diff actions correctly", async () => {
      const mockDiffResult = {
        changes: [
          { action: "create", name: "valid", type: "function" },
          {
            action: "modify",
            name: "invalid",
            type: "function",
          },
        ],
        metadata: { app: "test-app" },
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockDiffResult);

      const result = await executeOperation("diff", defaultOptions);

      const diffResult = result as DiffResult;
      expect(diffResult.changes?.[0]?.action).toBe("create");
      expect(diffResult.changes?.[1]?.action).toBe("update"); // Should normalize to 'update'
    });

    it("should normalize remove status correctly", async () => {
      const mockRemoveResult = {
        metadata: { app: "test-app" },
        removedResources: [
          {
            name: "valid",
            status: "removed",
            type: "function",
          },
          {
            name: "invalid",
            status: "invalid-status",
            type: "function",
          },
        ],
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockRemoveResult);

      const result = await executeOperation("remove", defaultOptions);

      const removeResult = result as RemoveResult;
      expect(removeResult.removedResources?.[0]?.status).toBe("removed");
      expect(removeResult.removedResources?.[1]?.status).toBe("failed"); // Should normalize to 'failed'
    });

    it("should handle missing optional fields gracefully", async () => {
      const mockDeployResult = {
        stage: "test-stage",
        success: true,
        // Missing metadata, urls, resources
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation("deploy", defaultOptions);

      expect(result.success).toBe(true);
      expect((result as DeployResult).app).toBe("unknown");
      expect((result as DeployResult).rawOutput).toBe("");
      expect((result as DeployResult).exitCode).toBe(0);
      expect((result as DeployResult).resourceChanges).toBe(0);
      expect((result as DeployResult).outputs).toEqual([]);
      expect((result as DeployResult).resources).toEqual([]);
    });

    it("should use fake token for stage operations", async () => {
      const mockStageResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        computedStage: "main",
        eventName: "push",
        exitCode: 0,
        isPullRequest: false,
        operation: "stage" as const,
        rawOutput: "",
        ref: "refs/heads/main",
        stage: "test-stage",
        success: true,
        truncated: false,
      };

      mockOperation.execute.mockResolvedValue(mockStageResult);

      await executeOperation("stage", defaultOptions);

      expect(GitHubClient).toHaveBeenCalledWith("fake-token");
    });

    it("should create failure result for unknown operation type", async () => {
      // Unknown operations should now throw during error result creation
      await expect(
        executeOperation("unknown" as any, defaultOptions)
      ).rejects.toThrow(
        "Cannot create error result for unknown operation: unknown"
      );
    });

    it("should preserve optional fields when present", async () => {
      const mockDeployResult = {
        error: "Warning message",
        metadata: {
          app: "test-app",
          cliExitCode: 0,
          rawOutput: "Deploy output",
          truncated: true,
        },
        outputs: [
          {
            key: "api",
            value: "https://api.example.com",
          },
        ],
        permalink: "https://console.sst.dev/123",
        resources: [
          {
            name: "handler",
            status: "updated",
            timing: "3s",
            type: "function",
          },
        ],
        stage: "test-stage",
        success: true,
      };

      mockOperation.execute.mockResolvedValue(mockDeployResult);

      const result = await executeOperation("deploy", defaultOptions);

      expect(result.success).toBe(true);
      expect((result as DeployResult).error).toBe("Warning message");
      expect((result as DeployResult).permalink).toBe(
        "https://console.sst.dev/123"
      );
      expect((result as DeployResult).truncated).toBe(true);
      const deployResult = result as DeployResult;
      expect(deployResult.resources?.[0]?.timing).toBe("3s");
    });
  });
});
