/**
 * GitHub comment and summary formatters for different SST operations
 * Provides operation-specific formatting with rich markdown support
 */

import type {
  BaseOperationResult,
  DeployResult,
  DiffResult,
  RemoveResult,
  SSTUrl,
} from '../types/index.js';

/**
 * Format configuration for comments and summaries
 */
interface FormatConfig {
  includeTimestamp: boolean;
  includeDuration: boolean;
  includeDebugInfo: boolean;
  maxUrlsToShow: number;
  maxResourcesToShow: number;
}

/**
 * Default format configuration
 */
const DEFAULT_CONFIG: FormatConfig = {
  includeTimestamp: true,
  includeDuration: true,
  includeDebugInfo: false,
  maxUrlsToShow: 10,
  maxResourcesToShow: 20,
};

/**
 * Main formatter class for GitHub integration
 */
export class OperationFormatter {
  constructor(private config: FormatConfig = DEFAULT_CONFIG) {}

  /**
   * Format operation-specific comment content
   */
  formatOperationComment(result: BaseOperationResult): string {
    switch (result.operation) {
      case 'deploy':
        return this.formatDeployComment(result as DeployResult);
      case 'diff':
        return this.formatDiffComment(result as DiffResult);
      case 'remove':
        return this.formatRemoveComment(result as RemoveResult);
      default:
        return this.formatGenericComment(result);
    }
  }

  /**
   * Format operation-specific summary content
   */
  formatOperationSummary(result: BaseOperationResult): string {
    switch (result.operation) {
      case 'deploy':
        return this.formatDeploySummary(result as DeployResult);
      case 'diff':
        return this.formatDiffSummary(result as DiffResult);
      case 'remove':
        return this.formatRemoveSummary(result as RemoveResult);
      default:
        return this.formatGenericSummary(result);
    }
  }

  /**
   * Format deploy operation comment
   */
  private formatDeployComment(result: DeployResult): string {
    const sections: string[] = [];

    // Status section
    sections.push(this.formatStatusSection(result));

    // Resource changes section
    if (result.resourceChanges && result.resourceChanges > 0) {
      sections.push(this.formatResourceChangesSection(result));
    }

    // URLs section
    if (result.urls && result.urls.length > 0) {
      sections.push(this.formatUrlsSection(result.urls));
    }

    // Console link section
    if (result.permalink) {
      sections.push(this.formatConsoleSection(result.permalink));
    }

    return sections.join('\n\n');
  }

  /**
   * Format diff operation comment
   */
  private formatDiffComment(result: DiffResult): string {
    const sections: string[] = [];

    // Status section
    sections.push(this.formatStatusSection(result));

    // Changes summary section
    sections.push(this.formatDiffChangesSection(result));

    // Console link section
    if (result.permalink) {
      sections.push(this.formatConsoleSection(result.permalink));
    }

    return sections.join('\n\n');
  }

  /**
   * Format remove operation comment
   */
  private formatRemoveComment(result: RemoveResult): string {
    const sections: string[] = [];

    // Status section
    sections.push(this.formatStatusSection(result));

    // Cleanup status section
    sections.push(this.formatCleanupSection(result));

    // Console link section
    if (result.permalink) {
      sections.push(this.formatConsoleSection(result.permalink));
    }

    return sections.join('\n\n');
  }

  /**
   * Format generic operation comment
   */
  private formatGenericComment(result: BaseOperationResult): string {
    return this.formatStatusSection(result);
  }

  /**
   * Format deploy operation summary
   */
  private formatDeploySummary(result: DeployResult): string {
    let summary = `### 📦 Deployment Summary

| Metric | Value |
|--------|-------|
| Resources Changed | ${result.resourceChanges || 0} |
| URLs Deployed | ${result.urls?.length || 0} |
| Status | ${this.formatStatusBadge(result)} |`;

    if (result.urls && result.urls.length > 0) {
      summary += '\n\n### 🔗 Deployed URLs\n';
      const urlsToShow = result.urls.slice(0, this.config.maxUrlsToShow);

      for (const url of urlsToShow) {
        summary += `- **${url.type}**: [${url.url}](${url.url})\n`;
      }

      if (result.urls.length > this.config.maxUrlsToShow) {
        summary += `\n*... and ${result.urls.length - this.config.maxUrlsToShow} more URLs*`;
      }
    }

    return summary;
  }

