import type { GitHubClient } from '../github/client';
import { DiffParser } from '../parsers/diff-parser';
import type { OperationOptions } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';

// Enhanced DiffResult interface for operation handling
// This extends the basic DiffResult with additional properties needed for PR comments
interface EnhancedDiffResult {
  success: boolean;
  stage: string;
  plannedChanges: number;
  changes: Array<{
    type: string;
    name: string;
    action: 'create' | 'update' | 'delete';
    details?: string;
  }>;
  changeSummary: string;
  hasChanges: boolean;
  breakingChanges: boolean;
  costAnalysis: {
    current: number;
    planned: number;
    change: number;
    formatted: string;
  } | null;
  summary: string;
  executionTime: number;
}

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
  breakingChanges: boolean;
  costAnalysis: {
    current: number;
    planned: number;
    change: number;
    formatted: string;
  } | null;
  summary: string;
  prCommentPosted: boolean;
  executionTime: number;
  error?: string;
  metadata: {
    cliExitCode: number;
    parsingSuccess: boolean;
    githubIntegration: boolean;
  };
}

export class DiffOperation {
  private readonly defaultTimeout = 300_000; // 5 minutes

  constructor(
    private readonly sstExecutor: SSTCLIExecutor,
    private readonly githubClient: GitHubClient,
    private readonly diffParser?: DiffParser
  ) {}

