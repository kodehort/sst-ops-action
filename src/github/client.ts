/**
 * GitHub API client for PR comments and workflow summaries
 *
 * It decides two things: whether a result warrants a comment, and whether that
 * comment is a new one or an edit of the one it left last time. Everything the
 * comment says comes from OperationFormatter.
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import type { BaseOperationResult, CommentMode } from "../types/index.js";
import { OperationFormatter } from "./formatters.js";

/**
 * Comment creation options
 */
interface CommentOptions {
  commentMode: CommentMode;
  identifier?: string;
  updateExisting: boolean;
}

/**
 * GitHub client for SST operations integration
 */
export class GitHubClient {
  private readonly octokit: ReturnType<typeof github.getOctokit>;
  private readonly context: typeof github.context;
  private readonly formatter: OperationFormatter;

  /**
   * @param token Required. Input resolution owns the credential: `token` is a
   *   required action input that the schema rejects when empty, so by the time
   *   a client is constructed there is a token. This used to fall back to a
   *   `github-token` input and then to `process.env.GITHUB_TOKEN` — the first
   *   names an input the action does not declare, and the second could only be
   *   reached on a path validation had already rejected.
   */
  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.context = github.context;
    this.formatter = new OperationFormatter();
  }

  /**
   * Create or update PR comment based on operation result
   */
  async createOrUpdateComment(
    result: BaseOperationResult,
    commentMode: CommentMode,
    options: Partial<CommentOptions> = {}
  ): Promise<void> {
    if (!this.shouldComment(result, commentMode)) {
      core.debug(
        `Skipping comment creation. Mode: ${commentMode}, Success: ${result.success}`
      );
      return;
    }

    const commentOptions: CommentOptions = {
      commentMode,
      identifier: `sst-${result.operation}`,
      updateExisting: true,
      ...options,
    };

    try {
      const commentBody = this.formatter.formatOperationComment(result);

      if (commentOptions.updateExisting && this.context.payload.pull_request) {
        if (!commentOptions.identifier) {
          throw new Error(
            "Comment identifier is required when updateExisting is true"
          );
        }
        await this.updateOrCreateComment(
          commentBody,
          commentOptions.identifier
        );
      } else {
        await this.createComment(commentBody);
      }

      core.info(`Successfully created/updated ${result.operation} comment`);
    } catch (error) {
      core.warning(
        `Failed to create comment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create workflow summary with rich markdown formatting
   */
  async createWorkflowSummary(result: BaseOperationResult): Promise<void> {
    try {
      const summaryContent = this.formatter.formatOperationSummary(result);

      await core.summary.addRaw(summaryContent).write();

      core.info(
        `Successfully created workflow summary for ${result.operation}`
      );
    } catch (error) {
      core.warning(
        `Failed to create workflow summary: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Determine if a comment should be posted based on result and mode
   */
  private shouldComment(
    result: BaseOperationResult,
    mode: CommentMode
  ): boolean {
    switch (mode) {
      case "always":
        return true;
      case "on-success":
        return result.success;
      case "on-failure":
        return !result.success;
      case "never":
        return false;
      default: {
        const _exhaustive: never = mode;
        core.warning(
          `Unknown comment mode: ${_exhaustive}. Defaulting to 'on-success'`
        );
        return result.success;
      }
    }
  }

  /**
   * Create a new comment
   */
  private async createComment(body: string): Promise<void> {
    if (!this.context.payload.pull_request) {
      core.debug("Not in PR context, skipping comment creation");
      return;
    }

    await this.octokit.rest.issues.createComment({
      ...this.context.repo,
      body,
      issue_number: this.context.payload.pull_request?.number || 0,
    });
  }

  /**
   * Update existing comment or create new one
   */
  private async updateOrCreateComment(
    body: string,
    identifier: string
  ): Promise<void> {
    if (!this.context.payload.pull_request) {
      core.debug("Not in PR context, skipping comment update");
      return;
    }

    const commentMarker = `<!-- ${identifier} -->`;
    const commentWithMarker = `${commentMarker}\n${body}`;

    // Find existing comment
    const comments = await this.octokit.rest.issues.listComments({
      ...this.context.repo,
      issue_number: this.context.payload.pull_request?.number || 0,
    });

    const existingComment = comments.data.find((comment) =>
      comment.body?.includes(commentMarker)
    );

    if (existingComment) {
      // Update existing comment
      await this.octokit.rest.issues.updateComment({
        ...this.context.repo,
        body: commentWithMarker,
        comment_id: existingComment.id,
      });
    } else {
      // Create new comment
      await this.octokit.rest.issues.createComment({
        ...this.context.repo,
        body: commentWithMarker,
        issue_number: this.context.payload.pull_request?.number || 0,
      });
    }
  }
}
