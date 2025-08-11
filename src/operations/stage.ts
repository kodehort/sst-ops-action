/**
 * Stage Operation Implementation
 * Handles stage calculation based on GitHub context without SST CLI execution
 */

import { StageParser } from '../parsers/stage-parser';
import type { OperationOptions, StageResult } from '../types';

/**
 * Stage operation handler for computing SST stage names
 * Pure computation operation without GitHub integration
 */
export class StageOperation {
  // biome-ignore lint/complexity/noUselessConstructor: Constructor required for factory pattern consistency
  constructor(_sstExecutor: unknown, _githubClient: unknown) {
    // Note: Stage operation doesn't use SST CLI or GitHub client, but we maintain the same constructor signature for factory compatibility
  }

  /**
   * Execute stage calculation operation
   * @param options Operation configuration options
   * @returns Parsed stage result with computed stage name
   */
  // biome-ignore lint/suspicious/useAwait: Async required for BaseOperation interface consistency
  async execute(options: OperationOptions): Promise<StageResult> {
    // Parse stage using GitHub context (no SST CLI execution needed)
    const parser = new StageParser();
    const result = parser.parse(
      '', // No CLI output for stage operation
      options.stage, // Use provided stage as fallback
      0, // Stage operation should always succeed with exit code 0
      options.maxOutputSize,
      options.truncationLength,
      options.prefix
    );

    return result;
  }
}