  async execute(options: OperationOptions): Promise<DiffOperationResult> {
    try {
      // Execute SST CLI command
      const cliResult = await this.sstExecutor.executeSST(
        'diff',
        options.stage,
        {
          env: this.buildEnvironment(options),
          timeout: this.defaultTimeout,
          maxOutputSize: options.maxOutputSize,
          runner: options.runner,
        }
      );

      // Use the execution time from the CLI result
      const executionTime = cliResult.duration;

      // Handle CLI execution failure
      if (!cliResult.success) {
        return this.createFailureResult(
          options.stage,
          cliResult.stderr || 'Unknown CLI error',
          {
            cliExitCode: cliResult.exitCode,
            parsingSuccess: false,
            githubIntegration: false,
          },
          executionTime
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
          },
          executionTime
        );
      }

      // Cast to enhanced result (our implementation has these properties)
      const diffResult = basicDiffResult as unknown as EnhancedDiffResult;
      diffResult.hasChanges = diffResult.plannedChanges > 0;
      diffResult.breakingChanges = this.detectBreakingChanges(
        diffResult.changeSummary
      );
      diffResult.costAnalysis = null; // TODO: Parse cost data when implemented
      diffResult.summary = diffResult.changeSummary;
      diffResult.executionTime = executionTime;

      // Post PR comment with diff results
      const prCommentPosted = await this.postPRComment(diffResult);

      return {
        success: true,
        stage: options.stage,
        hasChanges: diffResult.hasChanges,
        changesDetected: diffResult.plannedChanges,
        changes: diffResult.changes.map((change) => ({
          action: change.action,
          resourceType: change.type,
          resourceName: change.name,
          details: change.details || '',
        })),
        breakingChanges: diffResult.breakingChanges,
        costAnalysis: diffResult.costAnalysis,
        summary: diffResult.summary,
        prCommentPosted,
        executionTime,
        metadata: {
          cliExitCode: cliResult.exitCode,
          parsingSuccess: true,
          githubIntegration: prCommentPosted,
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
        },
        0 // Execution time not available in case of unexpected error
      );
    }
  }

  private buildEnvironment(options: OperationOptions): Record<string, string> {
    return {
      ...options.environment,
      NODE_ENV: 'production',
      CI: 'true',
    };
  }

  private async postPRComment(
    diffResult: EnhancedDiffResult
  ): Promise<boolean> {
    try {
      const comment = this.formatPRComment(diffResult);
      await this.githubClient.postPRComment(comment, 'diff');
      return true;
    } catch (_error) {
      return false;
    }
  }

  private formatPRComment(diffResult: EnhancedDiffResult): string {
    if (!diffResult.hasChanges) {
      return `## 📋 No Infrastructure Changes

No infrastructure changes detected for stage \`${diffResult.stage}\`.

✅ Your infrastructure is up to date!`;
    }

    const sections: string[] = [];

    // Header with breaking changes warning
    if (diffResult.breakingChanges) {
      sections.push(`## ⚠️ **Breaking Changes Detected**

**IMPORTANT**: This deployment contains breaking changes that may impact your application.`);
    } else {
      sections.push(`## 📋 Infrastructure Changes Detected

Changes detected for stage \`${diffResult.stage}\`:`);
    }

    // Changes summary
    const createCount = diffResult.changes.filter(
      (c) => c.action === 'create'
    ).length;
    const updateCount = diffResult.changes.filter(
      (c) => c.action === 'update'
    ).length;
    const deleteCount = diffResult.changes.filter(
      (c) => c.action === 'delete'
    ).length;

    sections.push(`### 📊 Summary
- **${diffResult.plannedChanges}** total changes planned
- **${createCount}** resources to be created
- **${updateCount}** resources to be updated
- **${deleteCount}** resources to be deleted`);

    // Cost analysis if available
    if (diffResult.costAnalysis) {
      const { costAnalysis } = diffResult;
      const changeIcon =
        costAnalysis.change > 0 ? '📈' : costAnalysis.change < 0 ? '📉' : '📊';
      const changeText =
        costAnalysis.change > 0
          ? 'increase'
          : costAnalysis.change < 0
            ? 'decrease'
            : 'no change';

      sections.push(`### 💰 Cost Analysis
${changeIcon} Monthly cost ${changeText}: **${costAnalysis.formatted}**`);
    }

    // Detailed changes
    if (diffResult.changes.length > 0) {
      sections.push('### 🔄 Detailed Changes');

      const groupedChanges = {
        create: diffResult.changes.filter((c) => c.action === 'create'),
        update: diffResult.changes.filter((c) => c.action === 'update'),
        delete: diffResult.changes.filter((c) => c.action === 'delete'),
      };

      if (groupedChanges.create.length > 0) {
        sections.push('#### ➕ Resources to be Created');
        groupedChanges.create.forEach((change) => {
          sections.push(
            `- **${change.type}** \`${change.name}\`${change.details ? ` - ${change.details}` : ''}`
          );
        });
      }

      if (groupedChanges.update.length > 0) {
        sections.push('#### 🔄 Resources to be Updated');
        groupedChanges.update.forEach((change) => {
          sections.push(
            `- **${change.type}** \`${change.name}\`${change.details ? ` - ${change.details}` : ''}`
          );
        });
      }

      if (groupedChanges.delete.length > 0) {
        sections.push('#### ❌ Resources to be Deleted');
        groupedChanges.delete.forEach((change) => {
          sections.push(
            `- **${change.type}** \`${change.name}\`${change.details ? ` - ${change.details}` : ''}`
          );
        });
      }
    }

    // Breaking changes warning
    if (diffResult.breakingChanges) {
      sections.push(`---
⚠️ **Please review these changes carefully before deploying to production.**`);
    }

    return sections.join('\n\n');
  }

  private detectBreakingChanges(changeSummary: string): boolean {
    // Check for breaking change indicators in the change summary
    const breakingIndicators = [
      /⚠️.*[Bb]reaking/,
      /[Bb]reaking.*changes.*detected/i,
      /[Bb]reaking.*change/i,
      /[Ii]mpact.*[Bb]reaking/i,
    ];

    return breakingIndicators.some((pattern) => pattern.test(changeSummary));
  }

  private createFailureResult(
    stage: string,
    error: string,
    metadata: DiffOperationResult['metadata'],
    executionTime: number
  ): DiffOperationResult {
    return {
      success: false,
      stage,
      hasChanges: false,
      changesDetected: 0,
      changes: [],
      breakingChanges: false,
      costAnalysis: null,
      summary: 'Failed to execute SST diff command',
      prCommentPosted: false,
      executionTime,
      error,
      metadata,
    };
  }
}
