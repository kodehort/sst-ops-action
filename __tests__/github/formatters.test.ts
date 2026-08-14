import { beforeEach, describe, expect, it } from "vitest";
import { OperationFormatter } from "../../src/github/formatters.js";
import { DiffParser } from "../../src/parsers/diff-parser.js";
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
} from "../../src/types/index.js";
import {
  createMockDeployResource,
  createMockDeployResult,
  createMockDiffResult,
  createMockResourceBatch,
} from "../utils/test-types.js";

describe("OperationFormatter", () => {
  let formatter: OperationFormatter;

  beforeEach(() => {
    formatter = new OperationFormatter();
  });

  describe("formatOperationComment", () => {
    it("should format deploy comment correctly", () => {
      const deployResult = createMockDeployResult({
        app: "my-app",
        outputs: [
          { key: "app", value: "https://my-app.com" },
          { key: "api", value: "https://api.my-app.com" },
        ],
        permalink: "https://console.sst.dev/my-app/production",
        rawOutput: "Deploy completed successfully",
        resourceChanges: 5,
        resources: [
          createMockDeployResource({
            name: "MyFunction",
            status: "created",
            type: "AWS::Lambda::Function",
          }),
          createMockDeployResource({
            name: "MyTable",
            status: "updated",
            type: "AWS::DynamoDB::Table",
          }),
        ],
        stage: "production",
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain("🚀 DEPLOY SUCCESS");
      expect(comment).toContain("| Stage | `production` |");
      expect(comment).toContain("| App | `my-app` |");
      expect(comment).toContain("| Resource Changes | 5 |");
      expect(comment).toContain("📊 Resource Changes");
      expect(comment).toContain("**Total Changes:** 5");
      expect(comment).toContain("📋 Deploy Outputs");
      expect(comment).toContain(
        "| app | [https://my-app.com](https://my-app.com) |"
      );
      expect(comment).toContain(
        "| api | [https://api.my-app.com](https://api.my-app.com) |"
      );
      expect(comment).toContain("🖥️ SST Console");
      expect(comment).toContain("https://console.sst.dev/my-app/production");
    });

    it("should format failed deploy comment correctly", () => {
      const failedDeployResult: DeployResult = {
        app: "my-app",
        completionStatus: "failed",
        error: "Deployment failed due to insufficient permissions",
        exitCode: 1,
        operation: "deploy",
        outputs: [],
        rawOutput: "Deploy failed",
        resourceChanges: 0,
        resources: [],
        stage: "staging",
        success: false,
        truncated: false,
      };

      const comment = formatter.formatOperationComment(failedDeployResult);

      expect(comment).toContain("❌ DEPLOY FAILED");
      expect(comment).toContain("| Stage | `staging` |");
    });

    it("should format diff comment correctly", () => {
      const diffResult = createMockDiffResult({
        app: "my-app",
        changeSummary: "Plan: 3 to add, 2 to change, 1 to destroy",
        changes: [
          { action: "create", name: "Function1", type: "Lambda" },
          { action: "update", name: "Bucket1", type: "S3" },
          { action: "delete", name: "Table1", type: "DynamoDB" },
        ],
        plannedChanges: 6,
        rawOutput: "Diff completed",
        stage: "staging",
      }) as DiffResult;

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain("🔍 DIFF SUCCESS");
      expect(comment).toContain("🔍 Infrastructure Changes Preview");
      expect(comment).toContain("Plan: 3 to add, 2 to change, 1 to destroy");
    });

    it("should format diff comment with no changes", () => {
      const diffResult: DiffResult = {
        app: "my-app",
        changeSummary: "",
        changes: [],
        completionStatus: "complete",
        diffSection: "",
        exitCode: 0,
        operation: "diff",
        plannedChanges: 0,
        rawOutput: "No changes",
        stage: "staging",
        success: true,
        truncated: false,
      };

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain("✅ No Changes");
      expect(comment).toContain("No infrastructure changes detected");
    });

    it("should format real-world diff with environment variables", () => {
      const realWorldOutput = `
SST 3.17.10  ready!

➜  App:        kodehort-scratch
   Stage:      dev

~  Diff

|  Info        Downloaded provider aws-6.66.2
$ bunx --bun astro build

↗  Permalink   https://sst.dev/u/31550ec5

✓  Generated    
   Router: https://dev.kodeapps.co.uk
   Web: https://dev.kodeapps.co.uk
   Api: https://api.dev.kodeapps.co.uk
   ---
   github_role_arn: arn:aws:iam::194218796960:role/dev-GithubActionRole

+  Web sst:aws:Astro → WebBuilder command:local:Command
   + environment.ACTIONS_CACHE_SERVICE_V2 = True
   + environment.INPUT_OPERATION = diff
   + environment.INPUT_STAGE = dev
   * environment.GITHUB_ACTION = diff
   * environment.GITHUB_SHA = bbeb890c69910ff180191bfb
   - environment.GITHUB_TOKEN
`;

      // Built by the parser rather than by hand. The formatter now reads the
      // diff section off the result, so a hand-written fixture would be
      // asserting against a shape no parser produces — the same drift that
      // #146 found in the deploy capture.
      const diffResult = new DiffParser().parse(
        realWorldOutput,
        "dev",
        0,
        false
      );

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain("🔍 DIFF SUCCESS");
      expect(comment).toContain("1 changes planned");
      expect(comment).toContain("```diff");
      expect(comment).toContain(
        "+  Web sst:aws:Astro → WebBuilder command:local:Command"
      );

      // This test used to require the opposite — that each of these lines
      // appeared in the comment, `- environment.GITHUB_TOKEN` included. That
      // is the leak #155 reports, written down as a requirement. The resource
      // header above still has to survive, which is what the assertion before
      // this one pins.
      expect(comment).not.toContain("environment.ACTIONS_CACHE_SERVICE_V2");
      expect(comment).not.toContain("environment.GITHUB_ACTION");
      expect(comment).not.toContain("environment.GITHUB_TOKEN");
      expect(comment).toContain(
        "environment (6 variables changed, values hidden)"
      );
    });

    it("should format remove comment correctly", () => {
      const removeResult: RemoveResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Resources removed",
        removedResources: [],
        resourcesRemoved: 8,
        stage: "pr-123",
        success: true,
        truncated: false,
      };

      const comment = formatter.formatOperationComment(removeResult);

      expect(comment).toContain("🗑️ REMOVE SUCCESS");
      expect(comment).toContain("🗑️ Resource Cleanup");
      expect(comment).toContain("Resources cleaned up: 8");
      expect(comment).toContain("All resources successfully removed");
    });

    it("should format partial remove comment correctly", () => {
      const removeResult: RemoveResult = {
        app: "my-app",
        completionStatus: "partial",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Partial cleanup",
        removedResources: [
          { name: "Function1", status: "removed", type: "Lambda" },
          { name: "Bucket1", status: "failed", type: "S3" },
        ],
        resourcesRemoved: 5,
        stage: "pr-123",
        success: true,
        truncated: false,
      };

      const comment = formatter.formatOperationComment(removeResult);

      expect(comment).toContain("⚠️ **Partial cleanup completed**");
      expect(comment).toContain("Some resources may still exist");
      expect(comment).toContain("Check logs for details");
    });

    it("should format generic comment for unknown operations", () => {
      const genericResult = {
        app: "my-app",
        completionStatus: "complete" as const,
        exitCode: 0,
        operation: "unknown" as any,
        rawOutput: "Operation completed",
        stage: "staging",
        success: true,
        truncated: false,
      };

      const comment = formatter.formatOperationComment(genericResult);

      expect(comment).toContain("✅ UNKNOWN SUCCESS");
      expect(comment).toContain("**Stage:** `staging`");
    });
  });

  describe("formatOperationSummary", () => {
    it("should format deploy summary correctly", () => {
      const deployResult: DeployResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "deploy",
        outputs: [
          { key: "app", value: "https://my-app.com" },
          { key: "api", value: "https://api.my-app.com" },
        ],
        rawOutput: "Deploy completed",
        resourceChanges: 7,
        resources: [],
        stage: "production",
        success: true,
        truncated: false,
      };

      const summary = formatter.formatOperationSummary(deployResult);

      expect(summary).toContain("📦 Deployment Summary");
      expect(summary).toContain("Resources Changed | 7");
      expect(summary).toContain("Outputs | 2");
      expect(summary).toContain("📋 Deploy Outputs");
      expect(summary).toContain(
        "| app | [https://my-app.com](https://my-app.com) |"
      );
      expect(summary).toContain(
        "| api | [https://api.my-app.com](https://api.my-app.com) |"
      );
    });

    it("should format deploy summary with many outputs", () => {
      const outputs = Array.from({ length: 15 }, (_, i) => ({
        key: `Service${i}`,
        value: `https://service${i}.example.com`,
      }));

      const deployResult: DeployResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "deploy",
        outputs,
        rawOutput: "Deploy completed",
        resourceChanges: 15,
        resources: [],
        stage: "staging",
        success: true,
        truncated: false,
      };

      const summary = formatter.formatOperationSummary(deployResult);

      expect(summary).toContain("Outputs | 15");
      expect(summary).toContain("... and 5 more outputs");
    });

    it("should format diff summary correctly", () => {
      const diffResult: DiffResult = {
        app: "my-app",
        changeSummary: "3 resources to create, 2 to update, 1 to destroy",
        changes: [
          { action: "create", name: "Function1", type: "Lambda" },
          { action: "update", name: "Bucket1", type: "S3" },
          { action: "delete", name: "Table1", type: "DynamoDB" },
        ],
        completionStatus: "complete",
        diffSection: "",
        exitCode: 0,
        operation: "diff",
        plannedChanges: 6,
        rawOutput: "Diff completed",
        stage: "staging",
        success: true,
        truncated: false,
      };

      const summary = formatter.formatOperationSummary(diffResult);

      expect(summary).toContain("🔍 Infrastructure Diff Summary");
      expect(summary).toContain("Total Changes | 6");
      expect(summary).toContain("📋 View Resource Changes");
      expect(summary).toContain("```diff");
      expect(summary).toContain("+ Function1 (Lambda)");
      expect(summary).toContain("* Bucket1 (S3)");
      expect(summary).toContain("- Table1 (DynamoDB)");
    });

    it("should format diff summary with no changes", () => {
      const diffResult: DiffResult = {
        app: "my-app",
        changeSummary: "",
        changes: [],
        completionStatus: "complete",
        diffSection: "",
        exitCode: 0,
        operation: "diff",
        plannedChanges: 0,
        rawOutput: "No changes",
        stage: "staging",
        success: true,
        truncated: false,
      };

      const summary = formatter.formatOperationSummary(diffResult);

      expect(summary).toContain("Total Changes | 0");
      expect(summary).toContain("✅ No Changes");
      expect(summary).toContain("No infrastructure changes detected");
    });

    it("should format remove summary correctly", () => {
      const removeResult: RemoveResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Cleanup completed",
        removedResources: [
          { name: "Function1", status: "removed", type: "Lambda" },
          { name: "Bucket1", status: "removed", type: "S3" },
        ],
        resourcesRemoved: 10,
        stage: "pr-123",
        success: true,
        truncated: false,
      };

      const summary = formatter.formatOperationSummary(removeResult);

      expect(summary).toContain("🗑️ Cleanup Summary");
      expect(summary).toContain("Resources Removed | 10");
      expect(summary).toContain("Cleanup Status | complete");
      expect(summary).toContain("✅ Complete Cleanup");
      expect(summary).toContain("All resources have been successfully removed");
    });

    it("should format partial remove summary correctly", () => {
      const removeResult: RemoveResult = {
        app: "my-app",
        completionStatus: "partial",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Partial cleanup",
        removedResources: [
          { name: "Function1", status: "removed", type: "Lambda" },
          { name: "Bucket1", status: "failed", type: "S3" },
        ],
        resourcesRemoved: 5,
        stage: "pr-123",
        success: true,
        truncated: false,
      };

      const summary = formatter.formatOperationSummary(removeResult);

      expect(summary).toContain("⚠️ Partial Cleanup");
      expect(summary).toContain("Some resources could not be removed");
    });

    it("should include status badges", () => {
      const successResult: DeployResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "deploy",
        outputs: [],
        rawOutput: "Success",
        resourceChanges: 1,
        resources: [],
        stage: "staging",
        success: true,
        truncated: false,
      };

      const failResult: DeployResult = {
        ...successResult,
        completionStatus: "failed",
        exitCode: 1,
        success: false,
      };

      const successSummary = formatter.formatOperationSummary(successResult);
      const failSummary = formatter.formatOperationSummary(failResult);

      expect(successSummary).toContain(
        "![Success](https://img.shields.io/badge/Status-Success-green)"
      );
      expect(failSummary).toContain(
        "![Failed](https://img.shields.io/badge/Status-Failed-red)"
      );
    });
  });

  describe("resource formatting", () => {
    it("should format resource actions with appropriate icons", () => {
      const deployResult = createMockDeployResult({
        app: "my-app",
        rawOutput: "Deploy completed",
        resourceChanges: 5,
        resources: [
          createMockDeployResource({
            name: "Function1",
            status: "created",
            type: "AWS::Lambda::Function",
          }),
          createMockDeployResource({
            name: "Function2",
            status: "updated",
            type: "AWS::Lambda::Function",
          }),
          createMockDeployResource({
            name: "Table1",
            status: "updated",
            type: "AWS::DynamoDB::Table",
          }),
          createMockDeployResource({
            name: "Bucket1",
            status: "updated",
            type: "AWS::S3::Bucket",
          }),
          createMockDeployResource({
            name: "OldFunction",
            status: "updated",
            type: "AWS::Lambda::Function",
          }),
        ],
        stage: "staging",
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain("🆕 Created");
      expect(comment).toContain("📝 Updated");
    });

    it("should limit displayed resources", () => {
      const deployResult = createMockDeployResult({
        app: "my-app",
        rawOutput: "Deploy completed",
        resourceChanges: 25,
        resources: createMockResourceBatch(25, {
          status: "created",
          type: "AWS::Lambda::Function",
        }),
        stage: "staging",
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain("... and 5 more resources");
    });
  });

  describe("custom configuration", () => {
    it("should respect custom maxUrlsToShow configuration", () => {
      const customFormatter = new OperationFormatter({
        includeDebugInfo: false,
        includeDuration: true,
        includeTimestamp: true,
        maxResourcesToShow: 20,
        maxUrlsToShow: 3,
      });

      const deployResult = createMockDeployResult({
        app: "my-app",
        outputs: Array.from({ length: 7 }, (_, i) => ({
          key: `service${i}`,
          value: `https://service${i}.example.com`,
        })),
        rawOutput: "Deploy completed",
        resourceChanges: 7,
        stage: "staging",
      }) as DeployResult;

      const comment = customFormatter.formatOperationComment(deployResult);

      expect(comment).toContain("... and 4 more outputs");
    });

    it("should respect custom maxResourcesToShow configuration", () => {
      const customFormatter = new OperationFormatter({
        includeDebugInfo: false,
        includeDuration: true,
        includeTimestamp: true,
        maxResourcesToShow: 5,
        maxUrlsToShow: 10,
      });

      const deployResult = createMockDeployResult({
        app: "my-app",
        outputs: [],
        rawOutput: "Deploy completed",
        resourceChanges: 12,
        resources: createMockResourceBatch(12, {
          status: "created",
          type: "AWS::Lambda::Function",
        }),
        stage: "staging",
      }) as DeployResult;

      const comment = customFormatter.formatOperationComment(deployResult);

      expect(comment).toContain("... and 7 more resources");
    });
  });

  describe("edge cases", () => {
    describe("URL detection with short strings", () => {
      it("should handle very short strings without errors", () => {
        const deployResult = createMockDeployResult({
          app: "test-app",
          outputs: [
            { key: "short", value: "a" },
            { key: "empty", value: "" },
            { key: "six", value: "sixchr" },
            { key: "seven", value: "seven!!" },
            { key: "valid_url", value: "https://example.com" },
            { key: "invalid_url", value: "not-a-url" },
          ],
          stage: "test",
        }) as DeployResult;

        const comment = formatter.formatOperationComment(deployResult);

        // Should contain the short values as code blocks (non-URL format)
        expect(comment).toContain("`a`");
        expect(comment).toContain("`sixchr`");
        expect(comment).toContain("`seven!!`");

        // Should format the valid URL as a clickable link
        expect(comment).toContain("[https://example.com](https://example.com)");

        // Should format invalid URL as code block
        expect(comment).toContain("`not-a-url`");
      });

      it("should properly detect edge case URLs", () => {
        const deployResult = createMockDeployResult({
          app: "test-app",
          outputs: [
            { key: "http_min", value: "http://" }, // Exactly 7 characters
            { key: "https_min", value: "https://" }, // Exactly 8 characters
            { key: "http_url", value: "http://example.com" },
            { key: "https_url", value: "https://example.com" },
          ],
          stage: "test",
        }) as DeployResult;

        const comment = formatter.formatOperationComment(deployResult);

        // These minimal URLs are invalid and should be code blocks
        expect(comment).toContain("`http://`");
        expect(comment).toContain("`https://`");

        // These valid URLs should be clickable links
        expect(comment).toContain("[http://example.com](http://example.com)");
        expect(comment).toContain("[https://example.com](https://example.com)");
      });
    });

    describe("URL validation edge cases", () => {
      it("should handle malformed URLs with valid protocols", () => {
        const deployResult = createMockDeployResult({
          app: "test-app",
          outputs: [
            { key: "malformed_spaces", value: "https://not a valid url" },
            { key: "incomplete_http", value: "http://" },
            { key: "incomplete_https", value: "https://" },
            { key: "valid_simple", value: "https://example.com" },
            {
              key: "valid_complex",
              value: "https://api.example.com/v1/endpoint?param=value",
            },
            {
              key: "malformed_brackets",
              value: "https://example.com/path[invalid]",
            },
            { key: "invalid_domain", value: "https://not..valid..domain" },
          ],
          stage: "test",
        }) as DeployResult;

        const comment = formatter.formatOperationComment(deployResult);

        // Malformed URLs should be code blocks, not links
        expect(comment).toContain("`https://not a valid url`");
        expect(comment).toContain("`http://`");
        expect(comment).toContain("`https://`");

        // Valid URLs should be links (URL constructor is more lenient than expected)
        expect(comment).toContain("[https://example.com](https://example.com)");
        expect(comment).toContain(
          "[https://api.example.com/v1/endpoint?param=value](https://api.example.com/v1/endpoint?param=value)"
        );

        // These URLs are considered valid by the URL constructor despite unusual characters
        expect(comment).toContain(
          "[https://example.com/path[invalid]](https://example.com/path[invalid])"
        );
        expect(comment).toContain(
          "[https://not..valid..domain](https://not..valid..domain)"
        );
      });

      it("should handle various URL formats and edge cases", () => {
        const deployResult = createMockDeployResult({
          app: "test-app",
          outputs: [
            { key: "port_url", value: "http://localhost:3000" },
            { key: "ip_url", value: "https://192.168.1.1:8080/api" },
            { key: "subdomain", value: "https://api.staging.example.com" },
            {
              key: "path_query",
              value: "https://example.com/path?q=test&id=123#section",
            },
            {
              key: "encoded_url",
              value: "https://example.com/path%20with%20encoded%20spaces",
            },
            { key: "protocol_only", value: "ftp://example.com" }, // Non-http protocol
          ],
          stage: "test",
        }) as DeployResult;

        const comment = formatter.formatOperationComment(deployResult);

        // Valid HTTP/HTTPS URLs should be links
        expect(comment).toContain(
          "[http://localhost:3000](http://localhost:3000)"
        );
        expect(comment).toContain(
          "[https://192.168.1.1:8080/api](https://192.168.1.1:8080/api)"
        );
        expect(comment).toContain(
          "[https://api.staging.example.com](https://api.staging.example.com)"
        );
        expect(comment).toContain(
          "[https://example.com/path?q=test&id=123#section](https://example.com/path?q=test&id=123#section)"
        );
        expect(comment).toContain(
          "[https://example.com/path%20with%20encoded%20spaces](https://example.com/path%20with%20encoded%20spaces)"
        );

        // Non-HTTP protocols should be code blocks (our protocol check only allows http/https)
        expect(comment).toContain("`ftp://example.com`");
      });
    });

    describe("workflow summaries with edge cases", () => {
      it("should handle short strings in workflow summaries", () => {
        const deployResult = createMockDeployResult({
          app: "test-app",
          outputs: [
            { key: "short", value: "ab" },
            { key: "url", value: "https://api.test.com" },
          ],
          stage: "test",
        }) as DeployResult;

        const summary = formatter.formatOperationSummary(deployResult);

        expect(summary).toContain("`ab`");
        expect(summary).toContain(
          "[https://api.test.com](https://api.test.com)"
        );
      });
    });
  });
});
