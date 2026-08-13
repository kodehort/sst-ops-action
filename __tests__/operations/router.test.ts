import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the classes needed for the router
vi.mock("@/github/client");
vi.mock("@/utils/cli");

import { GitHubClient } from "@/github/client";
import { OperationFactory } from "@/operations/factory";
import { executeOperation } from "@/operations/router";
import type { DeployResult, DiffResult, RemoveResult } from "@/types";
import { SSTCLIExecutor } from "@/utils/cli";
import { infrastructureInputs, stageInputs } from "../utils/resolved-inputs";

/**
 * These fixtures are the shape a parser actually produces.
 *
 * They used to be metadata-envelope shaped — `{ metadata: { app, cliExitCode,
 * rawOutput, truncated }, ... }` — which no parser has ever emitted. The router
 * validated against that shape with every field optional, so validation passed
 * with the envelope undefined and the transform rebuilt the result from
 * nothing: `app` became the literal "unknown", `truncated` was always false,
 * the real exit code was discarded, and `permalink` and `completionStatus` were
 * dropped. These tests encoded that as correct.
 */
describe("OperationRouter", () => {
  let mockOperation: {
    execute: ReturnType<typeof vi.fn>;
  };

  const deployResult: DeployResult = {
    app: "kodehort-scratch",
    completionStatus: "complete",
    exitCode: 0,
    operation: "deploy",
    outputs: [
      { key: "api", value: "https://api.example.com" },
      { key: "web", value: "https://web.example.com" },
    ],
    permalink: "https://sst.dev/u/75c084c6",
    rawOutput: "Deploy successful",
    resourceChanges: 3,
    resources: [
      { name: "handler", status: "created", timing: "2s", type: "function" },
    ],
    stage: "test-stage",
    success: true,
    truncated: true,
  };

  const diffResult: DiffResult = {
    app: "kodehort-scratch",
    changeSummary: "3 changes planned",
    changes: [{ action: "create", name: "handler", type: "function" }],
    completionStatus: "complete",
    diffSection: "",
    exitCode: 0,
    operation: "diff",
    permalink: "https://sst.dev/u/abc123",
    plannedChanges: 3,
    rawOutput: "Diff generated",
    stage: "test-stage",
    success: true,
    truncated: true,
  };

  const removeResult: RemoveResult = {
    app: "kodehort-scratch",
    completionStatus: "partial",
    exitCode: 0,
    operation: "remove",
    permalink: "https://sst.dev/u/9d14bf2c",
    rawOutput: "Removed",
    removedResources: [
      { name: "handler", status: "removed", type: "function" },
    ],
    resourcesRemoved: 1,
    stage: "test-stage",
    success: true,
    truncated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock operation
    mockOperation = {
      execute: vi.fn(),
    };

    // Mock OperationFactory methods. createOperation returns a thunk bound to
    // the resolved inputs, so the stub is a function rather than an object.
    vi.spyOn(OperationFactory.prototype, "createOperation").mockReturnValue(
      (() => (mockOperation.execute as () => unknown)()) as any
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
    it("should reject an unsupported operation type", async () => {
      // The real guard, not the always-true stub the other cases use.
      vi.spyOn(OperationFactory, "isValidOperationType").mockReturnValue(false);

      await expect(
        executeOperation({ operation: "invalid" } as any)
      ).rejects.toThrow(
        "Cannot create error result for unknown operation: invalid"
      );
    });

    it("should return the deploy result unchanged", async () => {
      mockOperation.execute.mockResolvedValue(deployResult);

      const result = await executeOperation(
        infrastructureInputs("deploy", { stage: "test-stage" })
      );

      expect(result).toEqual(deployResult);
    });

    it("should report the real app name, exit code and truncation for deploy", async () => {
      mockOperation.execute.mockResolvedValue(deployResult);

      const result = (await executeOperation(
        infrastructureInputs("deploy", { stage: "test-stage" })
      )) as DeployResult;

      // Each of these was destroyed by the transform: app became "unknown",
      // truncated was forced false, and permalink was dropped entirely.
      expect(result.app).toBe("kodehort-scratch");
      expect(result.truncated).toBe(true);
      expect(result.permalink).toBe("https://sst.dev/u/75c084c6");
      expect(result.resourceChanges).toBe(3);
      expect(result.outputs).toHaveLength(2);
    });

    it("should return the diff result unchanged", async () => {
      mockOperation.execute.mockResolvedValue(diffResult);

      const result = await executeOperation(
        infrastructureInputs("diff", { stage: "test-stage" })
      );

      expect(result).toEqual(diffResult);
    });

    it("should report the real planned changes and summary for diff", async () => {
      mockOperation.execute.mockResolvedValue(diffResult);

      const result = (await executeOperation(
        infrastructureInputs("diff", { stage: "test-stage" })
      )) as DiffResult;

      // The transform read these from differently-named schema fields, so the
      // output said "No changes detected" and 0 regardless of what was mapped.
      expect(result.plannedChanges).toBe(3);
      expect(result.changeSummary).toBe("3 changes planned");
      expect(result.app).toBe("kodehort-scratch");
    });

    it("should return the remove result unchanged", async () => {
      mockOperation.execute.mockResolvedValue(removeResult);

      const result = await executeOperation(
        infrastructureInputs("remove", { stage: "test-stage" })
      );

      expect(result).toEqual(removeResult);
    });

    it("should preserve the parser's completion status for remove", async () => {
      mockOperation.execute.mockResolvedValue(removeResult);

      const result = (await executeOperation(
        infrastructureInputs("remove", { stage: "test-stage" })
      )) as RemoveResult;

      // "partial" survives; the transform defaulted a missing value to "failed".
      expect(result.completionStatus).toBe("partial");
      expect(result.resourcesRemoved).toBe(1);
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

      const result = await executeOperation(stageInputs());

      expect(result.success).toBe(true);
      expect(result.operation).toBe("stage");
      expect(result).toEqual(mockStageResult);
    });

    it("should handle operation execution errors", async () => {
      const mockError = new Error("Operation failed");
      mockOperation.execute.mockRejectedValue(mockError);

      const result = await executeOperation(
        infrastructureInputs("deploy", { stage: "test-stage" })
      );

      // The router still owns failure-result construction — that is result
      // shaping, not error reporting.
      expect(result.success).toBe(false);
      expect(result.error).toBe("Operation failed");
      expect(result.operation).toBe("deploy");
      expect(result.stage).toBe("test-stage");
    });

    it("should build an operation-specific failure result on throw", async () => {
      mockOperation.execute.mockRejectedValue(new Error("boom"));

      const diff = (await executeOperation(
        infrastructureInputs("diff", { stage: "test-stage" })
      )) as DiffResult;
      expect(diff.changeSummary).toBe("Operation failed");
      expect(diff.plannedChanges).toBe(0);
      expect(diff.changes).toEqual([]);

      const remove = (await executeOperation(
        infrastructureInputs("remove", { stage: "test-stage" })
      )) as RemoveResult;
      expect(remove.removedResources).toEqual([]);
      expect(remove.resourcesRemoved).toBe(0);
    });

    it("should use fake token for stage operations", async () => {
      mockOperation.execute.mockResolvedValue({
        app: "",
        completionStatus: "complete" as const,
        computedStage: "test-stage",
        eventName: "push",
        exitCode: 0,
        isPullRequest: false,
        operation: "stage" as const,
        rawOutput: "",
        ref: "",
        stage: "test-stage",
        success: true,
        truncated: false,
      });

      await executeOperation(stageInputs());

      // The stage operation used to be handed the sentinel token
      // "fake-token" so a GitHub client could be constructed for it and then
      // never used. It has no token now, and no client is built.
      expect(GitHubClient).not.toHaveBeenCalled();
    });
  });
});
