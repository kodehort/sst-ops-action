import * as core from "@actions/core";
import type { GitHubClient } from "../github/client";
import type { InfrastructureInputs } from "../inputs/resolve";
import { DiffParser } from "../parsers/diff-parser";
import type { DiffResult } from "../types";
import type { SSTCLIExecutor } from "../utils/cli";
import { logActionVersion } from "../utils/version";
import { BaseOperation } from "./base-operation";

/**
 * Diff operation handler for SST infrastructure changes
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class DiffOperation extends BaseOperation<DiffResult> {
  private readonly defaultTimeout = 300_000; // 5 minutes
  private readonly sstExecutor: SSTCLIExecutor;
  private readonly diffParser?: DiffParser;

  constructor(
    sstExecutor: SSTCLIExecutor,
    githubClient: GitHubClient,
    diffParser?: DiffParser
  ) {
    super(githubClient);
    this.sstExecutor = sstExecutor;
    if (diffParser) {
      this.diffParser = diffParser;
    }
  }

  async execute(inputs: InfrastructureInputs): Promise<DiffResult> {
    try {
      // Log action version at the start
      logActionVersion(core.info);

      // Execute SST CLI command
      const cliResult = await this.sstExecutor.executeSST(
        "diff",
        inputs.stage,
        {
          maxOutputSize: inputs.maxOutputSize,
          runner: inputs.runner,
          timeout: this.defaultTimeout,
        }
      );

      // Handle CLI execution failure
      if (!cliResult.success) {
        return this.createFailureResult(
          inputs.stage,
          cliResult.stderr || "Unknown CLI error"
        );
      }

      // Parse the diff output
      const parser = this.diffParser || new DiffParser();
      // Reads the merged buffer, like deploy and remove. Reading stdout alone
      // made anything the CLI wrote to stderr structurally invisible here.
      const basicDiffResult = parser.parse(
        cliResult.output,
        inputs.stage,
        cliResult.exitCode,
        cliResult.truncated
      );

      if (!basicDiffResult.success) {
        return this.createFailureResult(
          inputs.stage,
          "Failed to parse SST diff output"
        );
      }

      // Perform GitHub integration in parallel (non-blocking)
      await this.performGitHubIntegration(basicDiffResult, inputs.commentMode);

      return basicDiffResult;
    } catch (error) {
      return this.createFailureResult(
        inputs.stage,
        error instanceof Error ? error.message : "Unknown operation error"
      );
    }
  }

  private createFailureResult(stage: string, error: string): DiffResult {
    return {
      app: "",
      changeSummary: "Failed to execute SST diff command",
      changes: [],
      completionStatus: "failed",
      error,
      exitCode: -1,
      operation: "diff",
      plannedChanges: 0,
      rawOutput: "",
      stage,
      success: false,
      truncated: false,
    };
  }
}
