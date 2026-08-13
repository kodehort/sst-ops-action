/**
 * Stage Operation Implementation
 * Handles stage calculation based on GitHub context without SST CLI execution
 */

import * as core from "@actions/core";
import type { StageInputs } from "../inputs/resolve";
import { StageProcessor } from "../parsers/stage-processor";
import type { StageResult } from "../types";
import { logActionVersion } from "../utils/version";

/**
 * Stage operation handler for computing SST stage names
 * Pure computation operation without GitHub integration
 */
export class StageOperation {
  /**
   * Execute stage calculation operation
   * @param inputs Resolved inputs for the stage operation
   * @returns Parsed stage result with computed stage name
   */
  // biome-ignore lint/suspicious/useAwait: Async required for BaseOperation interface consistency
  async execute(inputs: StageInputs): Promise<StageResult> {
    // Log action version at the start
    logActionVersion(core.info);

    // Process stage using GitHub context (no SST CLI execution needed)
    const processor = new StageProcessor();
    // No defaults here. The resolver applied them once, which is why this
    // reads the values straight through.
    const result = processor.process({
      prefix: inputs.prefix,
      truncationLength: inputs.truncationLength,
    });

    return result;
  }
}
