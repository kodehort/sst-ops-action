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
 *               runner (not deployed)
 *
 * The first stage shares the `Stages:` line; the rest follow indented. A
 * stage can carry a parenthesised annotation — the CLI appends the current OS
 * user's personal stage marked "(not deployed)" when the backend has no state
 * for it (on a CI machine that phantom is literally named `runner`).
 */

import { PatternHelpers } from "./patterns";

export interface StageListing {
  /** App name from the header, when present */
  app: string | undefined;
  /** Every deployed stage the state backend reported */
  stages: string[];
}

const APP_LINE = /^App:\s+(\S+)/m;
const STAGES_LINE = /^Stages:\s*(.*)$/;
const INDENTED_STAGE = /^\s+(\S+)(\s+\(([^)]+)\))?\s*$/;
const STAGE_ENTRY = /^(\S+)(\s+\(([^)]+)\))?$/;
const NOT_DEPLOYED = "not deployed";

/**
 * Extract the deployed stages from `sst state list` output.
 *
 * A stage annotated "(not deployed)" is excluded — it exists only as the
 * CLI's suggestion, and there is nothing behind it to remove. Any other
 * annotation keeps the stage in the list, erring toward attempting a removal.
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
  const push = (entry: string | undefined): void => {
    if (!entry) {
      return;
    }
    const match = entry.match(STAGE_ENTRY);
    if (match?.[1] && match[3] !== NOT_DEPLOYED) {
      stages.push(match[1]);
    }
  };

  push(lines[headerIndex]?.match(STAGES_LINE)?.[1]?.trim());

  for (const line of lines.slice(headerIndex + 1)) {
    const match = line.match(INDENTED_STAGE);
    if (!match?.[1]) {
      break;
    }
    if (match[3] !== NOT_DEPLOYED) {
      stages.push(match[1]);
    }
  }

  return {
    app: cleaned.match(APP_LINE)?.[1],
    stages,
  };
}
