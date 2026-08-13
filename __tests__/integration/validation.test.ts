/**
 * Integration tests for validation functionality
 * Tests the new validation features added in Phase 1 and Phase 2
 */

import { describe, expect, it } from "vitest";
import { validateOutputs } from "../../src/outputs/schema";

describe("GitHub Actions Output Validation Integration", () => {
  describe("Deploy Output Validation", () => {
    it("should validate complete deploy outputs", () => {
      const deployOutputs = {
        app: "my-app",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: '[{"key":"ApiUrl","value":"https://api.example.com"}]',
        permalink: "https://console.sst.dev/...",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "5",
        resources:
          '[{"type":"AWS::Lambda::Function","name":"my-function","status":"created"}]',
        resources_removed: "",
        stage: "production",
        success: "true",
        truncated: "false",
      };

      const validated = validateOutputs(deployOutputs);
      expect(validated).toBeDefined();
      expect(validated.success).toBe("true");
      expect(validated.operation).toBe("deploy");
    });

    it("should reject invalid success value", () => {
      const invalidOutputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "",
        permalink: "",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "",
        resources: "",
        resources_removed: "",
        stage: "production",
        success: "yes", // should be "true" or "false"
        truncated: "",
      };

      expect(() => validateOutputs(invalidOutputs)).toThrow(
        /success must be "true" or "false"/
      );
    });

    it("should reject invalid operation type", () => {
      const invalidOutputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "invalid-op", // should be one of the valid operations
        outputs: "",
        permalink: "",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "",
        resources: "",
        resources_removed: "",
        stage: "production",
        success: "true",
        truncated: "",
      };

      expect(() => validateOutputs(invalidOutputs)).toThrow(/expected one of/);
    });

    it("should validate JSON fields", () => {
      const validOutputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "[]", // valid JSON
        permalink: "",
        planned_changes: "",
        ref: "",
        removed_resources: "[]", // valid JSON
        resource_changes: "",
        resources: "[]", // valid JSON
        resources_removed: "",
        stage: "production",
        success: "true",
        truncated: "",
      };

      expect(() => validateOutputs(validOutputs)).not.toThrow();
    });

    it("should reject invalid JSON in outputs field", () => {
      const invalidOutputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "{invalid json}", // invalid JSON
        permalink: "",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "",
        resources: "[]",
        resources_removed: "",
        stage: "production",
        success: "true",
        truncated: "",
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
          app: "",
          completion_status: "complete",
          computed_stage: "",
          diff_summary: "",
          error: "",
          event_name: "",
          is_pull_request: "",
          operation: "deploy",
          outputs: "",
          permalink: url,
          planned_changes: "",
          ref: "",
          removed_resources: "",
          resource_changes: "",
          resources: "",
          resources_removed: "",
          stage: "test",
          success: "true",
          truncated: "",
        };

        expect(() => validateOutputs(outputs)).not.toThrow();
      }
    });

    it("should accept empty string for permalink", () => {
      const outputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "",
        permalink: "", // empty is valid
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "",
        resources: "",
        resources_removed: "",
        stage: "test",
        success: "true",
        truncated: "",
      };

      expect(() => validateOutputs(outputs)).not.toThrow();
    });

    it("should reject invalid URL format", () => {
      const outputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "",
        permalink: "not-a-url", // invalid URL
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "",
        resources: "",
        resources_removed: "",
        stage: "test",
        success: "true",
        truncated: "",
      };

      expect(() => validateOutputs(outputs)).toThrow(
        /permalink must be empty or a valid URL/
      );
    });
  });

  describe("Numeric Field Validation", () => {
    it("should accept numeric strings", () => {
      const outputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "",
        permalink: "",
        planned_changes: "10",
        ref: "",
        removed_resources: "",
        resource_changes: "42",
        resources: "",
        resources_removed: "5",
        stage: "test",
        success: "true",
        truncated: "",
      };

      const validated = validateOutputs(outputs);
      expect(validated.resource_changes).toBe("42");
      expect(validated.planned_changes).toBe("10");
      expect(validated.resources_removed).toBe("5");
    });

    it("should accept empty string for numeric fields", () => {
      const outputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "",
        permalink: "",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "", // empty is valid
        resources: "",
        resources_removed: "",
        stage: "test",
        success: "true",
        truncated: "",
      };

      expect(() => validateOutputs(outputs)).not.toThrow();
    });

    it("should reject non-numeric strings", () => {
      const outputs = {
        app: "",
        completion_status: "complete",
        computed_stage: "",
        diff_summary: "",
        error: "",
        event_name: "",
        is_pull_request: "",
        operation: "deploy",
        outputs: "",
        permalink: "",
        planned_changes: "",
        ref: "",
        removed_resources: "",
        resource_changes: "abc", // should be numeric
        resources: "",
        resources_removed: "",
        stage: "test",
        success: "true",
        truncated: "",
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
      app: "",
      completion_status: "done", // invalid
      computed_stage: "",
      diff_summary: "",
      error: "",
      event_name: "",
      is_pull_request: "",
      operation: "unknown-op", // invalid
      outputs: "",
      permalink: "ftp://invalid", // invalid protocol
      planned_changes: "",
      ref: "",
      removed_resources: "",
      resource_changes: "not-a-number", // invalid
      resources: "",
      resources_removed: "",
      stage: "", // invalid (empty)
      success: "maybe", // invalid
      truncated: "",
    };

    try {
      validateOutputs(invalidOutputs);
      expect.fail("Should have thrown validation error");
    } catch (error) {
      const { message } = error as Error;
      // Check that error message contains helpful information
      expect(message).toContain("validation failed");
      expect(message).toContain("-"); // Should have bullet points
    }
  });
});
