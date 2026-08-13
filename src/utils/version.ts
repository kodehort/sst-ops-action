/**
 * Version utility for accessing action version information
 */

// Version is injected at build time by rollup @rollup/plugin-replace
declare const __ACTION_VERSION__: string;

/**
 * Get the current action version (injected at build time)
 *
 * Not exported: its only outside consumer was the error handler's metadata
 * block, which #149 deleted along with the rest of that subsystem.
 *
 * @returns The version string from package.json
 */
function getActionVersion(): string {
  // Handle test environment where __ACTION_VERSION__ is not defined
  if (typeof __ACTION_VERSION__ === "undefined") {
    return "test-version";
  }
  return __ACTION_VERSION__;
}

/**
 * Log the action version with a standardized format
 * @param logger Function to log the version (e.g., core.info)
 */
export function logActionVersion(logger: (message: string) => void): void {
  const version = getActionVersion();
  logger(`🏷️ SST Operations Action v${version}`);
}
