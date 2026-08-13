/**
 * Test suite for StageOperation
 * Tests stage computation operation execution and integration
 */

import * as github from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StageInputs } from "../../src/inputs/resolve";
import { StageOperation } from "../../src/operations/stage";
import { stageInputs } from "../utils/resolved-inputs";

describe("Stage Operation - Stage Computation Integration", () => {
  let stageOperation: StageOperation;
  let mockInputs: StageInputs;

  beforeEach(() => {
    // Create stage operation instance
    stageOperation = new StageOperation();

    // The stage operation's whole input surface. It has no token, runner,
    // output budget or stage — computing a stage is its job.
    mockInputs = stageInputs();

    // Reset mocks
    vi.clearAllMocks();

    // Reset GitHub context to a clean state
    Object.assign(github.context, {
      eventName: "push",
      payload: {},
      ref: undefined,
      ref_name: undefined,
    });
  });

  describe("Stage Operation Execution", () => {
    it("should execute stage operation successfully for pull request", async () => {
      // Mock GitHub context
      Object.assign(github.context, {
        eventName: "pull_request",
        payload: {
          pull_request: {
            head: {
              ref: "feature/user-authentication",
            },
          },
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("stage");
      expect(result.stage).toBe("user-authentication");
      expect(result.computedStage).toBe("user-authentication");
      expect(result.ref).toBe("feature/user-authentication");
      expect(result.eventName).toBe("pull_request");
      expect(result.isPullRequest).toBe(true);
      // The stage operation never runs SST, so there is no app to name.
      expect(result.app).toBe("");
      expect(result.completionStatus).toBe("complete");
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it("should execute stage operation successfully for push event", async () => {
      // Mock GitHub context
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/main",
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("main");
      expect(result.ref).toBe("refs/heads/main");
      expect(result.eventName).toBe("push");
      expect(result.isPullRequest).toBe(false);
    });

    it("should fail when missing ref (no fallback behavior)", async () => {
      // Mock GitHub context with no ref
      Object.assign(github.context, {
        eventName: "workflow_dispatch",
        payload: {},
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to generate a valid stage name from Git context"
      );
      expect(result.exitCode).toBe(1);
    });

    it("should handle numeric branch names correctly", async () => {
      Object.assign(github.context, {
        eventName: "pull_request",
        payload: {
          pull_request: {
            head: {
              ref: "123-hotfix",
            },
          },
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("pr-123-hotfix");
    });

    it("should truncate long branch names", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/feature/very-long-branch-name-that-should-be-truncated",
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage.length).toBeLessThanOrEqual(26);
      expect(result.computedStage).toBe("very-long-branch-name-that");
    });

    it("should not truncate output (no CLI output to truncate)", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/main",
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(false); // Never truncated since no real CLI output
      expect(result.rawOutput).toContain("Stage computation successful");
    });

    it("should fail when no valid stage can be determined", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {},
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to generate a valid stage name from Git context"
      );
      expect(result.completionStatus).toBe("failed");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle special characters in branch names", async () => {
      Object.assign(github.context, {
        eventName: "pull_request",
        payload: {
          pull_request: {
            head: {
              ref: "feature/my-branch@special#chars",
            },
          },
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("my-branch-special-chars");
    });

    it("should handle mixed case and underscores", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/Feature_Branch_Name",
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("feature-branch-name");
    });

    it("should remove leading and trailing hyphens", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/---branch-name---",
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("branch-name");
    });
  });

  describe("Stage Inference Integration", () => {
    it("should work with empty stage input (automatic inference)", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/feature-auto-stage",
        },
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("feature-auto-stage");
      expect(result.stage).toBe("feature-auto-stage");
    });

    it("should fail when Git context provides no usable ref (no fallback)", async () => {
      Object.assign(github.context, {
        eventName: "workflow_dispatch",
        payload: {},
        ref: undefined,
      });

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to generate a valid stage name from Git context"
      );
      expect(result.exitCode).toBe(1);
    });
  });

  describe("Configurable Parameters", () => {
    it("should pass custom truncation length to parser", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/very-long-branch-name-that-exceeds-default-limits",
        },
      });

      mockInputs.truncationLength = 15;

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("very-long-branc"); // Truncated to 15 chars
      expect(result.computedStage.length).toBe(15);
    });

    it("should pass custom prefix to parser", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/123-hotfix",
        },
      });

      mockInputs.prefix = "fix-";

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("fix-123-hotfix");
      expect(result.computedStage.startsWith("fix-")).toBe(true);
    });

    it("should use both custom parameters together", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/123-very-long-branch-name-that-needs-truncation",
        },
      });

      mockInputs.truncationLength = 20;
      mockInputs.prefix = "issue-";

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("issue-123-very-long"); // Truncated to 19 chars due to trailing hyphen cleanup
      expect(result.computedStage.length).toBeLessThanOrEqual(20);
      expect(result.computedStage.startsWith("issue-")).toBe(true);
    });

    it("should use default values when parameters not provided", async () => {
      Object.assign(github.context, {
        eventName: "push",
        payload: {
          ref: "refs/heads/123-branch-name",
        },
      });

      // Don't set custom parameters - should use defaults

      const result = await stageOperation.execute(mockInputs);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe("pr-123-branch-name"); // Default prefix 'pr-'
      expect(result.computedStage.length).toBeLessThanOrEqual(26); // Default truncation length
    });
  });
});
