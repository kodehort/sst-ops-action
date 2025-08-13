/**
 * Stage Operation Implementation
 * Handles stage calculation based on GitHub context without SST CLI execution
 */

import * as core from '@actions/core';
import { StageProcessor } from '../parsers/stage-processor';
import type { OperationOptions, StageResult } from '../types';
import { logActionVersion } from '../utils/version';

/**
 * Stage operation handler for computing SST stage names
 * Pure computation operation without GitHub integration
 */
export class StageOperation {
  /**
   * Execute stage calculation operation
   * @param options Operation configuration options
   * @returns Parsed stage result with computed stage name
   */
  // biome-ignore lint/suspicious/useAwait: Async required for BaseOperation interface consistency
  async execute(options: OperationOptions): Promise<StageResult> {
    // Log action version at the start
    logActionVersion(core.info);

    // Process stage using GitHub context (no SST CLI execution needed)
    const processor = new StageProcessor();
    const result = processor.process({
      truncationLength: options.truncationLength ?? 26,
      prefix: options.prefix ?? 'pr-',
    });

    return result;
  }
}
