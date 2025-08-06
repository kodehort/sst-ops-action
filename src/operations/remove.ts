import type { GitHubClient } from '../github/client';
import { RemoveParser } from '../parsers/remove-parser';
import type { OperationOptions } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';

// Enhanced RemoveResult interface for operation handling
interface EnhancedRemoveResult {
  success: boolean;
  stage: string;
  resourcesRemoved: number;
  removedResources: Array<{
    type: string;
    name: string;
    status: 'removed' | 'failed' | 'skipped';
  }>;
  completionStatus: 'complete' | 'partial' | 'failed';
  costSavings: {
    monthly: number;
    formatted: string;
  } | null;
  summary: string;
  executionTime: number;
}

export interface RemoveOperationResult {
  success: boolean;
  stage: string;
  resourcesRemoved: number;
  removedResources: Array<{
    resourceType: string;
    resourceName: string;
    status: 'removed' | 'failed' | 'skipped';
  }>;
  completionStatus: 'complete' | 'partial' | 'failed';
  costSavings: {
    monthly: number;
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

export class RemoveOperation {
  private readonly defaultTimeout = 900_000; // 15 minutes

  constructor(
    private readonly sstExecutor: SSTCLIExecutor,
    private readonly githubClient: GitHubClient,
    private readonly removeParser?: RemoveParser
  ) {}

  async execute(options: OperationOptions): Promise<RemoveOperationResult> {
    try {
      // Execute SST CLI command
      const cliResult = await this.sstExecutor.executeSST(
        'remove',
        options.stage,
        {
          env: this.buildEnvironment(options),
          timeout: this.defaultTimeout,
          maxOutputSize: options.maxOutputSize,
        }
      );

      // Use the execution time from the CLI result
      const executionTime = cliResult.executionTime;

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

      // Parse the remove output
      const parser = this.removeParser || new RemoveParser();
      const basicRemoveResult = parser.parse(
        cliResult.stdout,
        options.stage,
        cliResult.exitCode
      );

      if (!basicRemoveResult.success) {
        return this.createFailureResult(
          options.stage,
          'Failed to parse SST remove output',
          {
            cliExitCode: cliResult.exitCode,
            parsingSuccess: false,
            githubIntegration: false,
          },
          executionTime,
          'Failed to parse SST remove output'
        );
      }

      // Cast to enhanced result and add computed properties
      const removeResult = basicRemoveResult as EnhancedRemoveResult;
      removeResult.costSavings = this.extractCostSavings(cliResult.stdout);
      removeResult.summary = this.generateSummary(removeResult);
      removeResult.executionTime = executionTime;

      // Post PR comment with remove results
      const prCommentPosted = await this.postPRComment(removeResult);

      return {
        success: true,
        stage: options.stage,
        resourcesRemoved: removeResult.resourcesRemoved,
        removedResources: removeResult.removedResources.map((resource) => ({
          resourceType: resource.type,
          resourceName: resource.name,
          status: resource.status,
        })),
        completionStatus: removeResult.completionStatus,
        costSavings: removeResult.costSavings,
        summary: removeResult.summary,
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

  private extractCostSavings(
    output: string
  ): { monthly: number; formatted: string } | null {
    // Look for cost savings patterns in the output
    const costPatterns = [
      /Monthly cost savings:\s*\$([0-9,.]+)/i,
      /Savings:\s*\$([0-9,.]+)\s*monthly/i,
      /Monthly:\s*-\$([0-9,.]+)/i,
    ];

    for (const pattern of costPatterns) {
      const match = output.match(pattern);
      if (match) {
        const amount = Number.parseFloat(match[1].replace(/,/g, ''));
        return {
          monthly: amount,
          formatted: `Monthly cost savings: $${match[1]}`,
        };
      }
    }

    return null;
  }

  private generateSummary(removeResult: EnhancedRemoveResult): string {
    const { resourcesRemoved, stage, completionStatus, costSavings } =
      removeResult;

    if (completionStatus === 'complete') {
      const costPart = costSavings
        ? ` Monthly savings: $${costSavings.monthly.toFixed(2)}`
        : '';
      return `Successfully removed ${resourcesRemoved} resources from ${stage}.${costPart}`;
    }
    if (completionStatus === 'partial') {
      const totalResources = removeResult.removedResources.length;
      return `Partially removed ${resourcesRemoved} of ${totalResources} resources from ${stage}. Some resources could not be removed.`;
    }
    return `Failed to remove resources from ${stage}.`;
  }

  private async postPRComment(
    removeResult: EnhancedRemoveResult
  ): Promise<boolean> {
    try {
      const comment = this.formatPRComment(removeResult);
      await this.githubClient.postPRComment(comment, 'remove');
      return true;
    } catch (error) {
      // GitHub integration failure should not fail the entire operation
      console.warn('Failed to post PR comment:', error);
      return false;
    }
  }

  private formatPRComment(removeResult: EnhancedRemoveResult): string {
    const sections: string[] = [];
    const { completionStatus, stage, resourcesRemoved, removedResources } =
      removeResult;

    if (completionStatus === 'complete') {
      sections.push(`## 🗑️ Resources Successfully Removed

All infrastructure resources have been successfully removed from stage \`${stage}\`.`);
    } else if (completionStatus === 'partial') {
      sections.push(`## ⚠️ **Partial Resource Removal**

**WARNING**: Only some resources were successfully removed from stage \`${stage}\`. Manual cleanup may be required.`);
    } else {
      sections.push(`## ❌ Resource Removal Failed

Failed to remove resources from stage \`${stage}\`. Please check the logs for details.`);
      return sections.join('\n\n');
    }

    // Summary section
    const successCount = removedResources.filter(
      (r) => r.status === 'removed'
    ).length;
    const failedCount = removedResources.filter(
      (r) => r.status === 'failed'
    ).length;
    const skippedCount = removedResources.filter(
      (r) => r.status === 'skipped'
    ).length;

    sections.push(`### 📊 Removal Summary
- **${successCount}** resources successfully removed
- **${failedCount}** resources failed to remove
- **${skippedCount}** resources skipped`);

    // Cost savings if available
    if (removeResult.costSavings) {
      sections.push(`### 💰 Cost Savings
💸 **${removeResult.costSavings.formatted}**`);
    }

    // Detailed resource list
    if (removedResources.length > 0) {
      sections.push('### 🔄 Resource Details');

      const successfulRemovals = removedResources.filter(
        (r) => r.status === 'removed'
      );
      const failedRemovals = removedResources.filter(
        (r) => r.status === 'failed'
      );
      const skippedRemovals = removedResources.filter(
        (r) => r.status === 'skipped'
      );

      if (successfulRemovals.length > 0) {
        sections.push('#### ✅ Successfully Removed');
        successfulRemovals.forEach((resource) => {
          sections.push(`- **${resource.type}** \`${resource.name}\``);
        });
      }

      if (failedRemovals.length > 0) {
        sections.push('#### ❌ Failed to Remove');
        failedRemovals.forEach((resource) => {
          sections.push(`- **${resource.type}** \`${resource.name}\``);
        });
      }

      if (skippedRemovals.length > 0) {
        sections.push('#### ⏭️ Skipped');
        skippedRemovals.forEach((resource) => {
          sections.push(`- **${resource.type}** \`${resource.name}\``);
        });
      }
    }

    // Warning for partial or failed removals
    if (completionStatus !== 'complete') {
      sections.push(`---
⚠️ **Please review the failed resources and perform manual cleanup if necessary.**`);
    }

    return sections.join('\n\n');
  }

  private createFailureResult(
    stage: string,
    error: string,
    metadata: RemoveOperationResult['metadata'],
    executionTime: number,
    customSummary?: string
  ): RemoveOperationResult {
    return {
      success: false,
      stage,
      resourcesRemoved: 0,
      removedResources: [],
      completionStatus: 'failed',
      costSavings: null,
      summary: customSummary || 'Failed to execute SST remove command',
      prCommentPosted: false,
      executionTime,
      error,
      metadata,
    };
  }
}
