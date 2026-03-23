/**
 * Integration tests for validation functionality
 * Tests the new validation features added in Phase 1 and Phase 2
 */

import { describe, expect, it } from "vitest";
import {
  validateRawDeployResult,
  validateRawDiffResult,
  validateRawRemoveResult,
} from "../../src/operations/schemas";
import { validateOutputs } from "../../src/outputs/schema";

describe("Operation Result Validation Integration", () => {
  describe("Deploy Result Validation", () => {
    it("should validate valid deploy result", () => {
      const validResult = {
        success: true,
        stage: "production",
        metadata: {
          app: "my-app",
          rawOutput: "output",
          cliExitCode: 0,
          truncated: false,
        },
        resourceChanges: 5,
        outputs: [{ key: "ApiUrl", value: "https://api.example.com" }],
        resources: [
          {
            type: "AWS::Lambda::Function",
            name: "my-function",
            status: "created",
            timing: "2.1s",
          },
        ],
        permalink: "https://console.sst.dev/...",
      };

      const validated = validateRawDeployResult(validResult);
      expect(validated).toBeDefined();
      expect(validated.success).toBe(true);
      expect(validated.stage).toBe("production");
    });

    it("should reject deploy result with missing required fields", () => {
      const invalidResult = {
        success: true,
        // missing stage
      };

      expect(() => validateRawDeployResult(invalidResult)).toThrow(
        /validation failed/
      );
    });

    it("should reject deploy result with wrong types", () => {
      const invalidResult = {
        success: "true", // should be boolean
        stage: "production",
      };

      expect(() => validateRawDeployResult(invalidResult)).toThrow(
        /expected boolean/
      );
    });
  });

  describe("Diff Result Validation", () => {
    it("should validate valid diff result", () => {
      const validResult = {
        success: true,
        stage: "staging",
        metadata: {
          app: "my-app",
        },
        changesDetected: 3,
        summary: "3 changes detected",
        changes: [
          {
            type: "AWS::S3::Bucket",
            name: "my-bucket",
            action: "update",
            details: "Tags modified",
          },
        ],
      };

      const validated = validateRawDiffResult(validResult);
      expect(validated).toBeDefined();
      expect(validated.success).toBe(true);
      expect(validated.changesDetected).toBe(3);
    });

    it("should handle optional fields", () => {
      const minimalResult = {
        success: false,
        stage: "development",
        metadata: {},
        error: "Failed to compute diff",
      };

      const validated = validateRawDiffResult(minimalResult);
      expect(validated).toBeDefined();
      expect(validated.success).toBe(false);
      expect(validated.error).toBe("Failed to compute diff");
    });
  });

  describe("Remove Result Validation", () => {
    it("should validate valid remove result", () => {
      const validResult = {
        success: true,
        stage: "test",
        metadata: {
          app: "my-app",
          cliExitCode: 0,
        },
        completionStatus: "complete" as const,
        resourcesRemoved: 10,
        removedResources: [
          {
            type: "AWS::DynamoDB::Table",
            name: "my-table",
            status: "removed",
          },
        ],
      };

      const validated = validateRawRemoveResult(validResult);
      expect(validated).toBeDefined();
      expect(validated.resourcesRemoved).toBe(10);
      expect(validated.completionStatus).toBe("complete");
    });

    it("should validate completion status enum", () => {
      const validStatuses = ["complete", "partial", "failed"];

      for (const status of validStatuses) {
        const result = {
          success: true,
          stage: "test",
          completionStatus: status as "complete" | "partial" | "failed",
        };

        expect(() => validateRawRemoveResult(result)).not.toThrow();
      }
    });

    it("should reject invalid completion status", () => {
      const invalidResult = {
        success: true,
        stage: "test",
        completionStatus: "invalid-status" as any,
      };

      expect(() => validateRawRemoveResult(invalidResult)).toThrow();
    });
  });
});