  /**
   * Format diff operation summary
   */
  private formatDiffSummary(result: DiffResult): string {
    let summary = `### 🔍 Infrastructure Preview

| Property | Value |
|----------|-------|
| Changes Detected | ${result.diffSummary ? 'Yes' : 'No'} |
| Status | ${this.formatStatusBadge(result)} |`;

    if (result.diffSummary) {
      summary += `\n\n### 📋 Changes Summary

${result.diffSummary}`;
    } else {
      summary += `\n\n### ✅ No Changes

No infrastructure changes detected for this operation.`;
    }

    return summary;
  }

  /**
   * Format remove operation summary
   */
  private formatRemoveSummary(result: RemoveResult): string {
    let summary = `### 🗑️ Cleanup Summary

| Property | Value |
|----------|-------|
| Resources Removed | ${result.resourceChanges || 0} |
| Cleanup Status | ${result.completionStatus} |
| Status | ${this.formatStatusBadge(result)} |`;

    if (result.completionStatus === 'partial') {
      summary += `\n\n### ⚠️ Partial Cleanup

Some resources could not be removed. Check the logs for details.`;
    } else if (result.completionStatus === 'complete') {
      summary += `\n\n### ✅ Complete Cleanup

All resources have been successfully removed.`;
    }

    return summary;
  }

  /**
   * Format generic operation summary
   */
  private formatGenericSummary(result: BaseOperationResult): string {
    return `### 🔧 Operation Summary

| Property | Value |
|----------|-------|
| Operation | ${result.operation.toUpperCase()} |
| Stage | ${result.stage} |
| Status | ${this.formatStatusBadge(result)} |
| Exit Code | ${result.exitCode} |`;
  }

  /**
   * Format status section
   */
  private formatStatusSection(result: BaseOperationResult): string {
    const icon = this.getStatusIcon(result);
    const status = result.success ? 'SUCCESS' : 'FAILED';

    return `### ${icon} ${result.operation.toUpperCase()} ${status}

**Stage:** \`${result.stage}\`  
**App:** \`${result.app || 'Unknown'}\`  
**Status:** \`${result.completionStatus}\``;
  }

  /**
   * Format resource changes section
   */
  private formatResourceChangesSection(result: DeployResult): string {
    let section = `### 📊 Resource Changes

**Total Changes:** ${result.resourceChanges}`;

    // If we have detailed resource information, show it
    if (result.resources && result.resources.length > 0) {
      section += `\n\n| Resource | Action | Details |
|----------|---------|---------|`;

      const resourcesToShow = result.resources.slice(
        0,
        this.config.maxResourcesToShow
      );
      for (const resource of resourcesToShow) {
        section += `\n| \`${resource.name}\` | ${this.formatResourceAction(resource.action)} | ${resource.type} |`;
      }

      if (result.resources.length > this.config.maxResourcesToShow) {
        section += `\n\n*... and ${result.resources.length - this.config.maxResourcesToShow} more resources*`;
      }
    }

    return section;
  }

  /**
   * Format URLs section
   */
  private formatUrlsSection(urls: SSTUrl[]): string {
    let section = '### 🔗 Deployed URLs';

    const urlsToShow = urls.slice(0, this.config.maxUrlsToShow);

    for (const url of urlsToShow) {
      section += `\n- **${url.type}**: [${url.url}](${url.url})`;
    }

    if (urls.length > this.config.maxUrlsToShow) {
      section += `\n\n*... and ${urls.length - this.config.maxUrlsToShow} more URLs*`;
    }

    return section;
  }

