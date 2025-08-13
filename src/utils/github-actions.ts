/**
 * GitHub Actions integration utilities
 * Handles parsing inputs and setting outputs using @actions/core
 */

import * as core from '@actions/core';

/**
 * Handle GitHub integration errors with consistent logging
 * @param error - The caught error
 * @param integrationType - Type of integration (e.g., 'comment', 'workflow summary')
 */
export function handleGitHubIntegrationError(
  error: unknown,
  integrationType: string
): void {
  core.info(
    `GitHub ${integrationType} integration failed - continuing with operation`
  );
  core.debug(
    `GitHub ${integrationType} integration error details: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}
