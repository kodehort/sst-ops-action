import { describe, expect, it } from "vitest";
import { OutputFormatter } from "../../src/outputs/formatter";
import type { DeployResult, DiffResult, RemoveResult } from "../../src/types";

describe("OutputFormatter Integration", () => {
  describe("GitHub Actions workflow integration", () => {
    it("should produce consistent outputs for deploy workflow", () => {
      const deployResult: DeployResult = {
        app: "my-sst-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "deploy",
        outputs: [
          { key: "API", value: "https://api.myapp.com" },
          { key: "Web", value: "https://myapp.com" },
        ],
        permalink:
          "https://console.sst.dev/my-sst-app/production/deployments/xyz789",
        rawOutput: "Deploy completed successfully",
        resourceChanges: 5,
        resources: [
          { name: "api-handler", status: "created", type: "Function" },
          { name: "api-gateway", status: "updated", type: "Api" },
        ],
        stage: "production",
        success: true,
        truncated: false,
      };

      const outputs =
        OutputFormatter.formatOperationForGitHubActions(deployResult);

      // Validate outputs are properly formatted
      OutputFormatter.validateOutputs(outputs);
      OutputFormatter.validateOperationConsistency(outputs, "deploy");

      // Verify all required fields are strings
      expect(typeof outputs.success).toBe("string");
      expect(typeof outputs.operation).toBe("string");
      expect(typeof outputs.stage).toBe("string");
      expect(typeof outputs.completion_status).toBe("string");

      // Verify operation-specific fields
      expect(outputs.success).toBe("true");
      expect(outputs.operation).toBe("deploy");
      expect(outputs.stage).toBe("production");
      expect(outputs.completion_status).toBe("complete");
      expect(outputs.resource_changes).toBe("5");
      expect(JSON.parse(outputs.outputs || "[]")).toHaveLength(2);
      expect(JSON.parse(outputs.resources || "[]")).toHaveLength(2);
    });

    it("should produce consistent outputs for diff workflow", () => {
      const diffResult: DiffResult = {
        app: "my-sst-app",
        changeSummary: "Found 3 planned infrastructure changes",
        changes: [
          { action: "create", details: "", name: "handler", type: "Function" },
          {
            action: "update",
            details: "schema change",
            name: "main-db",
            type: "Database",
          },
          { action: "delete", details: "", name: "assets", type: "Bucket" },
        ],
        completionStatus: "complete",
        exitCode: 0,
        operation: "diff",
        plannedChanges: 3,
        rawOutput: "Diff analysis completed",
        stage: "staging",
        success: true,
        truncated: false,
      };

      const outputs =
        OutputFormatter.formatOperationForGitHubActions(diffResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);
      OutputFormatter.validateOperationConsistency(outputs, "diff");

      // Verify diff-specific fields
      expect(outputs.operation).toBe("diff");
      expect(outputs.planned_changes).toBe("3");
      expect(outputs.diff_summary).toBe(
        "Found 3 planned infrastructure changes"
      );
      expect(outputs.resource_changes).toBe("3"); // Should match plannedChanges

      // Verify other operation fields are empty
      expect(outputs.outputs).toBe("");
      expect(outputs.resources).toBe("");
      expect(outputs.resources_removed).toBe("");
      expect(outputs.removed_resources).toBe("");
    });

    it("should produce consistent outputs for remove workflow", () => {
      const removeResult: RemoveResult = {
        app: "my-sst-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Resources removed successfully",
        removedResources: [
          { name: "api-handler", status: "removed", type: "Function" },
          { name: "main-db", status: "removed", type: "Database" },
          { name: "api-gateway", status: "removed", type: "Api" },
        ],
        resourcesRemoved: 7,
        stage: "staging",
        success: true,
        truncated: false,
      };

      const outputs =
        OutputFormatter.formatOperationForGitHubActions(removeResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);
      OutputFormatter.validateOperationConsistency(outputs, "remove");

      // Verify remove-specific fields
      expect(outputs.operation).toBe("remove");
      expect(outputs.resources_removed).toBe("7");
      expect(outputs.resource_changes).toBe("7"); // Should match resourcesRemoved
      expect(JSON.parse(outputs.removed_resources || "[]")).toHaveLength(3);

      // Verify other operation fields are empty
      expect(outputs.outputs).toBe("");
      expect(outputs.resources).toBe("");
      expect(outputs.diff_summary).toBe("");
      expect(outputs.planned_changes).toBe("");
    });

    it("should handle failed operations consistently", () => {
      const failedResult: DeployResult = {
        app: "my-sst-app",
        completionStatus: "failed",
        error:
          "AWS credentials do not have sufficient permissions to deploy to production",
        exitCode: 1,
        operation: "deploy",
        outputs: [],
        rawOutput: "Deploy failed: insufficient permissions",
        resourceChanges: 0,
        resources: [],
        stage: "production",
        success: false,
        truncated: false,
      };

      const outputs =
        OutputFormatter.formatOperationForGitHubActions(failedResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);

      // Verify failure handling
      expect(outputs.success).toBe("false");
      expect(outputs.completion_status).toBe("failed");
      expect(outputs.error).toBe(
        "AWS credentials do not have sufficient permissions to deploy to production"
      );
      expect(outputs.resource_changes).toBe("0");
    });

    it("should handle partial completion consistently", () => {
      const partialResult: RemoveResult = {
        app: "my-sst-app",
        completionStatus: "partial",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Some resources could not be removed",
        removedResources: [
          { name: "handler1", status: "removed", type: "Function" },
          { name: "handler2", status: "removed", type: "Function" },
          { name: "main-db", status: "failed", type: "Database" },
        ],
        resourcesRemoved: 2,
        stage: "staging",
        success: true,
        truncated: false,
      };

      const outputs =
        OutputFormatter.formatOperationForGitHubActions(partialResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);

      // Verify partial completion handling
      expect(outputs.success).toBe("true");
      expect(outputs.completion_status).toBe("partial");
      expect(outputs.resources_removed).toBe("2");
      expect(JSON.parse(outputs.removed_resources || "[]")).toHaveLength(3); // All resources listed, including failed ones
    });

    it("should maintain consistency across all operation types", () => {
      const deployResult: DeployResult = {
        app: "test-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "deploy",
        outputs: [],
        rawOutput: "",
        resourceChanges: 1,
        resources: [],
        stage: "test",
        success: true,
        truncated: false,
      };

      const diffResult: DiffResult = {
        app: "test-app",
        changeSummary: "",
        changes: [],
        completionStatus: "complete",
        exitCode: 0,
        operation: "diff",
        plannedChanges: 1,
        rawOutput: "",
        stage: "test",
        success: true,
        truncated: false,
      };

      const removeResult: RemoveResult = {
        app: "test-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "remove",
        rawOutput: "",
        removedResources: [],
        resourcesRemoved: 1,
        stage: "test",
        success: true,
        truncated: false,
      };

      const deployOutputs =
        OutputFormatter.formatOperationForGitHubActions(deployResult);
      const diffOutputs =
        OutputFormatter.formatOperationForGitHubActions(diffResult);
      const removeOutputs =
        OutputFormatter.formatOperationForGitHubActions(removeResult);

      // All should have the same required fields
      const requiredFields = OutputFormatter.getRequiredFields();
      for (const field of requiredFields) {
        expect(deployOutputs).toHaveProperty(field);
        expect(diffOutputs).toHaveProperty(field);
        expect(removeOutputs).toHaveProperty(field);
      }

      // All should have the same total number of fields
      const allFields = OutputFormatter.getExpectedFields();
      expect(Object.keys(deployOutputs)).toHaveLength(allFields.length);
      expect(Object.keys(diffOutputs)).toHaveLength(allFields.length);
      expect(Object.keys(removeOutputs)).toHaveLength(allFields.length);

      // All should pass validation
      expect(() =>
        OutputFormatter.validateOutputs(deployOutputs)
      ).not.toThrow();
      expect(() => OutputFormatter.validateOutputs(diffOutputs)).not.toThrow();
      expect(() =>
        OutputFormatter.validateOutputs(removeOutputs)
      ).not.toThrow();
    });
  });
});
