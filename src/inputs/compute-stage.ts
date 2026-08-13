/**
 * The production adapter for stage computation.
 *
 * Split from the entry point so it can be exercised directly. Reaching its
 * failure path used to require `vi.spyOn(StageProcessor.prototype, "process")`
 * from the entry-point tests, which is prototype surgery standing in for a
 * seam that did not exist.
 */

import * as core from "@actions/core";
import { StageProcessor } from "../parsers/stage-processor";
import type { ComputeStage } from "./resolve";

/**
 * Compute a stage name from the real Git context.
 *
 * @throws {Error} When no valid stage can be computed. Unrecoverable: a
 *   guessed stage would deploy somewhere nobody asked for.
 */
export const computeStageFromGitContext: ComputeStage = ({
  prefix,
  truncationLength,
}) => {
  const result = new StageProcessor().process({ prefix, truncationLength });

  if (result.success && result.computedStage) {
    core.info(`🎯 Computed stage from Git context: "${result.computedStage}"`);
    return result.computedStage;
  }

  const message = `Failed to compute stage from Git context: ${result.error || "Unknown error"}`;
  core.error(`❌ ${message}`);
  throw new Error(message);
};
