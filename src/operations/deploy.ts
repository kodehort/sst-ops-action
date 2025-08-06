/**
 * Deploy Operation Implementation
 * Handles SST deploy command execution with resource tracking and GitHub integration
 */

import type { GitHubClient } from '../github/client';
import { DeployParser } from '../parsers/deploy-parser';
import type { DeployResult, OperationOptions } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';

/**
 * Deploy operation handler for SST deployments
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class DeployOperation {
  private readonly defaultTimeout = 900_000; // 15 minutes

  constructor(
    private readonly sstExecutor: SSTCLIExecutor,
    private readonly githubClient: GitHubClient
  ) {}

  /**
   * Execute SST deploy operation with full workflow
   * @param options Operation configuration options
   * @returns Parsed deployment result with resource and URL information
   */
  async execute(options: OperationOptions): Promise<DeployResult> {
    try {
      // Execute SST CLI command
      const cliResult = await this.sstExecutor.executeSST(
        'deploy',
        options.stage,
        {
          env: this.buildEnvironment(options),
          timeout: this.defaultTimeout,
          maxOutputSize: options.maxOutputSize,
        }
      );

      // Parse CLI output using DeployParser
      const parser = new DeployParser();
      const result = parser.parse(
        cliResult.output,
        options.stage,
        cliResult.exitCode,
        options.maxOutputSize
      );

      // Perform GitHub integration in parallel (non-blocking)
      await this.performGitHubIntegration(result, options);

      return result;
    } catch (error) {
      // Re-throw CLI and parsing errors
      throw error;
    }
  }

  /**
   * Build environment variables for SST CLI execution
   * @param options Operation options containing configuration
   * @returns Environment variables object
   */
  buildEnvironment(options: OperationOptions): Record<string, string> {
    return {
      SST_TOKEN: options.token,
      NODE_ENV: 'production',
      CI: 'true',
      GITHUB_ACTIONS: 'true',
    };
  }

  /**
   * Perform GitHub integration tasks (comments and summaries)
   * Handles errors gracefully to not fail the entire operation
   * @param result Parsed deployment result
   * @param options Operation options
   */
  private async performGitHubIntegration(
    result: DeployResult,
    options: OperationOptions
  ): Promise<void> {
    const integrationPromises: Promise<void>[] = [];

    // Create PR comment (if enabled)
    integrationPromises.push(
      this.githubClient
        .createOrUpdateComment(result, options.commentMode)
        .catch((error) => {
          // Log but don't fail the operation
          console.error('Failed to create GitHub comment:', error.message);
        })
    );

    // Create workflow summary
    integrationPromises.push(
      this.githubClient.createWorkflowSummary(result).catch((error) => {
        // Log but don't fail the operation
        console.error('Failed to create workflow summary:', error.message);
      })
    );

    // Wait for all GitHub integration tasks to complete
    await Promise.allSettled(integrationPromises);
  }
}
