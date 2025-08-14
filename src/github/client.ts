/**
 * GitHub API client for PR comments, workflow summaries, and artifact management
 * Handles operation-specific formatting and proper error recovery
 */

import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as io from '@actions/io';
import type { BaseOperationResult, CommentMode } from '../types/index.js';
import { OperationFormatter } from './formatters.js';

/**
 * Comment creation options
 */
interface CommentOptions {
  updateExisting: boolean;
  commentMode: CommentMode;
  identifier?: string;
}

/**
 * Artifact upload options
 */
interface ArtifactOptions {
  name: string;
  retentionDays?: number;
  compressionLevel?: number;
}

/**
 * GitHub client for SST operations integration
 */
export class GitHubClient {
  private readonly octokit: ReturnType<typeof github.getOctokit>;
  private readonly context: typeof github.context;
  private readonly formatter: OperationFormatter;

  constructor(token?: string) {
    const githubToken =
      token || core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error(
        'GitHub token is required. Provide via parameter, github-token input, or GITHUB_TOKEN environment variable.'
      );
    }
    this.octokit = github.getOctokit(githubToken);
    this.context = github.context;
    this.formatter = new OperationFormatter();
  }

  /**
   * Post a PR comment (simplified interface for operations)
   */
  async postPRComment(comment: string, operationType: string): Promise<void> {
    if (!this.context.payload.pull_request) {
      core.debug('Not in PR context, skipping comment creation');
      return;
    }

    const commentWithMarker = `<!-- sst-${operationType} -->\n${comment}`;

    try {
      await this.octokit.rest.issues.createComment({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request?.number || 0,
        body: commentWithMarker,
      });
      core.info(`Successfully posted ${operationType} PR comment`);
    } catch (error) {
      throw new Error(
        `GitHub API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
      updateExisting: true,
      commentMode,
      identifier: `sst-${result.operation}`,
      ...options,
    };

    try {
      const commentBody = this.formatComment(result);

      if (commentOptions.updateExisting && this.context.payload.pull_request) {
        if (!commentOptions.identifier) {
          throw new Error(
            'Comment identifier is required when updateExisting is true'
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
   * Upload artifacts for debugging purposes
   */
  async uploadArtifacts(
    result: BaseOperationResult,
    options: Partial<ArtifactOptions> = {}
  ): Promise<void> {
    const artifactOptions: ArtifactOptions = {
      name: `sst-${result.operation}-${result.stage}-${Date.now()}`,
      retentionDays: 30,
      compressionLevel: 6,
      ...options,
    };

    try {
      const tempDir = join(tmpdir(), 'sst-artifacts');
      await io.mkdirP(tempDir);

      // Create result file
      const resultFile = join(tempDir, 'result.json');
      await writeFile(resultFile, JSON.stringify(result, null, 2));

      // Create raw output file
      const outputFile = join(tempDir, 'output.txt');
      await writeFile(outputFile, result.rawOutput);

      // Create metadata file
      const metadataFile = join(tempDir, 'metadata.json');
      await writeFile(
        metadataFile,
        JSON.stringify(
          {
            operation: result.operation,
            stage: result.stage,
            app: result.app,
            timestamp: new Date().toISOString(),
            success: result.success,
            exitCode: result.exitCode,
            duration: this.calculateDuration(result),
            truncated: result.truncated,
          },
          null,
          2
        )
      );

      // Upload artifacts
      const artifactClient = new DefaultArtifactClient();
      const uploadResponse = await artifactClient.uploadArtifact(
        artifactOptions.name,
        [resultFile, outputFile, metadataFile],
        tempDir,
        artifactOptions.retentionDays !== undefined
          ? {
              retentionDays: artifactOptions.retentionDays,
            }
          : {}
      );

      core.info(
        `Uploaded artifact: ${artifactOptions.name} (${uploadResponse.size} bytes)`
      );
    } catch (error) {
      core.warning(
        `Failed to upload artifacts: ${error instanceof Error ? error.message : String(error)}`
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
      case 'always':
        return true;
      case 'on-success':
        return result.success;
      case 'on-failure':
        return !result.success;
      case 'never':
        return false;
      default:
        core.warning(
          `Unknown comment mode: ${mode}. Defaulting to 'on-success'`
        );
        return result.success;
    }
  }

  /**
   * Format comment based on operation type and result
   */
  private formatComment(result: BaseOperationResult): string {
    // Use OperationFormatter for the main content
    const mainContent = this.formatter.formatOperationComment(result);

    return mainContent;
  }

  /**
   * Create a new comment
   */
  private async createComment(body: string): Promise<void> {
    if (!this.context.payload.pull_request) {
      core.debug('Not in PR context, skipping comment creation');
      return;
    }

    await this.octokit.rest.issues.createComment({
      ...this.context.repo,
      issue_number: this.context.payload.pull_request?.number || 0,
      body,
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
      core.debug('Not in PR context, skipping comment update');
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
        comment_id: existingComment.id,
        body: commentWithMarker,
      });
    } else {
      // Create new comment
      await this.octokit.rest.issues.createComment({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request?.number || 0,
        body: commentWithMarker,
      });
    }
  }

  /**
   * Calculate operation duration (stub - would need start time in result)
   */
  private calculateDuration(_result: BaseOperationResult): number {
    // This would ideally come from the result object
    // For now, return 0 as placeholder
    return 0;
  }
}

/**
 * Create GitHub client instance
 */
export function createGitHubClient(token: string): GitHubClient {
  return new GitHubClient(token);
}
