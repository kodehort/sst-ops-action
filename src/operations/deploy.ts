/**
 * Deploy Operation Implementation
 * Handles SST deploy command execution with resource tracking and GitHub integration
 */

import * as core from "@actions/core";
import type { GitHubClient } from "../github/client";
import type { InfrastructureInputs } from "../inputs/resolve";
import { DeployParser } from "../parsers/deploy-parser";
import type { DeployResult } from "../types";
import type { SSTCLIExecutor } from "../utils/cli";
import { logActionVersion } from "../utils/version";
import { BaseOperation } from "./base-operation";

/**
 * Deploy operation handler for SST deployments
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class DeployOperation extends BaseOperation<DeployResult> {
  private readonly defaultTimeout = 900_000; // 15 minutes
  private readonly sstExecutor: SSTCLIExecutor;

  constructor(sstExecutor: SSTCLIExecutor, githubClient: GitHubClient) {
    super(githubClient);
    this.sstExecutor = sstExecutor;
  }

  /**
   * Execute SST deploy operation with full workflow
   * @param inputs Resolved inputs for this operation
   * @returns Parsed deployment result with resource changes and extracted outputs
   */
  async execute(inputs: InfrastructureInputs): Promise<DeployResult> {
    // Log action version at the start
    logActionVersion(core.info);

    // Execute SST CLI command
    const cliResult = await this.sstExecutor.executeSST(
      "deploy",
      inputs.stage,
      {
        maxOutputSize: inputs.maxOutputSize,
        runner: inputs.runner,
        timeout: this.defaultTimeout,
      }
    );

    // Parse CLI output using DeployParser
    const parser = new DeployParser();
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
