/**
 * Remove Operation Implementation
 * Handles SST remove command execution with resource cleanup tracking and GitHub integration
 */

import type { GitHubClient } from '../github/client';
import { RemoveParser } from '../parsers/remove-parser';
import type { OperationOptions, RemoveResult } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';
import { handleGitHubIntegrationError } from '../utils/github-actions';

/**
 * Remove operation handler for SST resource cleanup
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class RemoveOperation {
  private readonly defaultTimeout = 900_000; // 15 minutes
  private readonly sstExecutor: SSTCLIExecutor;
  private readonly githubClient: GitHubClient;

  constructor(sstExecutor: SSTCLIExecutor, githubClient: GitHubClient) {
    this.sstExecutor = sstExecutor;
    this.githubClient = githubClient;
  }

  /**
   * Execute SST remove operation with full workflow
   * @param options Operation configuration options
   * @returns Parsed remove result with resource cleanup information
   */
  async execute(options: OperationOptions): Promise<RemoveResult> {
    // Execute SST CLI command
    const cliResult = await this.sstExecutor.executeSST(
      'remove',
      options.stage,
      {
        timeout: this.defaultTimeout,
        maxOutputSize: options.maxOutputSize,
        runner: options.runner,
      }
    );

    // Parse CLI output using RemoveParser
    const parser = new RemoveParser();
    const result = parser.parse(
      cliResult.output,
      options.stage,
      cliResult.exitCode
    );

    // Perform GitHub integration in parallel (non-blocking)
    await this.performGitHubIntegration(result, options);

    return result;
  }

  /**
   * Perform GitHub integration tasks (comments and summaries)
   * Handles errors gracefully to not fail the entire operation
   * @param result Parsed remove result
   * @param options Operation options
   */
  private async performGitHubIntegration(
    result: RemoveResult,
    options: OperationOptions
  ): Promise<void> {
    const integrationPromises: Promise<void>[] = [];

    // Create PR comment (if enabled)
    integrationPromises.push(
      this.githubClient
        .createOrUpdateComment(result, options.commentMode || 'never')
        .catch((error) => handleGitHubIntegrationError(error, 'comment'))
    );

    // Create workflow summary
    integrationPromises.push(
      this.githubClient
        .createWorkflowSummary(result)
        .catch((error) =>
          handleGitHubIntegrationError(error, 'workflow summary')
        )
    );

    // Wait for all GitHub integration tasks to complete
    await Promise.allSettled(integrationPromises);
  }
}
