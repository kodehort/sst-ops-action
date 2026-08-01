import { describe, expect, it } from "vitest";
import type {
  SSTDeployOutput,
  SSTDiffOutput,
  SSTRemoveOutput,
} from "../../src/types/index.js";
import { validateSSTOutput } from "../../src/types/index.js";

describe("SST Output Validation", () => {
  describe("validateSSTOutput", () => {
    it("should validate deploy output correctly", () => {
      const validDeployOutput: SSTDeployOutput = {
        app: "test-app",
        duration: 45_000,
        outputs: {
          ApiUrl: "https://api.example.com",
        },
        permalink: "https://console.sst.dev/test-app/test/deploy/123",
        region: "us-east-1",
        resources: [
          {
            logicalId: "ApiHandler",
            name: "api-handler",
            outputs: {
              arn: "arn:aws:lambda:us-east-1:123456789012:function:test-app-test-api-handler-abc123",
              name: "test-app-test-api-handler-abc123",
            },
            physicalId: "test-app-test-api-handler-abc123",
            properties: {
              handler: "index.handler",
              memory: 1024,
              runtime: "nodejs20.x",
              timeout: 30,
            },
            status: "CREATE_COMPLETE",
            type: "Function",
          },
        ],
        stage: "test",
        status: "success",
      };

      expect(() =>
        validateSSTOutput(validDeployOutput, "deploy")
      ).not.toThrow();
      const result = validateSSTOutput(validDeployOutput, "deploy");
      expect(result).toEqual(validDeployOutput);
    });

    it("should validate diff output correctly", () => {
      const validDiffOutput: SSTDiffOutput = {
        app: "test-app",
        changes: [
          {
            action: "create",
            logicalId: "NewHandler",
            name: "new-handler",
            properties: {
              added: {
                handler: "new.handler",
                runtime: "nodejs20.x",
              },
              removed: {},
              updated: {},
            },
            reason: "New resource added",
            type: "Function",
          },
          {
            action: "update",
            logicalId: "ExistingHandler",
            name: "existing-handler",
            properties: {
              added: {},
              removed: {},
              updated: {
                memory: 512,
              },
            },
            reason: "Memory configuration changed",
            type: "Function",
          },
          {
            action: "delete",
            logicalId: "OldHandler",
            name: "old-handler",
            reason: "Resource no longer needed",
            type: "Function",
          },
        ],
        region: "us-east-1",
        stage: "test",
        status: "success",
        summary: {
          toCreate: 1,
          toDelete: 1,
          total: 3,
          toUpdate: 1,
        },
      };

      expect(() => validateSSTOutput(validDiffOutput, "diff")).not.toThrow();
      const result = validateSSTOutput(validDiffOutput, "diff");
      expect(result).toEqual(validDiffOutput);
    });

    it("should validate remove output correctly", () => {
      const validRemoveOutput: SSTRemoveOutput = {
        app: "test-app",
        duration: 30_000,
        errors: ["Failed to remove Table: users - deletion protection enabled"],
        region: "us-east-1",
        removed: [
          {
            logicalId: "ApiHandler",
            name: "api-handler",
            status: "removed",
            type: "Function",
          },
          {
            logicalId: "Api",
            name: "api",
            status: "removed",
            type: "Api",
          },
          {
            logicalId: "UsersTable",
            name: "users",
            reason: "Table has deletion protection enabled",
            status: "failed",
            type: "Table",
          },
        ],
        stage: "test",
        status: "partial",
        summary: {
          totalFailed: 1,
          totalRemoved: 2,
          totalSkipped: 0,
        },
        warnings: ["Some resources may take time to fully delete"],
      };

      expect(() =>
        validateSSTOutput(validRemoveOutput, "remove")
      ).not.toThrow();
      const result = validateSSTOutput(validRemoveOutput, "remove");
      expect(result).toEqual(validRemoveOutput);
    });

    it("should throw error for invalid output structure", () => {
      expect(() => validateSSTOutput(null, "deploy")).toThrow(
        "SST output must be an object"
      );
      expect(() => validateSSTOutput(undefined, "deploy")).toThrow(
        "SST output must be an object"
      );
      expect(() => validateSSTOutput("string", "deploy")).toThrow(
        "SST output must be an object"
      );
      expect(() => validateSSTOutput(123, "deploy")).toThrow(
        "SST output must be an object"
      );
    });

    it("should throw error for missing required fields", () => {
      const invalidOutput = {};
      expect(() => validateSSTOutput(invalidOutput, "deploy")).toThrow(
        "must include app and stage"
      );

      const partialOutput = { app: "test-app" };
      expect(() => validateSSTOutput(partialOutput, "deploy")).toThrow(
        "must include app and stage"
      );
    });

    it("should throw error for deploy output missing required fields", () => {
      const incompleteDeployOutput = {
        app: "test-app",
        region: "us-east-1",
        stage: "test",
        // missing: resources, outputs, urls, duration, status
      };

      expect(() => validateSSTOutput(incompleteDeployOutput, "deploy")).toThrow(
        "Deploy output missing required field"
      );
    });

    it("should throw error for diff output missing required fields", () => {
      const incompleteDiffOutput = {
        app: "test-app",
        region: "us-east-1",
        stage: "test",
        // missing: changes, summary, status
      };

      expect(() => validateSSTOutput(incompleteDiffOutput, "diff")).toThrow(
        "Diff output missing required field"
      );
    });

    it("should throw error for remove output missing required fields", () => {
      const incompleteRemoveOutput = {
        app: "test-app",
        region: "us-east-1",
        stage: "test",
        // missing: removed, summary, duration, status
      };

      expect(() => validateSSTOutput(incompleteRemoveOutput, "remove")).toThrow(
        "Remove output missing required field"
      );
    });

    it("should throw error for unsupported operations", () => {
      const validOutput = {
        app: "test-app",
        region: "us-east-1",
        stage: "test",
      };

      expect(() => validateSSTOutput(validOutput, "invalid" as any)).toThrow(
        "Unsupported operation: invalid"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty arrays in deploy output", () => {
      const deployWithEmptyArrays: SSTDeployOutput = {
        app: "test-app",
        duration: 1000,
        outputs: {},
        region: "us-east-1",
        resources: [], // empty array
        stage: "test",
        status: "success",
      };

      expect(() =>
        validateSSTOutput(deployWithEmptyArrays, "deploy")
      ).not.toThrow();
    });

    it("should handle empty arrays in diff output", () => {
      const diffWithEmptyArrays: SSTDiffOutput = {
        app: "test-app",
        changes: [], // empty array
        region: "us-east-1",
        stage: "test",
        status: "success",
        summary: {
          toCreate: 0,
          toDelete: 0,
          total: 0,
          toUpdate: 0,
        },
      };

      expect(() =>
        validateSSTOutput(diffWithEmptyArrays, "diff")
      ).not.toThrow();
    });

    it("should handle empty arrays in remove output", () => {
      const removeWithEmptyArrays: SSTRemoveOutput = {
        app: "test-app",
        duration: 1000,
        region: "us-east-1",
        removed: [], // empty array
        stage: "test",
        status: "success",
        summary: {
          totalFailed: 0,
          totalRemoved: 0,
          totalSkipped: 0,
        },
      };

      expect(() =>
        validateSSTOutput(removeWithEmptyArrays, "remove")
      ).not.toThrow();
    });

    it("should handle optional fields correctly", () => {
      const deployWithOptionalFields: SSTDeployOutput = {
        app: "test-app",
        duration: 1000,
        errors: [], // empty errors array
        outputs: {},
        permalink: "https://console.sst.dev/test-app/test/deploy/123",
        region: "us-east-1",
        resources: [],
        stage: "test",
        status: "success",
        warnings: ["This is a warning"],
      };

      expect(() =>
        validateSSTOutput(deployWithOptionalFields, "deploy")
      ).not.toThrow();
    });
  });
});
