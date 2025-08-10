/**
 * Stage Operation Implementation
 * Handles stage calculation based on GitHub context without SST CLI execution
 */

import type { GitHubClient } from '../github/client';
import { StageParser } from '../parsers/stage-parser';
import type { OperationOptions, StageResult } from '../types';

/**
 * Stage operation handler for computing SST stage names
 * Combines GitHub context processing with output formatting
 */
export class StageOperation {
  private readonly githubClient: GitHubClient;

  constructor(_sstExecutor: unknown, githubClient: GitHubClient) {
    // Note: Stage operation doesn't use SST CLI, but we maintain the same constructor signature
    this.githubClient = githubClient;
  }

  /**
   * Execute stage calculation operation
   * @param options Operation configuration options
   * @returns Parsed stage result with computed stage name
   */
  async execute(options: OperationOptions): Promise<StageResult> {
    // Parse stage using GitHub context (no SST CLI execution needed)
    const parser = new StageParser();
    const result = parser.parse(
      '', // No CLI output for stage operation
      options.stage, // Use provided stage as fallback
      0, // Stage operation should always succeed with exit code 0
      options.maxOutputSize,
      options.truncationLength,
      options.prefix
    );

    // Perform GitHub integration in parallel (non-blocking)
    await this.performGitHubIntegration(result, options);

    return result;
  }

  /**
   * Perform GitHub integration tasks (comments and summaries)
   * Handles errors gracefully to not fail the entire operation
   * @param result Parsed stage result
   * @param options Operation options
   */
  private async performGitHubIntegration(
    result: StageResult,
    options: OperationOptions
  ): Promise<void> {
    const integrationPromises: Promise<void>[] = [];

    // Create PR comment (if enabled)
    integrationPromises.push(
      this.githubClient
        .createOrUpdateComment(result, options.commentMode || 'never')
        .catch(() => {
          // GitHub comment integration is non-critical, ignore errors
        })
    );

    // Create workflow summary
    integrationPromises.push(
      this.githubClient.createWorkflowSummary(result).catch(() => {
        // Workflow summary integration is non-critical, ignore errors
      })
    );

    // Wait for all GitHub integration tasks to complete
    await Promise.allSettled(integrationPromises);
  }
}
