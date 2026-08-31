import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportFailure } from "../src/errors/report-failure";

vi.mock("../src/inputs/compute-stage", () => ({
  computeStageFromGitContext: vi.fn(() => "computed-stage"),
}));

// Spied, not stubbed: these tests assert both that reporting happened and
// what the user is shown, and there is one reporter now.
vi.mock("../src/errors/report-failure", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/errors/report-failure")>();
  return { ...original, reportFailure: vi.fn(original.reportFailure) };
});

import { computeStageFromGitContext } from "../src/inputs/compute-stage";
import { run } from "../src/main";

import * as operationRouter from "../src/operations/router";
import { OutputFormatter } from "../src/outputs/formatter";

// Helper function to create mock getInput
function createGetInputMock(inputs: Record<string, string>) {
  return (name: string) => inputs[name] || "";
}

describe("Main Entry Point - Action Execution", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env = {
      CI: "true",
      GITHUB_ACTIONS: "true",
      NODE_ENV: "test",
    };

    vi.spyOn(core, "getInput").mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        "comment-mode": "on-success",
        "max-output-size": "50000",
        operation: "deploy",
        stage: "staging",
        token: "fake-token",
      };
      return inputs[name] || "";
    });

    vi.spyOn(core, "getBooleanInput").mockImplementation((name: string) => {
      if (name === "fail-on-error") {
        return true;
      }
      return false;
    });

    vi.spyOn(operationRouter, "executeOperation").mockResolvedValue({
      app: "test-app",
      completionStatus: "complete",
      exitCode: 0,
      operation: "deploy" as const,
      rawOutput: "Deploy successful",
      resourceChanges: 3,
      resources: [],
      stage: "staging",
      stages: "",
      success: true,
      truncated: false,
      urls: [],
    } as any);

    // Spy on and mock the output formatter
    vi.spyOn(
      OutputFormatter,
      "formatOperationForGitHubActions"
    ).mockReturnValue({
      app: "test-app",
      completion_status: "complete",
      computed_stage: "",
      diff_summary: "",
      error: "",
      event_name: "",
      is_pull_request: "",
      operation: "deploy",
      outputs: "[]",
      permalink: "",
      planned_changes: "",
      ref: "",
      removed_resources: "",
      resource_changes: "3",
      resources: "[]",
      resources_removed: "",
      stage: "staging",
      stages: "",
      success: "true",
      truncated: "false",
    });

    // Spy on the error handler (but let it run to test actual error logging)

    // Mock all core functions with spies
    vi.spyOn(core, "info").mockImplementation(() => {
      /* no-op */
    });
    vi.spyOn(core, "warning").mockImplementation(() => {
      /* no-op */
    });
    vi.spyOn(core, "error").mockImplementation(() => {
      /* no-op */
    });
    vi.spyOn(core, "setOutput").mockImplementation(() => {
      /* no-op */
    });
    vi.spyOn(core, "setFailed").mockImplementation(() => {
      /* no-op */
    });
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  describe("Successful Operation Execution", () => {
    it("should execute deploy operation and report success with detailed metrics", async () => {
      const mockResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "deploy" as const,
        outputs: [{ key: "API", value: "https://api.example.com" }],
        rawOutput: "Deploy completed successfully",
        resourceChanges: 3,
        resources: [
          { name: "MyFunction", status: "created" as const, type: "Function" },
        ],
        stage: "staging",
        stages: "",
        success: true,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.info).toHaveBeenCalledWith(
        "🚀 Starting SST Operations Action"
      );
      // Exactly once. It fired twice on every real run: the entry point logged
      // it, and so did input parsing, each with its own copy of the
      // display-name logic.
      const parsedInputLines = vi
        .mocked(core.info)
        .mock.calls.filter(([line]) =>
          String(line).startsWith("📝 Parsed inputs")
        );
      expect(parsedInputLines).toEqual([
        ['📝 Parsed inputs: deploy operation on stage "staging"'],
      ]);
      expect(core.info).toHaveBeenCalledWith(
        "🔧 Executing deploy operation..."
      );
      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          commentMode: "on-success",
          failOnError: true,
          maxOutputSize: 50_000,
          operation: "deploy",
          runner: "bun",
          stage: "staging",
          token: "fake-token",
        })
      );
      expect(
        OutputFormatter.formatOperationForGitHubActions
      ).toHaveBeenCalledWith(mockResult);
      expect(core.setOutput).toHaveBeenCalledTimes(20); // All outputs
      expect(core.info).toHaveBeenCalledWith(
        "✅ SST deploy operation completed successfully"
      );
    });

    it("should analyze deployment changes and provide comprehensive diff report", async () => {
      const inputs = {
        "comment-mode": "always",
        operation: "diff",
        stage: "production",
        token: "ghp_test123",
      };
      vi.spyOn(core, "getInput").mockImplementation(createGetInputMock(inputs));

      const mockResult = {
        app: "test-app",
        changeSummary: "Found 5 planned changes",
        changes: [],
        completionStatus: "complete" as const,
        diffSection: "",
        exitCode: 0,
        operation: "diff" as const,
        plannedChanges: 5,
        rawOutput: "Diff analysis completed",
        stage: "production",
        stages: "",
        success: true,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          commentMode: "always",
          failOnError: true,
          maxOutputSize: 50_000,
          operation: "diff",
          runner: "bun",
          stage: "production",
          token: "ghp_test123",
        })
      );
      expect(core.info).toHaveBeenCalledWith("📋 Found 5 planned change(s)");
      expect(core.info).toHaveBeenCalledWith(
        "✅ SST diff operation completed successfully"
      );
    });

    it("should remove deployed resources and provide cleanup summary", async () => {
      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        if (name === "operation") {
          return "remove";
        }
        if (name === "stage") {
          return "staging";
        }
        if (name === "token") {
          return "fake-token";
        }
        return "";
      });

      const mockResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "remove" as const,
        rawOutput: "Resources removed successfully",
        removedResources: [
          { name: "OldFunction", status: "removed" as const, type: "Function" },
        ],
        resourcesRemoved: 7,
        stage: "staging",
        stages: "",
        success: true,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          commentMode: "on-success",
          failOnError: true,
          maxOutputSize: 50_000,
          operation: "remove",
          runner: "bun",
          stage: "staging",
          token: "fake-token",
        })
      );
      expect(core.info).toHaveBeenCalledWith("🗑️ Removed 7 resource(s)");
      expect(core.info).toHaveBeenCalledWith(
        "✅ SST remove operation completed successfully"
      );
    });
  });

  describe("Failed Operation Handling", () => {
    it("should handle operation failure with failOnError=true", async () => {
      const mockResult = {
        app: "test-app",
        completionStatus: "failed" as const,
        error: "Authentication failed",
        exitCode: 1,
        operation: "deploy" as const,
        outputs: [],
        rawOutput: "Deploy failed",
        resourceChanges: 0,
        resources: [],
        stage: "staging",
        stages: "",
        success: false,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        "SST deploy operation failed: Authentication failed"
      );
      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringMatching(/completed successfully/)
      );
    });

    it("should handle operation failure with failOnError=false", async () => {
      vi.spyOn(core, "getBooleanInput").mockImplementation((name: string) => {
        if (name === "fail-on-error") {
          return false;
        }
        return false;
      });

      const mockResult = {
        app: "test-app",
        completionStatus: "failed" as const,
        error: "Network timeout",
        exitCode: 1,
        operation: "deploy" as const,
        outputs: [],
        rawOutput: "Deploy failed due to network timeout",
        resourceChanges: 0,
        resources: [],
        stage: "staging",
        stages: "",
        success: false,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.warning).toHaveBeenCalledWith(
        "SST deploy operation failed: Network timeout"
      );
      expect(core.info).toHaveBeenCalledWith(
        "🔄 Continuing workflow as fail-on-error is disabled"
      );
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe("Input Validation Workflows", () => {
    it("should handle input validation errors", async () => {
      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        if (name === "operation") {
          return "invalid-operation";
        }
        if (name === "stage") {
          return "staging";
        }
        if (name === "token") {
          return "fake-token";
        }
        return "";
      });

      // Invalid operation should throw immediately and be handled by handleUnexpectedError
      await run();

      expect(vi.mocked(reportFailure)).toHaveBeenCalled();
    });

    it("should validate required inputs", async () => {
      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        if (name === "operation") {
          return "deploy";
        }
        if (name === "stage") {
          return "test-stage"; // Provide a valid stage to avoid stage computation failure
        }
        // Return empty token to trigger validation error
        if (name === "token") {
          return "";
        }
        return "";
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining("SST action failed:")
      );
    });

    it("should throw when operation input is missing", async () => {
      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        if (name === "operation") {
          return "";
        }
        return "";
      });

      await run();

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid input:")
      );
    });

    it("should throw when operation input is invalid", async () => {
      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        if (name === "operation") {
          return "invalid-op";
        }
        return "";
      });

      await run();

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid input:")
      );
    });

    it("reports a failure to compute a deploy stage", async () => {
      // This used to reach the failure branch with
      // `vi.spyOn(StageProcessor.prototype, "process")` — prototype surgery
      // standing in for a seam that did not exist. The computation is injected
      // now, so the adapter is mocked at its module boundary, and its own
      // behaviour is covered in __tests__/inputs/compute-stage.test.ts.
      vi.mocked(computeStageFromGitContext).mockImplementation(() => {
        throw new Error(
          "Failed to compute stage from Git context: no usable ref"
        );
      });

      vi.spyOn(core, "getInput").mockImplementation((name: string) =>
        name === "operation" ? "deploy" : ""
      );

      await run();

      expect(reportFailure).toHaveBeenCalled();
    });
  });

  describe("Output Processing Workflows", () => {
    it("should format and validate outputs correctly", async () => {
      const mockResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "deploy" as const,
        outputs: [],
        rawOutput: "Deploy completed",
        resourceChanges: 2,
        resources: [],
        stage: "staging",
        stages: "",
        success: true,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(
        OutputFormatter.formatOperationForGitHubActions
      ).toHaveBeenCalledWith(mockResult);
      expect(core.setOutput).toHaveBeenCalledWith("success", "true");
      expect(core.setOutput).toHaveBeenCalledWith("operation", "deploy");
      expect(core.setOutput).toHaveBeenCalledWith("stage", "staging");
    });

    it("should handle output truncation warnings", async () => {
      const mockResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "deploy" as const,
        outputs: [],
        rawOutput: "Deploy completed with large output",
        resourceChanges: 1,
        resources: [],
        stage: "staging",
        stages: "",
        success: true,
        truncated: true,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );

      await run();

      expect(core.warning).toHaveBeenCalledWith(
        "⚠️ Output was truncated due to size limits"
      );
    });

    it("should handle output formatting errors", async () => {
      const mockResult = {
        app: "test-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "deploy" as const,
        outputs: [],
        rawOutput: "Deploy completed",
        resourceChanges: 1,
        resources: [],
        stage: "staging",
        stages: "",
        success: true,
        truncated: false,
      };

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        mockResult
      );
      vi.spyOn(
        OutputFormatter,
        "formatOperationForGitHubActions"
      ).mockImplementation(() => {
        throw new Error("Output formatting failed");
      });

      await run();

      expect(core.error).toHaveBeenCalledWith(
        "Failed to set outputs: Output formatting failed"
      );
      expect(vi.mocked(reportFailure)).toHaveBeenCalled();
    });
  });

  describe("Error Handling Workflows", () => {
    it("should use enhanced error handling for operation failures", async () => {
      const operationError = new Error("SST CLI execution failed");
      vi.spyOn(operationRouter, "executeOperation").mockRejectedValueOnce(
        operationError
      );

      await run();

      expect(vi.mocked(reportFailure)).toHaveBeenCalled();
    });

    it("reports a thrown operation error in the same format as a failed result", async () => {
      vi.spyOn(operationRouter, "executeOperation").mockRejectedValueOnce(
        new Error("Operation failed")
      );

      await run();

      // The same shape a non-zero SST exit produces. Those two paths used to
      // print different things: this one went through the elaborate handler,
      // the common one terminated at a bare failure call in the entry point.
      expect(core.setFailed).toHaveBeenCalledWith(
        "SST deploy operation failed: Operation failed"
      );
    });
  });

  describe("End-to-End Integration Scenarios", () => {
    it("should handle end-to-end deploy workflow", async () => {
      // Simulate full deploy workflow
      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "comment-mode": "on-success",
          "max-output-size": "100000",
          operation: "deploy",
          stage: "production",
          token: "ghp_real_token_123",
        };
        return inputs[name] || "";
      });

      const deployResult = {
        app: "my-sst-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "deploy" as const,
        outputs: [
          { key: "API", value: "https://api.myapp.com" },
          { key: "Web", value: "https://myapp.com" },
        ],
        permalink:
          "https://console.sst.dev/my-sst-app/production/deployments/abc123",
        rawOutput: "Deploy completed successfully",
        resourceChanges: 15,
        resources: [
          { name: "ApiHandler", status: "created" as const, type: "Function" },
          { name: "MainDB", status: "updated" as const, type: "Database" },
        ],
        stage: "production",
        stages: "",
        success: true,
        truncated: false,
      };

      // Override the formatter mock to return production-specific outputs
      vi.spyOn(
        OutputFormatter,
        "formatOperationForGitHubActions"
      ).mockReturnValue({
        app: "my-sst-app",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: JSON.stringify(deployResult.outputs),
        permalink:
          "https://console.sst.dev/my-sst-app/production/deployments/abc123",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "15",
        resources: JSON.stringify(deployResult.resources),
        resources_removed: "",
        stage: "production",
        stages: "",
        success: "true",
        truncated: "false",
      });

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        deployResult
      );

      await run();

      // Verify the complete workflow
      expect(core.info).toHaveBeenCalledWith(
        "🚀 Starting SST Operations Action"
      );
      expect(core.info).toHaveBeenCalledWith(
        '📝 Parsed inputs: deploy operation on stage "production"'
      );
      expect(core.info).toHaveBeenCalledWith(
        "🔧 Executing deploy operation..."
      );
      expect(core.info).toHaveBeenCalledWith(
        "✅ Operation: deploy (production)"
      );
      expect(core.info).toHaveBeenCalledWith("📊 Status: SUCCESS (complete)");
      expect(core.info).toHaveBeenCalledWith("🚀 Deployed 15 resource(s)");
      expect(core.info).toHaveBeenCalledWith(
        "✅ SST deploy operation completed successfully"
      );

      expect(operationRouter.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          commentMode: "on-success",
          failOnError: true,
          maxOutputSize: 100_000,
          operation: "deploy",
          runner: "bun",
          stage: "production",
          token: "ghp_real_token_123",
        })
      );

      expect(core.setOutput).toHaveBeenCalledWith("success", "true");
      expect(core.setOutput).toHaveBeenCalledWith("operation", "deploy");
      expect(core.setOutput).toHaveBeenCalledWith("stage", "production");
      expect(core.setOutput).toHaveBeenCalledWith(
        "completion_status",
        "complete"
      );
    });

    it("should handle partial success scenarios", async () => {
      const partialResult = {
        app: "test-app",
        completionStatus: "partial" as const,
        exitCode: 0,
        operation: "remove" as const,
        rawOutput: "Remove completed with partial success",
        removedResources: [
          { name: "Func1", status: "removed" as const, type: "Function" },
          { name: "Func2", status: "removed" as const, type: "Function" },
          { name: "DB1", status: "failed" as const, type: "Database" },
        ],
        resourcesRemoved: 5,
        stage: "staging",
        stages: "",
        success: true,
        truncated: false,
      };

      vi.spyOn(core, "getInput").mockImplementation((name: string) => {
        if (name === "operation") {
          return "remove";
        }
        if (name === "stage") {
          return "staging";
        }
        if (name === "token") {
          return "fake-token";
        }
        return "";
      });

      vi.spyOn(operationRouter, "executeOperation").mockResolvedValueOnce(
        partialResult
      );

      await run();

      expect(core.info).toHaveBeenCalledWith("📊 Status: SUCCESS (partial)");
      expect(core.info).toHaveBeenCalledWith("🗑️ Removed 5 resource(s)");
      expect(core.info).toHaveBeenCalledWith(
        "✅ SST remove operation completed successfully"
      );
    });
  });
});