describe("GitHub Actions Output Validation Integration", () => {
  describe("Deploy Output Validation", () => {
    it("should validate complete deploy outputs", () => {
      const deployOutputs = {
        success: "true",
        operation: "deploy",
        stage: "production",
        completion_status: "complete",
        app: "my-app",
        permalink: "https://console.sst.dev/...",
        truncated: "false",
        resource_changes: "5",
        error: "",
        outputs: '[{"key":"ApiUrl","value":"https://api.example.com"}]',
        resources:
          '[{"type":"AWS::Lambda::Function","name":"my-function","status":"created"}]',
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      const validated = validateOutputs(deployOutputs);
      expect(validated).toBeDefined();
      expect(validated.success).toBe("true");
      expect(validated.operation).toBe("deploy");
    });

    it("should reject invalid success value", () => {
      const invalidOutputs = {
        success: "yes", // should be "true" or "false"
        operation: "deploy",
        stage: "production",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "",
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(invalidOutputs)).toThrow(
        /success must be "true" or "false"/
      );
    });

    it("should reject invalid operation type", () => {
      const invalidOutputs = {
        success: "true",
        operation: "invalid-op", // should be one of the valid operations
        stage: "production",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "",
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(invalidOutputs)).toThrow(/expected one of/);
    });

    it("should validate JSON fields", () => {
      const validOutputs = {
        success: "true",
        operation: "deploy",
        stage: "production",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "",
        error: "",
        outputs: "[]", // valid JSON
        resources: "[]", // valid JSON
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "[]", // valid JSON
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(validOutputs)).not.toThrow();
    });

    it("should reject invalid JSON in outputs field", () => {
      const invalidOutputs = {
        success: "true",
        operation: "deploy",
        stage: "production",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "",
        error: "",
        outputs: "{invalid json}", // invalid JSON
        resources: "[]",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(invalidOutputs)).toThrow(/Invalid JSON/);
    });
  });

  describe("URL Validation", () => {
    it("should accept valid URLs", () => {
      const validUrls = [
        "https://example.com",
        "http://localhost:3000",
        "https://api.example.com/v1",
      ];

      for (const url of validUrls) {
        const outputs = {
          success: "true",
          operation: "deploy",
          stage: "test",
          completion_status: "complete",
          app: "",
          permalink: url,
          truncated: "",
          resource_changes: "",
          error: "",
          outputs: "",
          resources: "",
          diff_summary: "",
          planned_changes: "",
          resources_removed: "",
          removed_resources: "",
          computed_stage: "",
          ref: "",
          event_name: "",
          is_pull_request: "",
        };

        expect(() => validateOutputs(outputs)).not.toThrow();
      }
    });

    it("should accept empty string for permalink", () => {
      const outputs = {
        success: "true",
        operation: "deploy",
        stage: "test",
        completion_status: "complete",
        app: "",
        permalink: "", // empty is valid
        truncated: "",
        resource_changes: "",
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(outputs)).not.toThrow();
    });

    it("should reject invalid URL format", () => {
      const outputs = {
        success: "true",
        operation: "deploy",
        stage: "test",
        completion_status: "complete",
        app: "",
        permalink: "not-a-url", // invalid URL
        truncated: "",
        resource_changes: "",
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(outputs)).toThrow(
        /permalink must be empty or a valid URL/
      );
    });
  });

  describe("Numeric Field Validation", () => {
    it("should accept numeric strings", () => {
      const outputs = {
        success: "true",
        operation: "deploy",
        stage: "test",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "42",
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "10",
        resources_removed: "5",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      const validated = validateOutputs(outputs);
      expect(validated.resource_changes).toBe("42");
      expect(validated.planned_changes).toBe("10");
      expect(validated.resources_removed).toBe("5");
    });

    it("should accept empty string for numeric fields", () => {
      const outputs = {
        success: "true",
        operation: "deploy",
        stage: "test",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "", // empty is valid
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(outputs)).not.toThrow();
    });

    it("should reject non-numeric strings", () => {
      const outputs = {
        success: "true",
        operation: "deploy",
        stage: "test",
        completion_status: "complete",
        app: "",
        permalink: "",
        truncated: "",
        resource_changes: "abc", // should be numeric
        error: "",
        outputs: "",
        resources: "",
        diff_summary: "",
        planned_changes: "",
        resources_removed: "",
        removed_resources: "",
        computed_stage: "",
        ref: "",
        event_name: "",
        is_pull_request: "",
      };

      expect(() => validateOutputs(outputs)).toThrow(
        /resource_changes must be a numeric string/
      );
    });
  });
});

describe("Error Message Quality", () => {
  it("should provide detailed error messages for validation failures", () => {
    const invalidOutputs = {
      success: "maybe", // invalid
      operation: "unknown-op", // invalid
      stage: "", // invalid (empty)
      completion_status: "done", // invalid
      app: "",
      permalink: "ftp://invalid", // invalid protocol
      truncated: "",
      resource_changes: "not-a-number", // invalid
      error: "",
      outputs: "",
      resources: "",
      diff_summary: "",
      planned_changes: "",
      resources_removed: "",
      removed_resources: "",
      computed_stage: "",
      ref: "",
      event_name: "",
      is_pull_request: "",
    };

    try {
      validateOutputs(invalidOutputs);
      expect.fail("Should have thrown validation error");
    } catch (error) {
      const message = (error as Error).message;
      // Check that error message contains helpful information
      expect(message).toContain("validation failed");
      expect(message).toContain("-"); // Should have bullet points
    }
  });
});
