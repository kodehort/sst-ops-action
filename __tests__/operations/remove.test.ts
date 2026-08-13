/**
 * Tests for RemoveOperation
 * Validates remove operation execution, parsing, and GitHub integration
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";
import type { GitHubClient } from "../../src/github/client";
import type { InfrastructureInputs } from "../../src/inputs/resolve";
import { RemoveOperation } from "../../src/operations/remove";
import type { RemoveResult } from "../../src/types";
import type { SSTCLIExecutor, SSTCommandResult } from "../../src/utils/cli";
import {
  SST_REMOVE_ERROR_OUTPUT,
  SST_REMOVE_MALFORMED_OUTPUT,
  SST_REMOVE_NO_RESOURCES_OUTPUT,
  SST_REMOVE_PARTIAL_WITH_FAILURES_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
  SST_REMOVE_SUCCESS_WITH_DETAILS_OUTPUT,
} from "../fixtures/sst-outputs";
import { infrastructureInputs } from "../utils/resolved-inputs";

describe("RemoveOperation", () => {
  let removeOperation: RemoveOperation;
  let mockSSTExecutor: SSTCLIExecutor;
  let mockGitHubClient: GitHubClient;

  const defaultOptions: InfrastructureInputs = {
    ...infrastructureInputs("remove"),
    commentMode: "on-success",
    failOnError: true,
    maxOutputSize: 50_000,
    stage: "test-stage",
    token: "fake-token",
  };

  beforeEach(() => {
    // Mock SST CLI Executor
    mockSSTExecutor = {
      executeSST: vi.fn(),
    } as unknown as SSTCLIExecutor;

    // Mock GitHub Client
    mockGitHubClient = {
      createOrUpdateComment: vi.fn().mockResolvedValue(undefined),
      createWorkflowSummary: vi.fn().mockResolvedValue(undefined),
    } as unknown as GitHubClient;

    removeOperation = new RemoveOperation(mockSSTExecutor, mockGitHubClient);
  });

  describe("execute", () => {
    it("should handle successful removal", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 30_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_SUCCESS_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_SUCCESS_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result: RemoveResult =
        await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe("remove");
      expect(result.stage).toBe("test-stage");
      expect(result.resourcesRemoved).toBe(3);
      expect(result.completionStatus).toBe("complete");
      expect(result.app).toBe("my-sst-app");
      expect(result.permalink).toContain("console.sst.dev");
      expect(result.removedResources).toHaveLength(3);
      expect(result.removedResources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "my-sst-app-staging-handler",
            status: "removed",
            type: "Function",
          }),
        ])
      );
    });

    it("should handle no resources to remove", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 5000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_NO_RESOURCES_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_NO_RESOURCES_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result: RemoveResult =
        await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe("remove");
      expect(result.resourcesRemoved).toBe(0);
      expect(result.completionStatus).toBe("complete");
      expect(result.removedResources).toHaveLength(0);
    });

    it("should handle partial removal with failures", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 45_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_PARTIAL_WITH_FAILURES_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_PARTIAL_WITH_FAILURES_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result: RemoveResult =
        await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe("remove");
      expect(result.resourcesRemoved).toBe(7);
      expect(result.completionStatus).toBe("partial");
      expect(result.removedResources).toHaveLength(8);
      expect(
        result.removedResources.filter((r) => r.status === "removed")
      ).toHaveLength(7);
      expect(
        result.removedResources.filter((r) => r.status === "failed")
      ).toHaveLength(1);
    });

    it("should handle removal failure", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 10_000,
        exitCode: 1,
        operation: "remove",
        output: SST_REMOVE_ERROR_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_ERROR_OUTPUT,
        success: false,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result: RemoveResult =
        await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(false);
      expect(result.operation).toBe("remove");
      expect(result.resourcesRemoved).toBe(0);
      expect(result.completionStatus).toBe("failed");
      expect(result.exitCode).toBe(1);
    });

    it("should handle complex removal scenarios", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 120_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_SUCCESS_WITH_DETAILS_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_SUCCESS_WITH_DETAILS_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result: RemoveResult =
        await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe("remove");
      expect(result.resourcesRemoved).toBe(8);
      expect(result.completionStatus).toBe("complete");
      expect(result.removedResources).toHaveLength(8);
      expect(
        result.removedResources.filter((r) => r.status === "removed")
      ).toHaveLength(8);
      expect(
        result.removedResources.filter((r) => r.status === "failed")
      ).toHaveLength(0);
    });

    it("should handle malformed output gracefully", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 5000,
        exitCode: 1,
        operation: "remove",
        output: SST_REMOVE_MALFORMED_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_MALFORMED_OUTPUT,
        success: false,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result: RemoveResult =
        await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(false);
      expect(result.operation).toBe("remove");
      expect(result.stage).toBe("test-stage");
      expect(result.removedResources).toBeDefined();
      expect(result.resourcesRemoved).toBeDefined();
      expect(result.completionStatus).toBeDefined();
    });
  });

  describe("GitHub integration", () => {
    it("should perform GitHub integration tasks", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 30_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_SUCCESS_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_SUCCESS_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      await removeOperation.execute(defaultOptions);

      // Assert
      expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "remove",
          success: true,
        }),
        "on-success"
      );
      expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "remove",
          success: true,
        })
      );
    });

    it("should handle GitHub integration errors gracefully", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 30_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_SUCCESS_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_SUCCESS_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      (
        mockGitHubClient.createOrUpdateComment as MockedFunction<
          typeof mockGitHubClient.createOrUpdateComment
        >
      ).mockRejectedValueOnce(new Error("GitHub API error"));
      (
        mockGitHubClient.createWorkflowSummary as MockedFunction<
          typeof mockGitHubClient.createWorkflowSummary
        >
      ).mockRejectedValueOnce(new Error("Summary error"));

      // Act & Assert - Should not throw
      const result = await removeOperation.execute(defaultOptions);
      expect(result.success).toBe(true);
    });
  });

  describe("CLI execution configuration", () => {
    it("should execute SST CLI with correct parameters", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 30_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_SUCCESS_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_SUCCESS_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      await removeOperation.execute(defaultOptions);

      // Assert
      expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith(
        "remove",
        "test-stage",
        expect.objectContaining({
          maxOutputSize: 50_000,
          timeout: 900_000, // 15 minutes
        })
      );
    });

    it("should use default timeout for remove operations", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 30_000,
        exitCode: 0,
        operation: "remove",
        output: SST_REMOVE_SUCCESS_OUTPUT,
        stage: "test-stage",
        stderr: "",
        stdout: SST_REMOVE_SUCCESS_OUTPUT,
        success: true,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      await removeOperation.execute(defaultOptions);

      // Assert
      expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith(
        "remove",
        "test-stage",
        expect.objectContaining({
          timeout: 900_000, // 15 minutes
        })
      );
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle CLI execution errors", async () => {
      // Arrange
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockRejectedValueOnce(new Error("CLI execution failed"));

      // Act & Assert
      await expect(removeOperation.execute(defaultOptions)).rejects.toThrow(
        "CLI execution failed"
      );
    });

    it("should handle empty output", async () => {
      // Arrange
      const mockCLIResult: SSTCommandResult = {
        command: "sst remove --stage test-stage",
        duration: 5000,
        exitCode: 1,
        operation: "remove",
        output: "",
        stage: "test-stage",
        stderr: "",
        stdout: "",
        success: false,
        truncated: false,
      };
      (
        mockSSTExecutor.executeSST as MockedFunction<
          typeof mockSSTExecutor.executeSST
        >
      ).mockResolvedValueOnce(mockCLIResult);

      // Act
      const result = await removeOperation.execute(defaultOptions);

      // Assert
      expect(result.success).toBe(false);
      expect(result.removedResources).toBeDefined();
      expect(result.resourcesRemoved).toBe(0);
    });
  });
});
