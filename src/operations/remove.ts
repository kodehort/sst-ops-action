/**
 * Remove Operation Implementation
 * Handles SST remove command execution with resource cleanup tracking and GitHub integration
 */

import * as core from "@actions/core";
import type { GitHubClient } from "../github/client";
import type { InfrastructureInputs } from "../inputs/resolve";
import { RemoveParser } from "../parsers/remove-parser";
import type { RemoveResult } from "../types";
import type { SSTCLIExecutor } from "../utils/cli";
import { logActionVersion } from "../utils/version";
import { BaseOperation } from "./base-operation";

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
   * @param inputs Resolved inputs for this operation
   * @returns Parsed remove result with resource cleanup information
   */
  async execute(inputs: InfrastructureInputs): Promise<RemoveResult> {
    // Log action version at the start
    logActionVersion(core.info);

    // Execute SST CLI command
    const cliResult = await this.sstExecutor.executeSST(
      "remove",
      inputs.stage,
      {
        maxOutputSize: inputs.maxOutputSize,
        runner: inputs.runner,
        timeout: this.defaultTimeout,
      }
    );

    // Parse CLI output using RemoveParser
    const parser = new RemoveParser();
    const result = parser.parse(
      cliResult.output,
      inputs.stage,
      cliResult.exitCode,
      cliResult.truncated
    );

    // Perform GitHub integration in parallel (non-blocking)
    await this.performGitHubIntegration(result, inputs.commentMode);

    return result;
  }
}
