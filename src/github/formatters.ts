/**
 * GitHub comment and summary formatters for different SST operations
 * Provides operation-specific formatting with rich markdown support
 */

import type {
  BaseOperationResult,
  DeployResult,
  DiffResult,
  RemoveResult,
} from '../types/index.js';

/**
 * Regex pattern for finding the Generated section marker
 */
const GENERATED_SECTION_PATTERN = /^✓\s+Generated\s*$/;

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
  private config: FormatConfig;

  /**
   * URL protocols for optimized protocol checking
   */
  private static readonly URL_PROTOCOLS = new Set(['http://', 'https://']);

  constructor(config: FormatConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

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
      case 'stage':
        return this.formatGenericComment(result);
      default: {
        const _exhaustive: never = result.operation;
        return this.formatGenericComment(result);
      }
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
      case 'stage':
        return this.formatGenericSummary(result);
      default: {
        const _exhaustive: never = result.operation;
        return this.formatGenericSummary(result);
      }
    }
  }

  /**
   * Format deploy operation comment
   */
  private formatDeployComment(result: DeployResult): string {
    const sections: string[] = [];

    // Status section with comprehensive table
    sections.push(this.formatDeployStatusTable(result));

    // Resource changes section
    if (result.resourceChanges && result.resourceChanges > 0) {
      sections.push(this.formatResourceChangesSection(result));
    }

    // Outputs section
    if (result.outputs && result.outputs.length > 0) {
      sections.push(this.formatOutputsSection(result.outputs));
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

| Property | Value |
|----------|-------|
| App | \`${result.app || 'Unknown'}\` |
| Stage | \`${result.stage}\` |
| Resources Changed | ${result.resourceChanges || 0} |
| Outputs | ${result.outputs?.length || 0} |
| Status | ${this.formatStatusBadge(result)} |`;

    // Add console link if available
    if (result.permalink) {
      summary += `\n| Console Link | [View Deployment](${result.permalink}) |`;
    }

    if (result.outputs && result.outputs.length > 0) {
      summary += '\n\n### 📋 Deploy Outputs\n\n';
      const outputsToShow = result.outputs.slice(0, this.config.maxUrlsToShow);

      summary += '| Key | Value |\n|-----|-------|\n';
      for (const output of outputsToShow) {
        const formattedValue = this.formatOutputValue(output.value);
        summary += `| ${output.key} | ${formattedValue} |\n`;
      }

      if (result.outputs.length > this.config.maxUrlsToShow) {
        summary += `\n*... and ${result.outputs.length - this.config.maxUrlsToShow} more outputs*`;
      }
    }

    return summary;
  }

  /**
   * Format diff operation summary
   */
  private formatDiffSummary(result: DiffResult): string {
    // Count changes by type
    const createCount = result.changes.filter(
      (c) => c.action === 'create'
    ).length;
    const updateCount = result.changes.filter(
      (c) => c.action === 'update'
    ).length;
    const deleteCount = result.changes.filter(
      (c) => c.action === 'delete'
    ).length;

    let summary = `### 🔍 Infrastructure Diff Summary

| Property | Value |
|----------|-------|
| App | \`${result.app}\` |
| Stage | \`${result.stage}\` |
| Total Changes | ${result.plannedChanges} |
| Added Resources | ${createCount} |
| Modified Resources | ${updateCount} |
| Removed Resources | ${deleteCount} |
| Status | ${this.formatStatusBadge(result)} |`;

    // Add permalink if available
    if (result.permalink) {
      summary += `\n| Console Link | [View Diff](${result.permalink}) |`;
    }

    // Add the actual diff in a collapsible code block
    if (result.plannedChanges > 0) {
      summary += `\n\n<details>
<summary>📋 View Resource Changes</summary>

\`\`\`diff
${this.formatDiffOutput(result)}
\`\`\`

</details>`;
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
| Resources Removed | ${result.resourcesRemoved || 0} |
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
   * Format deploy status table section
   */
  private formatDeployStatusTable(result: DeployResult): string {
    const icon = this.getStatusIcon(result);
    const status = result.success ? 'SUCCESS' : 'FAILED';

    let table = `### ${icon} ${result.operation.toUpperCase()} ${status}

| Property | Value |
|----------|-------|
| App | \`${result.app || 'Unknown'}\` |
| Stage | \`${result.stage}\` |
| Resource Changes | ${result.resourceChanges || 0} |
| Outputs | ${result.outputs?.length || 0} |
| Status | ${this.formatStatusBadge(result)} |`;

    // Add console link if available
    if (result.permalink) {
      table += `\n| Console Link | [View Deployment](${result.permalink}) |`;
    }

    return table;
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
        section += `\n| \`${resource.name}\` | ${this.formatResourceAction(resource.status)} | ${resource.type} |`;
      }

      if (result.resources.length > this.config.maxResourcesToShow) {
        section += `\n\n*... and ${result.resources.length - this.config.maxResourcesToShow} more resources*`;
      }
    }

    return section;
  }

  /**
   * Format outputs section
   */
  private formatOutputsSection(
    outputs: Array<{ key: string; value: string }>
  ): string {
    let section = '### 📋 Deploy Outputs\n\n';

    const outputsToShow = outputs.slice(0, this.config.maxUrlsToShow);

    section += '| Key | Value |\n|-----|-------|\n';
    for (const output of outputsToShow) {
      const formattedValue = this.formatOutputValue(output.value);
      section += `| ${output.key} | ${formattedValue} |\n`;
    }

    if (outputs.length > this.config.maxUrlsToShow) {
      section += `\n*... and ${outputs.length - this.config.maxUrlsToShow} more outputs*`;
    }

    return section;
  }

  /**
   * Format output value - make URLs clickable, escape other values
   * Uses optimized Set-based protocol checking for better performance
   */
  private formatOutputValue(value: string): string {
    // Check if value is a URL using optimized protocol checking with safe substring operations
    const hasUrlProtocol =
      value.length >= 7 &&
      (OperationFormatter.URL_PROTOCOLS.has(value.substring(0, 8)) ||
        OperationFormatter.URL_PROTOCOLS.has(value.substring(0, 7)));

    if (hasUrlProtocol) {
      return `[${value}](${value})`;
    }

    // For non-URL values, just return the value (escaped for table)
    return `\`${value}\``;
  }

  /**
   * Format diff changes section
   */
  private formatDiffChangesSection(result: DiffResult): string {
    let section = `### 🔍 Infrastructure Changes Preview

| Property | Value |
|----------|-------|
| App | \`${result.app}\` |
| Stage | \`${result.stage}\` |
| Total Changes | ${result.plannedChanges} |
| Summary | ${result.changeSummary} |`;

    if (result.permalink) {
      section += `\n| Console Link | [View Diff](${result.permalink}) |`;
    }

    // Add the actual diff in a collapsible code block
    if (result.plannedChanges > 0) {
      section += `\n\n<details>
<summary>📋 View Infrastructure Changes</summary>

\`\`\`diff
${this.formatDiffOutput(result)}
\`\`\`

</details>`;
    } else {
      section += `\n\n### ✅ No Changes

No infrastructure changes detected for this operation.`;
    }

    return section;
  }

  /**
   * Format diff output for display in code block
   */
  private formatDiffOutput(result: DiffResult): string {
    if (!result.changes || result.changes.length === 0) {
      return 'No changes detected';
    }

    // Extract the actual diff section from the raw output
    const diffContent = this.extractDiffSection(result.rawOutput);

    if (!diffContent || diffContent.trim() === '') {
      // Fallback to simple summary if diff section extraction fails
      return result.changes
        .map((change) => {
          let symbol: string;
          if (change.action === 'create') {
            symbol = '+';
          } else if (change.action === 'delete') {
            symbol = '-';
          } else {
            symbol = '*';
          }
          return `${symbol} ${change.name} (${change.type})`;
        })
        .join('\n');
    }

    return diffContent;
  }

  /**
   * Extract the diff section from SST raw output
   */
  private extractDiffSection(rawOutput: string): string {
    const lines = rawOutput.split('\n');
    let diffStartIndex = -1;

    // Find the "✓ Generated" marker
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && GENERATED_SECTION_PATTERN.test(line)) {
        diffStartIndex = i + 1;
        break;
      }
    }

    if (diffStartIndex === -1 || diffStartIndex >= lines.length) {
      return '';
    }

    // Get all lines after the "✓ Generated" marker
    const diffLines = lines.slice(diffStartIndex);

    // Remove any trailing empty lines
    while (diffLines.length > 0 && diffLines.at(-1)?.trim() === '') {
      diffLines.pop();
    }

    return diffLines.join('\n').trim();
  }

  /**
   * Format cleanup section
   */
  private formatCleanupSection(result: RemoveResult): string {
    let section = '### 🗑️ Resource Cleanup';

    switch (result.completionStatus) {
      case 'complete':
        section += `\n\n✅ **All resources successfully removed**
- Resources cleaned up: ${result.resourcesRemoved || 0}
- No remaining resources`;
        break;
      case 'partial':
        section += `\n\n⚠️ **Partial cleanup completed**
- Resources cleaned up: ${result.resourcesRemoved || 0}
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
- Resources affected: ${result.resourcesRemoved || 0}`;
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
        case 'stage':
          return '🏷️';
        default: {
          const _exhaustive: never = result.operation;
          return '✅';
        }
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
}
