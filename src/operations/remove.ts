/**
 * Remove Operation Implementation
 * Handles SST remove command execution with resource cleanup tracking and GitHub integration
 */

import * as core from '@actions/core';
import type { GitHubClient } from '../github/client';
import { RemoveParser } from '../parsers/remove-parser';
import type { OperationOptions, RemoveResult } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';
import { logActionVersion } from '../utils/version';
import { BaseOperation } from './base-operation';

/**
 * Remove operation handler for SST resource cleanup
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class RemoveOperation extends BaseOperation<RemoveResult> {
  private readonly defaultTimeout = 900_000; // 15 minutes
  private readonly sstExecutor: SSTCLIExecutor;

  constructor(sstExecutor: SSTCLIExecutor, githubClient: GitHubClient) {
    super(githubClient);
    this.sstExecutor = sstExecutor;
  }

  /**
   * Execute SST remove operation with full workflow
   * @param options Operation configuration options
   * @returns Parsed remove result with resource cleanup information
   */
  async execute(options: OperationOptions): Promise<RemoveResult> {
    // Log action version at the start
    logActionVersion(core.info);

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
}
