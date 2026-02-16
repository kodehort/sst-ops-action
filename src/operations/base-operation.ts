/**
 * Base Operation Class
 * Provides shared functionality for all SST operation handlers
 * Eliminates code duplication across deploy, diff, and remove operations
 */

import type { GitHubClient } from "../github/client";
import type { BaseOperationResult, OperationOptions } from "../types";
import { handleGitHubIntegrationError } from "../utils/github-actions";

/**
 * Abstract base class for all SST operations
 * Provides common GitHub integration functionality
 *
 * @template T The specific operation result type (DeployResult, DiffResult, etc.)
 */
export abstract class BaseOperation<T extends BaseOperationResult> {
  protected readonly githubClient: GitHubClient;

  constructor(githubClient: GitHubClient) {
    this.githubClient = githubClient;
  }

  /**
   * Execute the operation - must be implemented by subclasses
   * @param options Operation configuration options
   * @returns Promise resolving to operation-specific result
   */
  abstract execute(options: OperationOptions): Promise<T>;

  /**
   * Perform GitHub integration tasks (comments and summaries)
   * Handles errors gracefully to not fail the entire operation
   *
   * This method provides a unified approach to GitHub integration across all operations,
   * executing PR comments and workflow summaries in parallel with proper error handling.
   *
   * @param result Parsed operation result (deploy, diff, or remove)
   * @param options Operation options containing comment mode configuration
   * @protected
   */
  protected async performGitHubIntegration(
    result: T,
    options: OperationOptions
  ): Promise<void> {
    const integrationPromises: Promise<void>[] = [
      // Create PR comment (if enabled based on comment mode)
      this.githubClient
        .createOrUpdateComment(result, options.commentMode || "never")
        .catch((error) => handleGitHubIntegrationError(error, "comment")),

      // Create workflow summary (always attempted)
      this.githubClient
        .createWorkflowSummary(result)
        .catch((error) =>
          handleGitHubIntegrationError(error, "workflow summary")
        ),
    ];

    // Wait for all GitHub integration tasks to complete
    // Using Promise.allSettled to ensure all tasks complete even if some fail
    await Promise.allSettled(integrationPromises);
  }
}
