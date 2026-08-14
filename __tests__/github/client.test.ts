/**
 * The client makes two decisions: whether to comment, and whether that comment
 * is new or an edit of the one it left last time.
 *
 * The formatter is mocked to a sentinel so those decisions are what the
 * assertions turn on. These tests previously matched rendered markdown —
 * "🚀 DEPLOY SUCCESS", table rows, resource counts — so a copy edit to a
 * comment template broke them, and nothing isolated the decision. The prose
 * belongs to `formatters.test.ts`, which asserts it directly.
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/github/client.js";
import type {
  BaseOperationResult,
  CommentMode,
} from "../../src/types/index.js";

const { COMMENT_BODY, SUMMARY_BODY } = vi.hoisted(() => ({
  COMMENT_BODY: "<<formatted comment>>",
  SUMMARY_BODY: "<<formatted summary>>",
}));

// A real class, not `vi.fn().mockImplementation`: the client constructs the
// formatter, and `vi.clearAllMocks()` in beforeEach strips the implementation
// off a mock constructor, leaving `new` returning undefined.
vi.mock("../../src/github/formatters.js", () => ({
  OperationFormatter: class {
    formatOperationComment() {
      return COMMENT_BODY;
    }
    formatOperationSummary() {
      return SUMMARY_BODY;
    }
  },
}));

const mockOctokit = {
  rest: {
    issues: {
      createComment: vi.fn(),
      listComments: vi.fn(),
      updateComment: vi.fn(),
    },
  },
};

vi.mock("@actions/github", () => ({
  context: {
    payload: {
      pull_request: { number: 123 },
    },
    repo: { owner: "test-owner", repo: "test-repo" },
  },
  getOctokit: vi.fn(),
}));

const mockSummary = {
  addRaw: vi.fn().mockReturnThis(),
  write: vi.fn().mockResolvedValue(undefined),
};

const REPO = { owner: "test-owner", repo: "test-repo" };

/**
 * The client reads only `operation` and `success` off a result; the rest goes
 * straight to the formatter, which is mocked. `BaseOperationResult` is
 * therefore the honest parameter type for these fixtures.
 */
const succeeded: BaseOperationResult = {
  app: "test-app",
  completionStatus: "complete",
  exitCode: 0,
  operation: "deploy",
  rawOutput: "",
  stage: "staging",
  success: true,
  truncated: false,
};

const failed: BaseOperationResult = {
  ...succeeded,
  completionStatus: "failed",
  error: "Deployment failed",
  exitCode: 1,
  success: false,
};

describe("GitHubClient", () => {
  let client: GitHubClient;
  const token = "ghp_test_token";

  beforeEach(() => {
    vi.clearAllMocks();

    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
    (github.getOctokit as any).mockReturnValue(mockOctokit);
    mockSummary.addRaw.mockReturnThis();
    mockSummary.write.mockResolvedValue(undefined);
    (core as any).summary = mockSummary;

    client = new GitHubClient(token);
  });

  it("authenticates with the token it is given", () => {
    expect(github.getOctokit).toHaveBeenCalledWith(token);
  });

  describe("the decision to comment", () => {
    const cases: Array<{
      comments: boolean;
      mode: CommentMode;
      succeeds: boolean;
    }> = [
      { comments: true, mode: "always", succeeds: true },
      { comments: true, mode: "always", succeeds: false },
      { comments: true, mode: "on-success", succeeds: true },
      { comments: false, mode: "on-success", succeeds: false },
      { comments: false, mode: "on-failure", succeeds: true },
      { comments: true, mode: "on-failure", succeeds: false },
      { comments: false, mode: "never", succeeds: true },
      { comments: false, mode: "never", succeeds: false },
    ];

    for (const { comments, mode, succeeds } of cases) {
      const outcome = succeeds ? "a success" : "a failure";
      const verb = comments ? "comments" : "stays silent";

      it(`${verb} on ${outcome} in "${mode}" mode`, async () => {
        await client.createOrUpdateComment(succeeds ? succeeded : failed, mode);

        expect(
          mockOctokit.rest.issues.createComment.mock.calls.length > 0
        ).toBe(comments);
      });
    }

    it("warns and falls back to on-success behaviour for an unknown mode", async () => {
      await client.createOrUpdateComment(failed, "sometimes" as CommentMode);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Unknown comment mode: sometimes")
      );
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe("the upsert", () => {
    it("creates a marked comment when none carries the marker", async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [{ body: "an unrelated comment", id: 1 }],
      });

      await client.createOrUpdateComment(succeeded, "always");

      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        ...REPO,
        body: `<!-- sst-deploy -->\n${COMMENT_BODY}`,
        issue_number: 123,
      });
    });

    it("edits the comment carrying the marker rather than adding another", async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          { body: "an unrelated comment", id: 1 },
          { body: "<!-- sst-deploy -->\nthe previous run", id: 456 },
        ],
      });

      await client.createOrUpdateComment(succeeded, "always");

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        ...REPO,
        body: `<!-- sst-deploy -->\n${COMMENT_BODY}`,
        comment_id: 456,
      });
    });

    it("marks the comment per operation, so operations do not overwrite each other", async () => {
      await client.createOrUpdateComment(
        { ...succeeded, operation: "diff" },
        "always"
      );

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("<!-- sst-diff -->"),
        })
      );
    });

    it("adds an unmarked comment when told not to update", async () => {
      await client.createOrUpdateComment(succeeded, "always", {
        updateExisting: false,
      });

      expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        ...REPO,
        body: COMMENT_BODY,
        issue_number: 123,
      });
    });

    it("does nothing outside a pull request", async () => {
      const { payload } = (github as any).context;
      (github as any).context.payload = {};

      try {
        await new GitHubClient(token).createOrUpdateComment(
          succeeded,
          "always"
        );

        expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
        expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
      } finally {
        (github as any).context.payload = payload;
      }
    });

    it("warns rather than failing the operation when the API rejects it", async () => {
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error("API Error")
      );

      await expect(
        client.createOrUpdateComment(succeeded, "always")
      ).resolves.toBeUndefined();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create comment: API Error")
      );
    });
  });

  describe("the workflow summary", () => {
    it("writes what the formatter produced", async () => {
      await client.createWorkflowSummary(succeeded);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(SUMMARY_BODY);
      expect(mockSummary.write).toHaveBeenCalled();
    });

    it("warns rather than failing the operation when the write fails", async () => {
      mockSummary.write.mockRejectedValue(new Error("Summary error"));

      await expect(
        client.createWorkflowSummary(succeeded)
      ).resolves.toBeUndefined();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create workflow summary")
      );
    });
  });
});
