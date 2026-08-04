import { DefaultArtifactClient } from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubClient, GitHubClient } from "../../src/github/client.js";
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
} from "../../src/types/index.js";
import { createMockDeployResult } from "../utils/test-types.js";

// Mock GitHub API client
const mockOctokit = {
  rest: {
    issues: {
      createComment: vi.fn(),
      listComments: vi.fn(),
      updateComment: vi.fn(),
    },
  },
};

// Mock github module
vi.mock("@actions/github", () => ({
  context: {
    payload: {
      pull_request: { number: 123 },
    },
    repo: { owner: "test-owner", repo: "test-repo" },
  },
  getOctokit: vi.fn(),
}));

// Mock summary
const mockSummary = {
  addHeading: vi.fn().mockReturnThis(),
  addRaw: vi.fn().mockReturnThis(),
  addSeparator: vi.fn().mockReturnThis(),
  write: vi.fn().mockResolvedValue(undefined),
};

describe("GitHub Client - API Integration", () => {
  let client: GitHubClient;
  const mockToken = "ghp_test_token";

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behaviors
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] } as any);

    // Setup github mock
    (github.getOctokit as any).mockReturnValue(mockOctokit);

    // Setup core summary mock - core is already mocked in setup.ts
    (core as any).summary = mockSummary as any;

    client = new GitHubClient(mockToken);
  });

  describe("constructor", () => {
    it("should initialize with GitHub token", () => {
      expect(github.getOctokit).toHaveBeenCalledWith(mockToken);
    });
  });

  describe("createOrUpdateComment", () => {
    const mockDeployResult = createMockDeployResult({
      app: "test-app",
      outputs: [
        { key: "app", value: "https://app.example.com" },
        { key: "api", value: "https://api.example.com" },
      ],
      permalink: "https://console.sst.dev/test-app/staging",
      rawOutput: "Deploy successful",
      resourceChanges: 3,
      stage: "staging",
    }) as DeployResult;

    it('should create comment when comment mode is "always"', async () => {
      await client.createOrUpdateComment(mockDeployResult, "always");

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        body: expect.stringContaining("🚀 DEPLOY SUCCESS"),
        issue_number: 123,
        owner: "test-owner",
        repo: "test-repo",
      });
    });

    it('should create comment on success when mode is "on-success"', async () => {
      await client.createOrUpdateComment(mockDeployResult, "on-success");

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    });

    it('should not create comment on success when mode is "on-failure"', async () => {
      await client.createOrUpdateComment(mockDeployResult, "on-failure");

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it('should create comment on failure when mode is "on-failure"', async () => {
      const failedResult: DeployResult = {
        ...mockDeployResult,
        completionStatus: "failed",
        error: "Deployment failed",
        exitCode: 1,
        success: false,
      };

      await client.createOrUpdateComment(failedResult, "on-failure");

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        body: expect.stringContaining("❌ DEPLOY FAILED"),
        issue_number: 123,
        owner: "test-owner",
        repo: "test-repo",
      });
    });

    it('should not create comment when mode is "never"', async () => {
      await client.createOrUpdateComment(mockDeployResult, "never");

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it("should update existing comment instead of creating new one", async () => {
      const existingComment = {
        body: "<!-- sst-deploy -->\nOld comment content",
        id: 456,
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [existingComment],
      } as any);

      await client.createOrUpdateComment(mockDeployResult, "always", {
        updateExisting: true,
      });

      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        body: expect.stringContaining("<!-- sst-deploy -->"),
        comment_id: 456,
        owner: "test-owner",
        repo: "test-repo",
      });
    });

    it("should handle API errors gracefully", async () => {
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error("API Error")
      );

      await client.createOrUpdateComment(mockDeployResult, "always");

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create comment")
      );
    });

    it("should skip comment creation when not in PR context", async () => {
      // Temporarily modify the github context for this test
      const originalPayload = (github as any).context.payload;
      (github as any).context.payload = {};

      const testClient = new GitHubClient(mockToken);
      await testClient.createOrUpdateComment(mockDeployResult, "always");

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();

      // Restore original payload
      (github as any).context.payload = originalPayload;
    });
  });

  describe("createWorkflowSummary", () => {
    const mockDiffResult: DiffResult = {
      app: "test-app",
      changeSummary: "No infrastructure changes detected",
      changes: [],
      completionStatus: "complete",
      exitCode: 0,
      operation: "diff",
      plannedChanges: 0,
      rawOutput: "No changes detected",
      stage: "staging",
      success: true,
      truncated: false,
    };

    it("should create workflow summary for successful operation", async () => {
      await client.createWorkflowSummary(mockDiffResult);

      expect(mockSummary.addHeading).not.toHaveBeenCalled();
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining("🔍 Infrastructure Diff Summary")
      );
      expect(mockSummary.write).toHaveBeenCalled();
    });

    it("should create workflow summary for failed operation", async () => {
      const failedResult: DiffResult = {
        ...mockDiffResult,
        completionStatus: "failed",
        error: "Operation failed",
        exitCode: 1,
        success: false,
      };

      await client.createWorkflowSummary(failedResult);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining(
          "![Failed](https://img.shields.io/badge/Status-Failed-red)"
        )
      );
    });

    it("should handle summary creation errors gracefully", async () => {
      mockSummary.write.mockRejectedValue(new Error("Summary error"));

      await client.createWorkflowSummary(mockDiffResult);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create workflow summary")
      );
    });
  });

  describe("uploadArtifacts", () => {
    const mockRemoveResult: RemoveResult = {
      app: "test-app",
      completionStatus: "complete",
      exitCode: 0,
      operation: "remove",
      rawOutput: "Resources removed successfully",
      removedResources: [],
      resourcesRemoved: 5,
      stage: "pr-123",
      success: true,
      truncated: false,
    };

    it("should upload artifacts successfully", async () => {
      await client.uploadArtifacts(mockRemoveResult);

      // Verify DefaultArtifactClient constructor was called
      expect(DefaultArtifactClient).toHaveBeenCalled();
    });

    it("should use custom artifact options", async () => {
      await client.uploadArtifacts(mockRemoveResult, {
        compressionLevel: 9,
        name: "custom-artifact",
        retentionDays: 7,
      });

      // Verify DefaultArtifactClient constructor was called
      expect(DefaultArtifactClient).toHaveBeenCalled();
    });

    it("should handle upload errors gracefully", async () => {
      // Create a new mock implementation that throws an error
      const failingArtifactClient = {
        uploadArtifact: vi.fn().mockRejectedValue(new Error("Upload failed")),
      };

      // Mock DefaultArtifactClient to return our failing instance
      (DefaultArtifactClient as any).mockReturnValueOnce(
        failingArtifactClient as any
      );

      await client.uploadArtifacts(mockRemoveResult);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Failed to upload artifacts")
      );
    });
  });

  describe("comment content formatting", () => {
    it("should format deploy comment with URLs and resource changes", async () => {
      const deployResult: DeployResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "deploy",
        outputs: [
          { key: "app", value: "https://my-app.com" },
          { key: "api", value: "https://api.my-app.com" },
        ],
        permalink: "https://console.sst.dev/my-app/production",
        rawOutput: "Deploy completed",
        resourceChanges: 5,
        resources: [],
        stage: "production",
        success: true,
        truncated: false,
      };

      await client.createOrUpdateComment(deployResult, "always");

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0]?.[0]?.body;
      expect(commentBody).toContain("DEPLOY SUCCESS");
      expect(commentBody).toContain("| Stage | `production` |");
      expect(commentBody).toContain("| App | `my-app` |");
      expect(commentBody).toContain("**Total Changes:** 5");
      expect(commentBody).toContain("https://my-app.com");
      expect(commentBody).toContain("https://api.my-app.com");
      expect(commentBody).toContain(
        "https://console.sst.dev/my-app/production"
      );
    });

    it("should format diff comment with changes summary", async () => {
      const diffResult: DiffResult = {
        app: "my-app",
        changeSummary: "3 resources to create, 2 to update",
        changes: [
          { action: "create", name: "Function1", type: "Lambda" },
          { action: "update", name: "Bucket1", type: "S3" },
        ],
        completionStatus: "complete",
        exitCode: 0,
        operation: "diff",
        plannedChanges: 5,
        rawOutput: "Diff completed",
        stage: "staging",
        success: true,
        truncated: false,
      };

      await client.createOrUpdateComment(diffResult, "always");

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0]?.[0]?.body;
      expect(commentBody).toContain("🔍 DIFF SUCCESS");
      expect(commentBody).toContain("3 resources to create, 2 to update");
    });

    it("should format remove comment with cleanup status", async () => {
      const removeResult: RemoveResult = {
        app: "my-app",
        completionStatus: "complete",
        exitCode: 0,
        operation: "remove",
        rawOutput: "Cleanup completed",
        removedResources: [
          { name: "TestFunction", status: "removed", type: "Lambda" },
          { name: "TestBucket", status: "removed", type: "S3" },
        ],
        resourcesRemoved: 8,
        stage: "pr-123",
        success: true,
        truncated: false,
      };

      await client.createOrUpdateComment(removeResult, "always");

      const commentBody =
        mockOctokit.rest.issues.createComment.mock.calls[0]?.[0]?.body;
      expect(commentBody).toContain("🗑️ REMOVE SUCCESS");
      expect(commentBody).toContain("Resources cleaned up: 8");
      expect(commentBody).toContain("All resources successfully removed");
    });
  });
});

describe("createGitHubClient", () => {
  it("should create a GitHubClient instance", () => {
    const token = "test-token";
    const client = createGitHubClient(token);

    expect(client).toBeInstanceOf(GitHubClient);
    expect(github.getOctokit).toHaveBeenCalledWith(token);
  });
});