  /**
   * Format diff changes section
   */
  private formatDiffChangesSection(result: DiffResult): string {
    let section = '### 🔍 Infrastructure Changes Preview';

    if (result.diffSummary) {
      section += `\n\n${result.diffSummary}`;

      // Add warning for breaking changes if detected
      if (this.hasBreakingChanges(result.diffSummary)) {
        section +=
          '\n\n⚠️ **Warning**: This diff may contain breaking changes. Please review carefully.';
      }
    } else {
      section +=
        '\n\n✅ **No changes detected** - Your infrastructure is up to date.';
    }

    return section;
  }

  /**
   * Format cleanup section
   */
  private formatCleanupSection(result: RemoveResult): string {
    let section = '### 🗑️ Resource Cleanup';

    switch (result.completionStatus) {
      case 'complete':
        section += `\n\n✅ **All resources successfully removed**
- Resources cleaned up: ${result.resourceChanges || 0}
- No remaining resources`;
        break;
      case 'partial':
        section += `\n\n⚠️ **Partial cleanup completed**
- Resources cleaned up: ${result.resourceChanges || 0}
- Some resources may still exist
- Check logs for details on stuck resources`;
        break;
      case 'failed':
        section += `\n\n❌ **Cleanup failed**
- Operation encountered errors
- Resources may still exist
- Manual cleanup may be required`;
        break;
      default:
        section += `\n\n**Status:** ${result.completionStatus}
- Resources affected: ${result.resourceChanges || 0}`;
    }

    return section;
  }

  /**
   * Format console section
   */
  private formatConsoleSection(permalink: string): string {
    return `### 🖥️ SST Console

[View in SST Console](${permalink}) to see detailed resource information and logs.`;
  }

  /**
   * Format status badge
   */
  private formatStatusBadge(result: BaseOperationResult): string {
    if (result.success) {
      return '![Success](https://img.shields.io/badge/Status-Success-green)';
    }
    return '![Failed](https://img.shields.io/badge/Status-Failed-red)';
  }

  /**
   * Get status icon for operation
   */
  private getStatusIcon(result: BaseOperationResult): string {
    if (result.success) {
      switch (result.operation) {
        case 'deploy':
          return '🚀';
        case 'diff':
          return '🔍';
        case 'remove':
          return '🗑️';
        default:
          return '✅';
      }
    }
    return '❌';
  }

  /**
   * Format resource action with appropriate icon
   */
  private formatResourceAction(action: string): string {
    switch (action.toLowerCase()) {
      case 'created':
      case 'create':
        return '🆕 Created';
      case 'updated':
      case 'update':
        return '📝 Updated';
      case 'deleted':
      case 'delete':
        return '🗑️ Deleted';
      case 'unchanged':
        return '➖ Unchanged';
      default:
        return `${action}`;
    }
  }

  /**
   * Check if diff summary contains breaking changes
   */
  private hasBreakingChanges(diffSummary: string): boolean {
    const breakingIndicators = [
      'breaking',
      'remove',
      'delete',
      'destroy',
      'replace',
      'force-new-resource',
    ];

    const lowerSummary = diffSummary.toLowerCase();
    return breakingIndicators.some((indicator) =>
      lowerSummary.includes(indicator)
    );
  }
}

/**
 * Create formatter instance with default configuration
 */
export function createFormatter(
  config?: Partial<FormatConfig>
): OperationFormatter {
  return new OperationFormatter({ ...DEFAULT_CONFIG, ...config });
}

/**
 * Quick formatting functions for common use cases
 */
export const formatters = {
  /**
   * Format a simple success/failure status
   */
  formatStatus: (success: boolean, operation: string): string => {
    const icon = success ? '✅' : '❌';
    const status = success ? 'SUCCESS' : 'FAILED';
    return `${icon} ${operation.toUpperCase()} ${status}`;
  },

  /**
   * Format duration in human-readable format
   */
  formatDuration: (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60_000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60_000).toFixed(1)}m`;
  },

  /**
   * Format file size in human-readable format
   */
  formatSize: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  },

  /**
   * Format timestamp in ISO format
   */
  formatTimestamp: (date: Date = new Date()): string => {
    return date.toISOString();
  },
};
