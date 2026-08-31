/**
 * GitHub comment and summary formatters for different SST operations
 * Provides operation-specific formatting with rich markdown support
 */

import type {
  BaseOperationResult,
  DeployResult,
  DiffResult,
  RemoveResult,
} from "../types/index.js";

/**
 * Format configuration for comments and summaries
 */
interface FormatConfig {
  includeDebugInfo: boolean;
  includeDuration: boolean;
  includeTimestamp: boolean;
  maxResourcesToShow: number;
  maxUrlsToShow: number;
}

/**
 * Default format configuration
 */
const DEFAULT_CONFIG: FormatConfig = {
  includeDebugInfo: false,
  includeDuration: true,
  includeTimestamp: true,
  maxResourcesToShow: 20,
  maxUrlsToShow: 10,
};

/**
 * Main formatter class for GitHub integration
 */
export class OperationFormatter {
  private readonly config: FormatConfig;

  /**
   * URL protocols for optimized protocol checking
   */
  private static readonly URL_PROTOCOLS = new Set(["http://", "https://"]);

  constructor(config: FormatConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Format operation-specific comment content
   *
   * The length guard sits here, at the single entry point, rather than in the
   * diff path that happens to produce the largest body today. Anything that
   * renders a comment goes through this method, so nothing can grow past the
   * limit by taking a different route.
   */
  formatOperationComment(result: BaseOperationResult): string {
    return withinLimit(this.buildComment(result), COMMENT_LIMIT, "comment");
  }

  private buildComment(result: BaseOperationResult): string {
    switch (result.operation) {
      case "deploy":
        return this.formatDeployComment(result as DeployResult);
      case "diff":
        return this.formatDiffComment(result as DiffResult);
      case "remove":
        return this.formatRemoveComment(result as RemoveResult);
      case "stage":
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
    return withinLimit(this.buildSummary(result), SUMMARY_LIMIT, "summary");
  }

  private buildSummary(result: BaseOperationResult): string {
    switch (result.operation) {
      case "deploy":
        return this.formatDeploySummary(result as DeployResult);
      case "diff":
        return this.formatDiffSummary(result as DiffResult);
      case "remove":
        return this.formatRemoveSummary(result as RemoveResult);
      case "stage":
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

    return sections.join("\n\n");
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

    return sections.join("\n\n");
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

    return sections.join("\n\n");
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
| App | \`${result.app || "Unknown"}\` |
| Stage | \`${result.stage}\` |
| Resources Changed | ${result.resourceChanges || 0} |
| Outputs | ${result.outputs?.length || 0} |
| Status | ${this.formatStatusBadge(result)} |`;

    // Add console link if available
    if (result.permalink) {
      summary += `\n| Console Link | [View Deployment](${result.permalink}) |`;
    }

    if (result.outputs && result.outputs.length > 0) {
      summary += "\n\n### 📋 Deploy Outputs\n\n";
      const outputsToShow = result.outputs.slice(0, this.config.maxUrlsToShow);

      summary += "| Key | Value |\n|-----|-------|\n";
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
      (c) => c.action === "create"
    ).length;
    const updateCount = result.changes.filter(
      (c) => c.action === "update"
    ).length;
    const deleteCount = result.changes.filter(
      (c) => c.action === "delete"
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

    if (result.completionStatus === "partial") {
      summary += `\n\n### ⚠️ Partial Cleanup

Some resources could not be removed. Check the logs for details.`;
    } else if (result.completionStatus === "complete") {
      summary += `\n\n### ✅ Complete Cleanup

All resources have been successfully removed.`;
    } else if (result.completionStatus === "skipped") {
      summary += `\n\n### ⏭️ Nothing to Remove

Stage \`${result.stage}\` is not deployed, so no removal was attempted.`;
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
    const status = result.success ? "SUCCESS" : "FAILED";

    return `### ${icon} ${result.operation.toUpperCase()} ${status}

**Stage:** \`${result.stage}\`
**App:** \`${result.app || "Unknown"}\`
**Status:** \`${result.completionStatus}\``;
  }

  /**
   * Format deploy status table section
   */
  private formatDeployStatusTable(result: DeployResult): string {
    const icon = this.getStatusIcon(result);
    const status = result.success ? "SUCCESS" : "FAILED";

    let table = `### ${icon} ${result.operation.toUpperCase()} ${status}

| Property | Value |
|----------|-------|
| App | \`${result.app || "Unknown"}\` |
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
    let section = "### 📋 Deploy Outputs\n\n";

    const outputsToShow = outputs.slice(0, this.config.maxUrlsToShow);

    section += "| Key | Value |\n|-----|-------|\n";
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
   * Uses optimized Set-based protocol checking with URL structure validation
   */
  private formatOutputValue(value: string): string {
    // Early exit for strings too short to be URLs
    if (value.length < 7) {
      return `\`${value}\``;
    }

    // Single slice operation with early exit for non-http protocols
    const prefix = value.slice(0, 8);
    if (!prefix.startsWith("http")) {
      return `\`${value}\``;
    }

    // Check for valid protocols with single slice result
    const hasUrlProtocol =
      OperationFormatter.URL_PROTOCOLS.has(prefix) ||
      OperationFormatter.URL_PROTOCOLS.has(prefix.slice(0, 7));

    // Validate URL structure before creating markdown link to prevent broken links
    if (hasUrlProtocol && this.isValidUrl(value)) {
      return `[${value}](${value})`;
    }

    // For non-URL values or invalid URLs, return as code block
    return `\`${value}\``;
  }

  /**
   * Validate URL structure using browser-standard URL constructor
   * Prevents broken markdown links from malformed URLs
   * Only allows http: and https: protocols for security
   */
  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
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
      return "No changes detected";
    }

    // The parser extracted this; the formatter no longer scans raw CLI output.
    const diffContent = result.diffSection;

    if (!diffContent || diffContent.trim() === "") {
      // Fallback to simple summary if diff section extraction fails
      return result.changes
        .map((change) => {
          let symbol: string;
          if (change.action === "create") {
            symbol = "+";
          } else if (change.action === "delete") {
            symbol = "-";
          } else {
            symbol = "*";
          }
          return `${symbol} ${change.name} (${change.type})`;
        })
        .join("\n");
    }

    return diffContent;
  }

  /**
   * Format cleanup section
   */
  private formatCleanupSection(result: RemoveResult): string {
    let section = "### 🗑️ Resource Cleanup";

    switch (result.completionStatus) {
      case "complete":
        section += `\n\n✅ **All resources successfully removed**
- Resources cleaned up: ${result.resourcesRemoved || 0}
- No remaining resources`;
        break;
      case "partial":
        section += `\n\n⚠️ **Partial cleanup completed**
- Resources cleaned up: ${result.resourcesRemoved || 0}
- Some resources may still exist
- Check logs for details on stuck resources`;
        break;
      case "failed":
        section += `\n\n❌ **Cleanup failed**
- Operation encountered errors
- Resources may still exist
- Manual cleanup may be required`;
        break;
      case "skipped":
        section += `\n\n⏭️ **Nothing to remove**
- Stage is not deployed in the state backend
- No removal was attempted`;
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
      return "![Success](https://img.shields.io/badge/Status-Success-green)";
    }
    return "![Failed](https://img.shields.io/badge/Status-Failed-red)";
  }

  /**
   * Get status icon for operation
   */
  private getStatusIcon(result: BaseOperationResult): string {
    if (result.success) {
      switch (result.operation) {
        case "deploy":
          return "🚀";
        case "diff":
          return "🔍";
        case "remove":
          return "🗑️";
        case "stage":
          return "🏷️";
        default: {
          const _exhaustive: never = result.operation;
          return "✅";
        }
      }
    }
    return "❌";
  }

  /**
   * Format resource action with appropriate icon
   */
  private formatResourceAction(action: string): string {
    switch (action.toLowerCase()) {
      case "created":
      case "create":
        return "🆕 Created";
      case "updated":
      case "update":
        return "📝 Updated";
      case "deleted":
      case "delete":
        return "🗑️ Deleted";
      case "unchanged":
        return "➖ Unchanged";
      default:
        return `${action}`;
    }
  }
}

/**
 * GitHub rejects an issue or pull request comment body longer than this.
 *
 * The API answers 422, and `GitHubClient` turns that into a warning and
 * resolves — so before this guard a comment over the limit simply never
 * appeared and the run stayed green.
 */
const COMMENT_LIMIT = 65_536;

/**
 * GitHub caps a job summary at 1MB.
 *
 * Unreachable while capture was capped at 1MB — that yields roughly a 730KB
 * summary — but `max-output-size: 0` means genuinely unlimited capture since
 * #160, and `createWorkflowSummary` swallows a failed write into a warning
 * exactly as the comment path did. Left unbounded, the fallback the comment's
 * truncation notice points at would be the thing that silently disappeared.
 */
const SUMMARY_LIMIT = 1024 * 1024;

/** Shown in place of what was cut. */
function truncationNotice(surface: "comment" | "summary"): string {
  return surface === "comment"
    ? "> **Comment truncated** to fit GitHub's 65,536 character limit. " +
        "See the workflow summary for the full output."
    : "> **Summary truncated** to fit GitHub's 1MB limit.";
}

/**
 * Bound a rendered body, repairing any block the cut lands inside.
 *
 * The diff is wrapped in `<details>` around a fenced block, so cutting at a
 * byte offset can leave both open — which breaks rendering for everything
 * after it, not just the truncated part. Whatever is still open at the cut is
 * closed before the notice is appended.
 */
function withinLimit(
  body: string,
  limit: number,
  surface: "comment" | "summary"
): string {
  if (body.length <= limit) {
    return body;
  }

  const notice = truncationNotice(surface);
  // Reserve room for the notice and for the closers, which are not known
  // until the cut point is chosen. Four fences and four details is far more
  // nesting than the formatter builds, so this cannot under-reserve.
  const reserve = notice.length + "\n\n```\n</details>\n".length * 4;
  const kept = keepWholeLines(body, limit - reserve);

  return [kept, closersFor(kept), `\n\n${notice}`].filter(Boolean).join("");
}

/**
 * Take as many whole lines as fit in `budget`.
 *
 * A half-line inside a fenced diff reads as corrupted output rather than as
 * a truncation, so the cut lands on a newline.
 */
function keepWholeLines(body: string, budget: number): string {
  if (budget <= 0) {
    return "";
  }

  const cut = body.lastIndexOf("\n", budget);

  return cut === -1 ? body.slice(0, budget) : body.slice(0, cut);
}

/** Close any fence or `<details>` left open by the cut. */
function closersFor(kept: string): string {
  let closers = "";

  if ((kept.match(/```/g) || []).length % 2 !== 0) {
    closers += "\n```";
  }

  const opened = (kept.match(/<details>/g) || []).length;
  const closed = (kept.match(/<\/details>/g) || []).length;
  closers += "\n</details>".repeat(Math.max(0, opened - closed));

  return closers;
}
