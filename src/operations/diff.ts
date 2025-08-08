import type { GitHubClient } from '../github/client';
import { DiffParser } from '../parsers/diff-parser';
import type { OperationOptions } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';

/**
 * Regex patterns for detecting breaking changes in diff output
 */
const BREAKING_CHANGE_PATTERNS = [
  /⚠️.*[Bb]reaking/,
  /[Bb]reaking.*changes.*detected/i,
  /[Bb]reaking.*change/i,
  /[Ii]mpact.*[Bb]reaking/i,
] as const;

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
      return this.formatNoChangesComment(diffResult.stage);
    }

    const sections: string[] = [];

    // Add header section
    sections.push(this.formatHeaderSection(diffResult));

    // Add summary section
    sections.push(this.formatSummarySection(diffResult));

    // Add cost analysis if available
    if (diffResult.costAnalysis) {
      sections.push(this.formatCostAnalysisSection(diffResult.costAnalysis));
    }

    // Add detailed changes
    if (diffResult.changes.length > 0) {
      sections.push(this.formatDetailedChangesSection(diffResult.changes));
    }

    // Add breaking changes warning
    if (diffResult.breakingChanges) {
      sections.push(this.formatBreakingChangesWarning());
    }

    return sections.join('\n\n');
  }

  private formatNoChangesComment(stage: string): string {
    return `## 📋 No Infrastructure Changes

No infrastructure changes detected for stage \`${stage}\`.

✅ Your infrastructure is up to date!`;
  }

  private formatHeaderSection(diffResult: EnhancedDiffResult): string {
    if (diffResult.breakingChanges) {
      return `## ⚠️ **Breaking Changes Detected**

**IMPORTANT**: This deployment contains breaking changes that may impact your application.`;
    }
    return `## 📋 Infrastructure Changes Detected

Changes detected for stage \`${diffResult.stage}\`:`;
  }

  private formatSummarySection(diffResult: EnhancedDiffResult): string {
    const changeCounts = this.getChangeCounts(diffResult.changes);

    return `### 📊 Summary
- **${diffResult.plannedChanges}** total changes planned
- **${changeCounts.create}** resources to be created
- **${changeCounts.update}** resources to be updated
- **${changeCounts.delete}** resources to be deleted`;
  }

  private getChangeCounts(changes: EnhancedDiffResult['changes']) {
    return {
      create: changes.filter((c) => c.action === 'create').length,
      update: changes.filter((c) => c.action === 'update').length,
      delete: changes.filter((c) => c.action === 'delete').length,
    };
  }

  private formatCostAnalysisSection(
    costAnalysis: NonNullable<EnhancedDiffResult['costAnalysis']>
  ): string {
    const { changeIcon, changeText } = this.getCostChangeInfo(
      costAnalysis.change
    );
    return `### 💰 Cost Analysis
${changeIcon} Monthly cost ${changeText}: **${costAnalysis.formatted}**`;
  }

  private getCostChangeInfo(change: number) {
    if (change > 0) {
      return { changeIcon: '📈', changeText: 'increase' };
    }
    if (change < 0) {
      return { changeIcon: '📉', changeText: 'decrease' };
    }
    return { changeIcon: '📊', changeText: 'no change' };
  }

  private formatDetailedChangesSection(
    changes: EnhancedDiffResult['changes']
  ): string {
    const sections = ['### 🔄 Detailed Changes'];
    const groupedChanges = this.groupChangesByAction(changes);

    this.addChangeGroup(
      sections,
      groupedChanges.create,
      '#### ➕ Resources to be Created'
    );
    this.addChangeGroup(
      sections,
      groupedChanges.update,
      '#### 🔄 Resources to be Updated'
    );
    this.addChangeGroup(
      sections,
      groupedChanges.delete,
      '#### ❌ Resources to be Deleted'
    );

    return sections.join('\n\n');
  }

  private groupChangesByAction(changes: EnhancedDiffResult['changes']) {
    return {
      create: changes.filter((c) => c.action === 'create'),
      update: changes.filter((c) => c.action === 'update'),
      delete: changes.filter((c) => c.action === 'delete'),
    };
  }

  private addChangeGroup(
    sections: string[],
    changes: EnhancedDiffResult['changes'],
    title: string
  ): void {
    if (changes.length === 0) {
      return;
    }

    sections.push(title);
    for (const change of changes) {
      const details = change.details ? ` - ${change.details}` : '';
      sections.push(`- **${change.type}** \`${change.name}\`${details}`);
    }
  }

  private formatBreakingChangesWarning(): string {
    return `---
⚠️ **Please review these changes carefully before deploying to production.**`;
  }

  private detectBreakingChanges(changeSummary: string): boolean {
    // Check for breaking change indicators in the change summary
    return BREAKING_CHANGE_PATTERNS.some((pattern) =>
      pattern.test(changeSummary)
    );
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
