/**
 * Version utility for accessing action version information
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Get the current action version from package.json
 * @returns The version string from package.json
 */
export function getActionVersion(): string {
  try {
    // Read package.json from the root directory
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || 'unknown';
  } catch (_error) {
    // Return fallback version if reading fails
    return 'unknown';
  }
}

/**
 * Log the action version with a standardized format
 * @param logger Function to log the version (e.g., core.info)
 */
export function logActionVersion(logger: (message: string) => void): void {
  const version = getActionVersion();
  logger(`🏷️ SST Operations Action v${version}`);
}
