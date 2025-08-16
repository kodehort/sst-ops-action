/**
 * Deploy Operation Implementation
 * Handles SST deploy command execution with resource tracking and GitHub integration
 */

import * as core from '@actions/core';
import type { GitHubClient } from '../github/client';
import { DeployParser } from '../parsers/deploy-parser';
import type { DeployResult, OperationOptions } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';
import { handleGitHubIntegrationError } from '../utils/github-actions';
import { logActionVersion } from '../utils/version';

/**
 * Deploy operation handler for SST deployments
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class DeployOperation {
  private readonly defaultTimeout = 900_000; // 15 minutes
  private readonly sstExecutor: SSTCLIExecutor;
  private readonly githubClient: GitHubClient;

  constructor(sstExecutor: SSTCLIExecutor, githubClient: GitHubClient) {
    this.sstExecutor = sstExecutor;
    this.githubClient = githubClient;
  }

  /**
   * Execute SST deploy operation with full workflow
   * @param options Operation configuration options
   * @returns Parsed deployment result with resource changes and extracted outputs
   */
  async execute(options: OperationOptions): Promise<DeployResult> {
    // Log action version at the start
    logActionVersion(core.info);

    // Execute SST CLI command
    const cliResult = await this.sstExecutor.executeSST(
      'deploy',
      options.stage,
      {
        timeout: this.defaultTimeout,
        maxOutputSize: options.maxOutputSize,
        runner: options.runner,
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
