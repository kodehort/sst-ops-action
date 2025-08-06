/**
 * GitHub API client for PR comments, workflow summaries, and artifact management
 * Handles operation-specific formatting and proper error recovery
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import type {
  BaseOperationResult,
  CommentMode,
  DeployResult,
  DiffResult,
  RemoveResult,
} from '../types/index.js';

/**
 * GitHub API rate limiting configuration
 */
interface RateLimitConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

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
  private readonly rateLimitConfig: RateLimitConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30_000,
    backoffFactor: 2,
  };

  constructor() {
    this.octokit = github.getOctokit(token);
    this.context = github.context;
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
        await this.updateOrCreateComment(
          commentBody,
          commentOptions.identifier!
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
      const summaryContent = this.formatSummary(result);

      await core.summary
        .addHeading(`SST ${result.operation.toUpperCase()} Summary`, 2)
        .addRaw(summaryContent)
        .addSeparator()
        .addRaw(this.formatExecutionDetails(result))
        .write();

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
      await mkdir(tempDir, { recursive: true });

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
      const artifactClient = artifact.create();
      const uploadResponse = await artifactClient.uploadArtifact(
        artifactOptions.name,
        [resultFile, outputFile, metadataFile],
        tempDir,
        {
          retentionDays: artifactOptions.retentionDays,
          compressionLevel: artifactOptions.compressionLevel,
        }
      );

      core.info(
        `Uploaded artifact: ${uploadResponse.artifactName} (${uploadResponse.size} bytes)`
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
    const header = this.formatCommentHeader(result);
    const content = this.formatOperationContent(result);
    const footer = this.formatCommentFooter(result);

    return `${header}\n\n${content}\n\n${footer}`;
  }

  /**
   * Format comment header with status and basic info
   */
  private formatCommentHeader(result: BaseOperationResult): string {
    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? 'SUCCESS' : 'FAILED';
    const operationName = result.operation.toUpperCase();

    return `## ${statusIcon} SST ${operationName} ${statusText}

**Stage:** \`${result.stage}\`  
**App:** \`${result.app || 'Unknown'}\`  
**Status:** \`${result.completionStatus}\``;
  }

  /**
   * Format operation-specific content
   */
  private formatOperationContent(result: BaseOperationResult): string {
    switch (result.operation) {
      case 'deploy':
        return this.formatDeployContent(result as DeployResult);
      case 'diff':
        return this.formatDiffContent(result as DiffResult);
      case 'remove':
        return this.formatRemoveContent(result as RemoveResult);
      default:
        return this.formatGenericContent(result);
    }
  }

  /**
   * Format deploy operation content
   */
  private formatDeployContent(result: DeployResult): string {
    let content = `### Deployment Results

**Resource Changes:** ${result.resourceChanges || 0}`;

    if (result.urls && result.urls.length > 0) {
      content += '\n**Deployed URLs:**\n';
      for (const url of result.urls) {
        content += `- [${url.type}](${url.url})\n`;
      }
    }

    if (result.permalink) {
      content += `\n**Console:** [View in SST Console](${result.permalink})`;
    }

    return content;
  }

  /**
   * Format diff operation content
   */
  private formatDiffContent(result: DiffResult): string {
    let content = '### Infrastructure Changes Preview';

    if (result.diffSummary) {
      content += `\n\n${result.diffSummary}`;
    } else {
      content += '\n\nNo changes detected.';
    }

    return content;
  }

  /**
   * Format remove operation content
   */
  private formatRemoveContent(result: RemoveResult): string {
    let content = `### Resource Cleanup

**Resources Removed:** ${result.resourceChanges || 0}`;

    if (result.completionStatus === 'partial') {
      content +=
        '\n\n⚠️ **Partial cleanup completed.** Some resources may still exist.';
    } else if (result.completionStatus === 'complete') {
      content += '\n\n✅ **All resources successfully removed.**';
    }

    return content;
  }

  /**
   * Format generic content for unknown operations
   */
  private formatGenericContent(result: BaseOperationResult): string {
    return `### Operation Results

**Exit Code:** ${result.exitCode}  
**Duration:** ${this.calculateDuration(result)}ms`;
  }

  /**
   * Format comment footer with execution details
   */
  private formatCommentFooter(result: BaseOperationResult): string {
    const duration = this.calculateDuration(result);
    const timestamp = new Date().toISOString();

    let footer = `---
*Executed at ${timestamp}*`;

    if (duration) {
      footer += ` *• Duration: ${duration}ms*`;
    }

    if (result.truncated) {
      footer += ' *• Output truncated*';
    }

    return footer;
  }

  /**
   * Format workflow summary content
   */
  private formatSummary(result: BaseOperationResult): string {
    const statusIcon = result.success ? '✅' : '❌';

    let summary = `${statusIcon} **${result.operation.toUpperCase()}** operation ${result.success ? 'completed successfully' : 'failed'}

| Property | Value |
|----------|-------|
| Stage | \`${result.stage}\` |
| App | \`${result.app || 'Unknown'}\` |
| Status | \`${result.completionStatus}\` |
| Exit Code | \`${result.exitCode}\` |`;

    // Add operation-specific details
    if (result.operation === 'deploy') {
      const deployResult = result as DeployResult;
      summary += `
| Resource Changes | \`${deployResult.resourceChanges || 0}\` |`;

      if (deployResult.urls && deployResult.urls.length > 0) {
        summary += `
| URLs | ${deployResult.urls.length} deployed |`;
      }
    }

    if (result.permalink) {
      summary += `
| Console | [View in SST Console](${result.permalink}) |`;
    }

    return summary;
  }

  /**
   * Format execution details for summary
   */
  private formatExecutionDetails(result: BaseOperationResult): string {
    const duration = this.calculateDuration(result);

    let details = `### Execution Details

- **Duration:** ${duration}ms
- **Truncated:** ${result.truncated ? 'Yes' : 'No'}`;

    if (result.error) {
      details += `
- **Error:** ${result.error}`;
    }

    return details;
  }

  /**
   * Create a new comment
   */
  private async createComment(body: string): Promise<void> {
    if (!this.context.payload.pull_request) {
      core.debug('Not in PR context, skipping comment creation');
      return;
    }

    await this.withRateLimit(async () => {
      await this.octokit.rest.issues.createComment({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request?.number,
        body,
      });
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

    await this.withRateLimit(async () => {
      // Find existing comment
      const comments = await this.octokit.rest.issues.listComments({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request?.number,
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
          issue_number: this.context.payload.pull_request?.number,
          body: commentWithMarker,
        });
      }
    });
  }

  /**
   * Execute API call with rate limiting and retry logic
   */
  private async withRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (
      let attempt = 1;
      attempt <= this.rateLimitConfig.maxRetries;
      attempt++
    ) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error
        if (this.isRateLimitError(lastError)) {
          const delay = Math.min(
            this.rateLimitConfig.baseDelay *
              this.rateLimitConfig.backoffFactor ** (attempt - 1),
            this.rateLimitConfig.maxDelay
          );

          core.warning(
            `Rate limited, retrying in ${delay}ms (attempt ${attempt}/${this.rateLimitConfig.maxRetries})`
          );
          await this.sleep(delay);
          continue;
        }

        // For non-rate-limit errors, don't retry
        throw lastError;
      }
    }

    throw lastError || new Error('Rate limit retry attempts exhausted');
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: Error): boolean {
    return (
      error.message.includes('rate limit') ||
      error.message.includes('403') ||
      error.message.includes('API rate limit exceeded')
    );
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
