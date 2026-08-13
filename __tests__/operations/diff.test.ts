import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubClient } from "../../src/github/client";
import { DiffOperation } from "../../src/operations/diff";
import type { DiffParser } from "../../src/parsers/diff-parser";
import type { OperationOptions } from "../../src/types";
import type { SSTCLIExecutor } from "../../src/utils/cli";

// Mock the dependencies
const mockSSTExecutor = {
  executeSST: vi.fn(),
};

const mockGitHubClient = {
  createOrUpdateComment: vi.fn(),
  createWorkflowSummary: vi.fn(),
  postPRComment: vi.fn(),
};

const mockDiffParser = {
  parse: vi.fn(),
};

describe("Diff Operation - Change Analysis Workflows", () => {
  let diffOperation: DiffOperation;

  beforeEach(() => {
    vi.clearAllMocks();
    diffOperation = new DiffOperation(
      mockSSTExecutor as any as SSTCLIExecutor,
      mockGitHubClient as any as GitHubClient,
      mockDiffParser as any as DiffParser
    );
  });

  it("should execute diff operation successfully with changes detected", async () => {
    const options: OperationOptions = {
      maxOutputSize: 1_000_000,
      stage: "staging",
    };

    const mockSSTResult = {
      duration: 5000,
      exitCode: 0,
      output: `Planned changes:
+ Function MyFunction
~ Bucket MyBucket (policy updated)
- Database OldDatabase

Monthly: $45.50 → $67.80 (+$22.30)`,
      stderr: "",
      stdout: `Planned changes:
+ Function MyFunction
~ Bucket MyBucket (policy updated)
- Database OldDatabase

Monthly: $45.50 → $67.80 (+$22.30)`,
      success: true,
      truncated: false,
    };

    const mockDiffResult = {
      app: "test-app",
      changeSummary:
        "Found 3 planned changes: 1 creation, 1 update, 1 deletion. Cost increase: +$22.30 monthly.",
      changes: [
        {
          action: "create" as const,
          details: "",
          name: "MyFunction",
          type: "Function",
        },
        {
          action: "update" as const,
          details: "policy updated",
          name: "MyBucket",
          type: "Bucket",
        },
        {
          action: "delete" as const,
          details: "",
          name: "OldDatabase",
          type: "Database",
        },
      ],
      completionStatus: "complete" as const,
      exitCode: 0,
      operation: "diff" as const,
      plannedChanges: 3,
      rawOutput: "test output",
      stage: "staging",
      success: true,
      truncated: false,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.createOrUpdateComment.mockResolvedValue(undefined);
    mockGitHubClient.createWorkflowSummary.mockResolvedValue(undefined);

    const result = await diffOperation.execute(options);

    expect(result).toEqual(mockDiffResult);

    expect(mockSSTExecutor.executeSST).toHaveBeenCalledWith("diff", "staging", {
      maxOutputSize: 1_000_000,
      timeout: 300_000, // 5 minutes
    });

    // Diff used to read stdout alone, which made anything the CLI wrote to
    // stderr structurally invisible to it. It reads the merged buffer now, the
    // same value deploy and remove read.
    expect(mockDiffParser.parse).toHaveBeenCalledWith(
      mockSSTResult.output,
      "staging",
      0,
      false
    );
    expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
      mockDiffResult,
      "never"
    );
    expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(
      mockDiffResult
    );
  });

  it("should handle diff operation with no changes detected", async () => {
    const options: OperationOptions = {
      stage: "production",
    };

    const mockSSTResult = {
      duration: 2000,
      exitCode: 0,
      output: "No changes detected.",
      stderr: "",
      stdout: "No changes detected.",
      success: true,
      truncated: false,
    };

    const mockDiffResult = {
      app: "test-app",
      changeSummary: "No changes detected.",
      changes: [],
      completionStatus: "complete" as const,
      exitCode: 0,
      operation: "diff" as const,
      plannedChanges: 0,
      rawOutput: "test output",
      stage: "production",
      success: true,
      truncated: false,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.createOrUpdateComment.mockResolvedValue(undefined);
    mockGitHubClient.createWorkflowSummary.mockResolvedValue(undefined);

    const result = await diffOperation.execute(options);

    expect(result).toEqual(mockDiffResult);

    expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
      mockDiffResult,
      "never"
    );
    expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(
      mockDiffResult
    );
  });

  it("should handle diff with delete operations without breaking change warnings", async () => {
    const options: OperationOptions = {
      stage: "staging",
    };

    const mockSSTResult = {
      duration: 3000,
      exitCode: 0,
      output: `Planned changes:
- Function MyFunction

Changes detected in infrastructure.`,
      stderr: "",
      stdout: `Planned changes:
- Function MyFunction

Changes detected in infrastructure.`,
      success: true,
      truncated: false,
    };

    const mockDiffResult = {
      app: "test-app",
      changeSummary: "Found 1 planned change: 1 deletion.",
      changes: [
        {
          action: "delete" as const,
          name: "MyFunction",
          type: "Function",
        },
      ],
      completionStatus: "complete" as const,
      exitCode: 0,
      operation: "diff" as const,
      plannedChanges: 1,
      rawOutput: "test output",
      stage: "staging",
      success: true,
      truncated: false,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.createOrUpdateComment.mockResolvedValue(undefined);
    mockGitHubClient.createWorkflowSummary.mockResolvedValue(undefined);

    const result = await diffOperation.execute(options);

    expect(result).toEqual(mockDiffResult);
    expect(mockGitHubClient.createOrUpdateComment).toHaveBeenCalledWith(
      mockDiffResult,
      "never"
    );
    expect(mockGitHubClient.createWorkflowSummary).toHaveBeenCalledWith(
      mockDiffResult
    );
  });

  it("should handle SST CLI execution failure", async () => {
    const options: OperationOptions = {
      stage: "staging",
    };

    const mockSSTResult = {
      duration: 1000,
      exitCode: 1,
      output: "",
      stderr: "Authentication failed: Invalid SST token",
      stdout: "",
      success: false,
      truncated: false,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);

    const result = await diffOperation.execute(options);

    expect(result).toEqual({
      app: "unknown",
      changeSummary: "Failed to execute SST diff command",
      changes: [],
      completionStatus: "failed",
      error: "Authentication failed: Invalid SST token",
      exitCode: -1,
      operation: "diff",
      plannedChanges: 0,
      rawOutput: "",
      stage: "staging",
      success: false,
      truncated: false,
    });

    expect(mockDiffParser.parse).not.toHaveBeenCalled();
    expect(mockGitHubClient.createOrUpdateComment).not.toHaveBeenCalled();
    expect(mockGitHubClient.createWorkflowSummary).not.toHaveBeenCalled();
  });

  it("should handle GitHub API failure gracefully", async () => {
    const options: OperationOptions = {
      stage: "staging",
    };

    const mockSSTResult = {
      duration: 3000,
      exitCode: 0,
      output: `Planned changes:
+ Function MyFunction`,
      stderr: "",
      stdout: `Planned changes:
+ Function MyFunction`,
      success: true,
      truncated: false,
    };

    const mockDiffResult = {
      app: "test-app",
      changeSummary: "Found 1 planned change: 1 creation.",
      changes: [
        {
          action: "create" as const,
          details: "",
          name: "MyFunction",
          type: "Function",
        },
      ],
      completionStatus: "complete" as const,
      exitCode: 0,
      operation: "diff" as const,
      plannedChanges: 1,
      rawOutput: "test output",
      stage: "staging",
      success: true,
      truncated: false,
    };

    mockSSTExecutor.executeSST.mockResolvedValue(mockSSTResult);
    mockDiffParser.parse.mockReturnValue(mockDiffResult);
    mockGitHubClient.createOrUpdateComment.mockRejectedValue(
      new Error("GitHub API token invalid")
    );
    mockGitHubClient.createWorkflowSummary.mockRejectedValue(
      new Error("GitHub API token invalid")
    );

    const result = await diffOperation.execute(options);

    expect(result).toEqual(mockDiffResult);
    expect(result.success).toBe(true);
    expect(result.plannedChanges).toBe(1);
  });
});
