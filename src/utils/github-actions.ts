/**
 * GitHub Actions integration utilities
 * Handles parsing inputs and setting outputs using @actions/core
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * Get the current action version from package.json
 * @returns The version string from package.json
 */
function getActionVersion(): string {
  try {
    // Get the package.json path relative to the project root
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(packageJson);
    return parsed.version || 'unknown';
  } catch (error) {
    core.debug(
      `Failed to read version from package.json: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return 'unknown';
  }
}

/**
 * Log the current action version for the operation
 * @param operation - The operation type being executed
 */
export function logActionVersion(operation: string): void {
  const version = getActionVersion();
  core.info(`🏷️ SST Operations Action v${version} - ${operation} operation`);
}
