/**
 * Parser for `sst state list` output.
 *
 * The CLI prints a header block followed by an aligned stage column:
 *
 *   App:        my-app
 *   Provider:   AWS
 *   Region:     eu-west-2
 *   Stages:     alistairstead
 *               production
 *               staging
 *
 * The first stage shares the `Stages:` line; the rest follow indented.
 */

import { PatternHelpers } from "./patterns";

export interface StageListing {
  /** App name from the header, when present */
  app: string | undefined;
  /** Every deployed stage the state backend reported */
  stages: string[];
}

const APP_LINE = /^App:\s+(\S+)/m;
const STAGES_LINE = /^Stages:\s*(\S*)/;
const INDENTED_STAGE = /^\s+(\S+)\s*$/;

/**
 * Extract the deployed stages from `sst state list` output.
 *
 * @returns The listing, or null when the output carries no `Stages:` header —
 *   which means the format was not recognised, not that no stages exist.
 *   Callers gating a removal on this must treat null as "unknown".
 */
export function parseStageList(output: string): StageListing | null {
  const cleaned = PatternHelpers.cleanText(output);
  const lines = cleaned.split("\n");

  const headerIndex = lines.findIndex((line) => STAGES_LINE.test(line));
  if (headerIndex === -1) {
    return null;
  }

  const stages: string[] = [];
  const firstStage = lines[headerIndex]?.match(STAGES_LINE)?.[1];
  if (firstStage) {
    stages.push(firstStage);
  }

  for (const line of lines.slice(headerIndex + 1)) {
    const stage = line.match(INDENTED_STAGE)?.[1];
    if (!stage) {
      break;
    }
    stages.push(stage);
  }

  return {
    app: cleaned.match(APP_LINE)?.[1],
    stages,
  };
}
