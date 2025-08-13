import type { GitHubClient } from '../github/client';
import { DiffParser } from '../parsers/diff-parser';
import type { DiffResult, OperationOptions } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';
import { handleGitHubIntegrationError } from '../utils/github-actions';

/**
 * Diff operation handler for SST infrastructure changes
 * Combines CLI execution, output parsing, and GitHub integration
 */
export class DiffOperation {
  private readonly defaultTimeout = 300_000; // 5 minutes
  private readonly sstExecutor: SSTCLIExecutor;
  private readonly githubClient: GitHubClient;
  private readonly diffParser?: DiffParser;

  constructor(
    sstExecutor: SSTCLIExecutor,
    githubClient: GitHubClient,
    diffParser?: DiffParser
  ) {
    this.sstExecutor = sstExecutor;
    this.githubClient = githubClient;
    if (diffParser) {
      this.diffParser = diffParser;
    }
  }

  async execute(options: OperationOptions): Promise<DiffResult> {
    try {
      // Execute SST CLI command
      const cliResult = await this.sstExecutor.executeSST(
        'diff',
        options.stage,
        {
          timeout: this.defaultTimeout,
          maxOutputSize: options.maxOutputSize,
          runner: options.runner,
        }
      );

      // Handle CLI execution failure
      if (!cliResult.success) {
        return this.createFailureResult(
          options.stage,
          cliResult.stderr || 'Unknown CLI error'
        );
      }

      // Parse the diff output
      const parser = this.diffParser || new DiffParser();
      const basicDiffResult = parser.parse(
        cliResult.stdout,
        options.stage,
        cliResult.exitCode
      );

      if (!basicDiffResult.success) {
        return this.createFailureResult(
          options.stage,
          'Failed to parse SST diff output'
        );
      }

      // Perform GitHub integration in parallel (non-blocking)
      await this.performGitHubIntegration(basicDiffResult, options);

      return basicDiffResult;
    } catch (error) {
      return this.createFailureResult(
        options.stage,
        error instanceof Error ? error.message : 'Unknown operation error'
      );
    }
  }

  /**
   * Perform GitHub integration tasks (comments and summaries)
   * Handles errors gracefully to not fail the entire operation
   * @param result Parsed diff result
   * @param options Operation options
   */
  private async performGitHubIntegration(
    result: DiffResult,
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

  private createFailureResult(stage: string, error: string): DiffResult {
    return {
      success: false,
      operation: 'diff',
      stage,
      app: 'unknown',
      rawOutput: '',
      exitCode: -1,
      truncated: false,
      error,
      completionStatus: 'failed',
      plannedChanges: 0,
      changeSummary: 'Failed to execute SST diff command',
      changes: [],
    };
  }
}
