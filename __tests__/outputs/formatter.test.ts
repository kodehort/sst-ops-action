import { describe, expect, it } from "vitest";
import { OutputFormatter } from "../../src/outputs/formatter";
import type {
  DeployResult,
  DiffResult,
  OperationResult,
  RemoveResult,
  StageResult,
} from "../../src/types";

describe("Output Formatter - GitHub Actions Output Processing", () => {
  describe("formatOperationForGitHubActions", () => {
    describe("deploy operations", () => {
      it("should format successful deploy result correctly", () => {
        const deployResult: DeployResult = {
          app: "test-app",
          completionStatus: "complete",
          exitCode: 0,
          operation: "deploy",
          outputs: [
            { key: "API", value: "https://api.example.com" },
            { key: "Web", value: "https://web.example.com" },
          ],
          permalink:
            "https://console.sst.dev/test-app/staging/deployments/abc123",
          rawOutput: "Deploy completed successfully",
          resourceChanges: 3,
          resources: [
            { name: "MyFunction", status: "created", type: "Function" },
            { name: "MyApi", status: "updated", type: "Api" },
          ],
          stage: "staging",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(deployResult);

        expect(outputs).toEqual({
          app: "test-app",
          completion_status: "complete",
          computed_stage: "",
          diff_summary: "",
          error: "",
          event_name: "",
          is_pull_request: "",
          operation: "deploy",
          outputs: JSON.stringify(deployResult.outputs),
          permalink:
            "https://console.sst.dev/test-app/staging/deployments/abc123",
          planned_changes: "",
          ref: "",
          removed_resources: "",
          resource_changes: "3",
          resources: JSON.stringify(deployResult.resources),
          resources_removed: "",
          stage: "staging",
          success: "true",
          truncated: "false",
        });
      });

      it("should handle deploy result with missing optional fields", () => {
        const deployResult: DeployResult = {
          app: "test-app",
          completionStatus: "failed",
          error: "Deployment failed due to timeout",
          exitCode: 1,
          operation: "deploy",
          outputs: [],
          rawOutput: "Deploy failed",
          resourceChanges: 0,
          resources: [],
          stage: "production",
          success: false,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(deployResult);

        expect(outputs.success).toBe("false");
        expect(outputs.operation).toBe("deploy");
        expect(outputs.stage).toBe("production");
        expect(outputs.completion_status).toBe("failed");
        expect(outputs.resource_changes).toBe("0");
        expect(outputs.outputs).toBe("[]");
        expect(outputs.resources).toBe("[]");
        expect(outputs.error).toBe("Deployment failed due to timeout");
        expect(outputs.permalink).toBe("");
      });
    });

    describe("diff operations", () => {
      it("should format successful diff result correctly", () => {
        const diffResult: DiffResult = {
          app: "test-app",
          changeSummary: "Found 2 planned changes: 1 creation, 1 update",
          changes: [
            {
              action: "create",
              details: "",
              name: "MyFunction",
              type: "Function",
            },
            {
              action: "update",
              details: "config updated",
              name: "MyApi",
              type: "Api",
            },
          ],
          completionStatus: "complete",
          diffSection: "",
          exitCode: 0,
          operation: "diff",
          plannedChanges: 2,
          rawOutput: "Diff completed",
          stage: "staging",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(diffResult);

        expect(outputs).toEqual({
          app: "test-app",
          completion_status: "complete",
          computed_stage: "",
          diff_summary: "Found 2 planned changes: 1 creation, 1 update",
          error: "",
          event_name: "",
          is_pull_request: "",
          operation: "diff",
          outputs: "",
          permalink: "",
          planned_changes: "2",
          ref: "",
          removed_resources: "",
          resource_changes: "2",
          resources: "",
          resources_removed: "",
          stage: "staging",
          success: "true",
          truncated: "false",
        });
      });

      it("should handle diff result with no changes", () => {
        const diffResult: DiffResult = {
          app: "test-app",
          changeSummary: "No changes detected",
          changes: [],
          completionStatus: "complete",
          diffSection: "",
          exitCode: 0,
          operation: "diff",
          plannedChanges: 0,
          rawOutput: "No changes detected",
          stage: "production",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(diffResult);

        expect(outputs.success).toBe("true");
        expect(outputs.operation).toBe("diff");
        expect(outputs.resource_changes).toBe("0");
        expect(outputs.planned_changes).toBe("0");
        expect(outputs.diff_summary).toBe("No changes detected");
      });
    });

    describe("remove operations", () => {
      it("should format successful remove result correctly", () => {
        const removeResult: RemoveResult = {
          app: "test-app",
          completionStatus: "complete",
          exitCode: 0,
          operation: "remove",
          rawOutput: "Remove completed",
          removedResources: [
            { name: "MyFunction", status: "removed", type: "Function" },
            { name: "MyApi", status: "removed", type: "Api" },
          ],
          resourcesRemoved: 2,
          stage: "staging",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(removeResult);

        expect(outputs).toEqual({
          app: "test-app",
          completion_status: "complete",
          computed_stage: "",
          diff_summary: "",
          error: "",
          event_name: "",
          is_pull_request: "",
          operation: "remove",
          outputs: "",
          permalink: "",
          planned_changes: "",
          ref: "",
          removed_resources: JSON.stringify(removeResult.removedResources),
          resource_changes: "2",
          resources: "",
          resources_removed: "2",
          stage: "staging",
          success: "true",
          truncated: "false",
        });
      });

      it("should handle remove result with partial failure", () => {
        const removeResult: RemoveResult = {
          app: "test-app",
          completionStatus: "partial",
          exitCode: 0,
          operation: "remove",
          rawOutput: "Remove partially completed",
          removedResources: [
            { name: "MyFunction", status: "removed", type: "Function" },
            { name: "MyApi", status: "failed", type: "Api" },
          ],
          resourcesRemoved: 1,
          stage: "staging",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(removeResult);

        expect(outputs.success).toBe("true");
        expect(outputs.completion_status).toBe("partial");
        expect(outputs.resource_changes).toBe("1");
        expect(outputs.resources_removed).toBe("1");
        expect(outputs.removed_resources).toBe(
          JSON.stringify(removeResult.removedResources)
        );
      });
    });

    describe("stage operations", () => {
      it("should format successful stage result correctly", () => {
        const stageResult: StageResult = {
          app: "",
          completionStatus: "complete",
          computedStage: "feature-branch",
          eventName: "pull_request",
          exitCode: 0,
          isPullRequest: true,
          operation: "stage",
          rawOutput:
            "Stage computation successful\nEvent: pull_request\nRef: feature/branch\nComputed Stage: feature-branch",
          ref: "feature/branch",
          stage: "feature-branch",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(stageResult);

        expect(outputs).toEqual({
          app: "",
          completion_status: "complete",
          computed_stage: "feature-branch",
          diff_summary: "",
          error: "",
          event_name: "pull_request",
          is_pull_request: "true",
          operation: "stage",
          outputs: "",
          permalink: "",
          planned_changes: "",
          ref: "feature/branch",
          removed_resources: "",
          resource_changes: "",
          resources: "",
          resources_removed: "",
          stage: "feature-branch",
          success: "true",
          truncated: "false",
        });
      });

      it("should format stage result for push event", () => {
        const stageResult: StageResult = {
          app: "",
          completionStatus: "complete",
          computedStage: "main",
          eventName: "push",
          exitCode: 0,
          isPullRequest: false,
          operation: "stage",
          rawOutput: "Stage computation successful",
          ref: "refs/heads/main",
          stage: "main",
          success: true,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(stageResult);

        expect(outputs.computed_stage).toBe("main");
        expect(outputs.ref).toBe("refs/heads/main");
        expect(outputs.event_name).toBe("push");
        expect(outputs.is_pull_request).toBe("false");
      });

      it("should handle stage result with missing optional fields", () => {
        const stageResult: StageResult = {
          app: "",
          completionStatus: "failed",
          computedStage: "fallback",
          error: "Failed to compute stage from ref",
          eventName: "push",
          exitCode: 1,
          isPullRequest: false,
          operation: "stage",
          rawOutput: "Stage computation failed",
          ref: "",
          stage: "fallback",
          success: false,
          truncated: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(stageResult);

        expect(outputs.success).toBe("false");
        expect(outputs.error).toBe("Failed to compute stage from ref");
        expect(outputs.computed_stage).toBe("fallback");
        expect(outputs.ref).toBe("");
        expect(outputs.is_pull_request).toBe("false");
      });
    });

    describe("edge cases and error handling", () => {
      it("should handle null and undefined values gracefully", () => {
        const result: OperationResult = {
          app: "",
          completionStatus: "complete",
          exitCode: 0,
          operation: "deploy",
          outputs: [],
          rawOutput: "",
          resourceChanges: 0,
          resources: [],
          stage: "staging",
          success: true,
          truncated: false,
        };

        const outputs = OutputFormatter.formatOperationForGitHubActions(result);

        expect(outputs.app).toBe("");
        expect(outputs.permalink).toBe("");
        expect(outputs.error).toBe("");
        expect(outputs.outputs).toBe("[]");
        expect(outputs.resources).toBe("[]");
      });

      it("should handle JSON serialization errors gracefully", () => {
        const result: DeployResult = {
          app: "test-app",
          completionStatus: "complete",
          exitCode: 0,
          operation: "deploy",
          outputs: [],
          rawOutput: "Deploy completed",
          resourceChanges: 1,
          resources: [],
          stage: "staging",
          success: true,
          truncated: false,
        };

        // Create a circular reference that would cause JSON.stringify to fail
        const circularObj: any = { name: "test" };
        circularObj.self = circularObj;
        result.outputs = [circularObj];

        const outputs = OutputFormatter.formatOperationForGitHubActions(result);

        // Should handle the error gracefully by returning empty string
        expect(outputs.outputs).toBe("");
      });

      it("should convert all values to strings", () => {
        const result: DiffResult = {
          app: "test-app",
          changeSummary: "Found changes",
          changes: [],
          completionStatus: "complete",
          diffSection: "",
          exitCode: 0,
          operation: "diff",
          plannedChanges: 5,
          rawOutput: "Diff completed",
          stage: "staging",
          success: true,
          truncated: true,
        };

        const outputs = OutputFormatter.formatOperationForGitHubActions(result);

        // All outputs should be strings
        for (const [_key, value] of Object.entries(outputs)) {
          expect(typeof value).toBe("string");
        }
      });
    });
  });

  describe("validateOutputs", () => {
    it("should pass validation for valid outputs", () => {
      const validOutputs = {
        app: "test-app",
        completion_status: "complete",
        diff_summary: "",
        error: "",
        operation: "deploy",
        outputs: "[]",
        permalink: "",
        planned_changes: "",
        removed_resources: "",
        resource_changes: "3",
        resources: "[]",
        resources_removed: "",
        stage: "staging",
        success: "true",
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(validOutputs);
      }).not.toThrow();
    });

    it("should throw error for missing required fields", () => {
      const invalidOutputs = {
        operation: "deploy",
        success: "true",
        // missing stage and completion_status
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/stage/);
    });

    it("should validate boolean field values", () => {
      const invalidOutputs = {
        completion_status: "complete",
        operation: "deploy",
        stage: "staging",
        success: "invalid", // Should be 'true' or 'false'
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/success/);
    });

    it("should validate operation field values", () => {
      const invalidOutputs = {
        completion_status: "complete",
        operation: "invalid-operation",
        stage: "staging",
        success: "true",
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/operation/);
    });

    it("should validate completion_status field values", () => {
      const invalidOutputs = {
        completion_status: "invalid-status",
        operation: "deploy",
        stage: "staging",
        success: "true",
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/completion_status/);
    });

    it("should validate numeric field values", () => {
      const invalidOutputs = {
        completion_status: "complete",
        operation: "deploy",
        resource_changes: "not-a-number",
        stage: "staging",
        success: "true",
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/resource_changes/);
    });

    it("should validate negative numbers are not allowed", () => {
      const invalidOutputs = {
        completion_status: "complete",
        operation: "deploy",
        resource_changes: "-5",
        stage: "staging",
        success: "true",
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/resource_changes/);
    });

    it("should validate JSON field values", () => {
      const invalidOutputs = {
        completion_status: "complete",
        operation: "deploy",
        outputs: "invalid-json",
        stage: "staging",
        success: "true",
        truncated: "false",
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(/outputs.*JSON/i);
    });

    it("should allow empty strings for optional fields", () => {
      const validOutputs = {
        app: "",
        completion_status: "complete",
        error: "",
        operation: "deploy",
        permalink: "",
        resource_changes: "",
        resources: "",
        stage: "staging",
        success: "true",
        truncated: "false",
        urls: "",
      };

      expect(() => {
        OutputFormatter.validateOutputs(validOutputs);
      }).not.toThrow();
    });
  });

  describe("utility methods", () => {
    it("should return expected field names", () => {
      const fields = OutputFormatter.getExpectedFields();

      expect(fields).toContain("success");
      expect(fields).toContain("operation");
      expect(fields).toContain("stage");
      expect(fields).toContain("completion_status");
      expect(fields).toContain("outputs");
      expect(fields).toContain("diff_summary");
      expect(fields).toContain("resources_removed");
      expect(fields.length).toBe(19);
    });

    it("should return required field names", () => {
      const requiredFields = OutputFormatter.getRequiredFields();

      expect(requiredFields).toEqual([
        "success",
        "operation",
        "stage",
        "completion_status",
      ]);
    });

    describe("validateOperationConsistency", () => {
      it("should set default values for deploy operations", () => {
        const outputs: Record<string, string> = {
          completion_status: "complete",
          operation: "deploy",
          stage: "staging",
          success: "true",
        };

        OutputFormatter.validateOperationConsistency(outputs, "deploy");

        expect(outputs.outputs).toBe("[]");
        expect(outputs.resources).toBe("[]");
      });

      it("should set default values for diff operations", () => {
        const outputs: Record<string, string> = {
          completion_status: "complete",
          operation: "diff",
          stage: "staging",
          success: "true",
        };

        OutputFormatter.validateOperationConsistency(outputs, "diff");

        expect(outputs.planned_changes).toBe("0");
        expect(outputs.diff_summary).toBe("");
      });

      it("should set default values for remove operations", () => {
        const outputs: Record<string, string> = {
          completion_status: "complete",
          operation: "remove",
          stage: "staging",
          success: "true",
        };

        OutputFormatter.validateOperationConsistency(outputs, "remove");

        expect(outputs.resources_removed).toBe("0");
        expect(outputs.removed_resources).toBe("[]");
      });

      it("should preserve existing values if already set", () => {
        const outputs: Record<string, string> = {
          completion_status: "complete",
          operation: "deploy",
          outputs: '[{"key":"API","value":"https://api.com"}]',
          resources: '[{"type":"Function","name":"MyFunc"}]',
          stage: "staging",
          success: "true",
        };

        OutputFormatter.validateOperationConsistency(outputs, "deploy");

        expect(outputs.outputs).toBe(
          '[{"key":"API","value":"https://api.com"}]'
        );
        expect(outputs.resources).toBe('[{"type":"Function","name":"MyFunc"}]');
      });

      it("should set default values for stage operations", () => {
        const outputs: Record<string, string> = {};

        OutputFormatter.validateOperationConsistency(outputs, "stage");

        expect(outputs.computed_stage).toBe("");
        expect(outputs.ref).toBe("");
        expect(outputs.event_name).toBe("");
        expect(outputs.is_pull_request).toBe("false");
      });

      it("should preserve existing stage values if already set", () => {
        const outputs: Record<string, string> = {
          computed_stage: "feature-branch",
          event_name: "pull_request",
          is_pull_request: "true",
          ref: "feature/branch",
        };

        OutputFormatter.validateOperationConsistency(outputs, "stage");

        expect(outputs.computed_stage).toBe("feature-branch");
        expect(outputs.ref).toBe("feature/branch");
        expect(outputs.event_name).toBe("pull_request");
        expect(outputs.is_pull_request).toBe("true");
      });
    });
  });
});
