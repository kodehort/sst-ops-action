import type { GitHubClient } from '../github/client';
import { OperationFormatter } from '../github/formatters';
import { DiffParser } from '../parsers/diff-parser';
import type { OperationOptions } from '../types';
import type { DiffResult } from '../types/operations';
import type { SSTCLIExecutor } from '../utils/cli';

export interface DiffOperationResult {
  success: boolean;
  stage: string;
  hasChanges: boolean;
  changesDetected: number;
  changes: Array<{
    action: 'create' | 'update' | 'delete';
    resourceType: string;
    resourceName: string;
    details: string;
  }>;
  summary: string;
  error?: string;
  metadata: {
    cliExitCode: number;
    parsingSuccess: boolean;
    githubIntegration: boolean;
  };
}

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

  async execute(options: OperationOptions): Promise<DiffOperationResult> {
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
          cliResult.stderr || 'Unknown CLI error',
          {
            cliExitCode: cliResult.exitCode,
            parsingSuccess: false,
            githubIntegration: false,
          }
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
          'Failed to parse SST diff output',
          {
            cliExitCode: cliResult.exitCode,
            parsingSuccess: false,
            githubIntegration: false,
          }
        );
      }

      // Add hasChanges property based on planned changes count
      const hasChanges = basicDiffResult.plannedChanges > 0;

      // Post PR comment with diff results
      await this.postPRComment(basicDiffResult);

      return {
        success: true,
        stage: options.stage,
        hasChanges,
        changesDetected: basicDiffResult.plannedChanges,
        changes: basicDiffResult.changes.map((change) => ({
          action: change.action,
          resourceType: change.type,
          resourceName: change.name,
          details: '',
        })),
        summary: basicDiffResult.changeSummary,
        metadata: {
          cliExitCode: cliResult.exitCode,
          parsingSuccess: true,
          githubIntegration: false,
        },
      };
    } catch (error) {
      return this.createFailureResult(
        options.stage,
        error instanceof Error ? error.message : 'Unknown operation error',
        {
          cliExitCode: -1,
          parsingSuccess: false,
          githubIntegration: false,
        }
      );
    }
  }

  private async postPRComment(diffResult: DiffResult): Promise<boolean> {
    try {
      const formatter = new OperationFormatter();
      const comment = formatter.formatOperationComment(diffResult);
      await this.githubClient.postPRComment(comment, 'diff');
      return true;
    } catch (_error) {
      return false;
    }
  }

  private createFailureResult(
    stage: string,
    error: string,
    metadata: DiffOperationResult['metadata']
  ): DiffOperationResult {
    return {
      success: false,
      stage,
      hasChanges: false,
      changesDetected: 0,
      changes: [],
      summary: 'Failed to execute SST diff command',
      error,
      metadata,
    };
  }
}
