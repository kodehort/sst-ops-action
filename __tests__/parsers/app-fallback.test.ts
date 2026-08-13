/**
 * A missing SST app name has to read the same way everywhere.
 *
 * There were four different fallbacks for the same unknown: `""` in the deploy
 * parser and the output formatter, `"unknown-app"` in the diff and remove
 * parsers, `"unknown"` in the router and the diff operation, and
 * `"stage-calculator"` in the stage processor.
 *
 * The empty string is the one that survives. It matches what the API
 * documentation promises, and it is falsy in Actions expressions, so a
 * consumer can write a meaningful `!= ''` check. `"unknown"` is truthy and
 * lies — a workflow guarding on the app name would take the wrong branch.
 *
 * Only observable since #143: until the router's transform was deleted, it
 * overwrote the value with its own fallback regardless of what a parser said.
 */

import { describe, expect, it } from "vitest";
import { DeployParser } from "@/parsers/deploy-parser";
import { DiffParser } from "@/parsers/diff-parser";
import { RemoveParser } from "@/parsers/remove-parser";
import { StageProcessor } from "@/parsers/stage-processor";

/** Real SST output shape with the `App:` banner line removed. */
const WITHOUT_APP_LINE = `SST 3.17.10  ready!

➜  Stage:      staging

✓  Complete
`;

describe("A missing app name", () => {
  it.each([
    ["deploy", () => new DeployParser()],
    ["diff", () => new DiffParser()],
    ["remove", () => new RemoveParser()],
  ])("is empty, not invented, for %s", (_operation, build) => {
    const result = build().parse(WITHOUT_APP_LINE, "staging", 0, false);

    expect(result.app).toBe("");
  });

  it("is empty for the stage operation, which has no app at all", () => {
    // The stage operation never talks to SST, so there is no app name to
    // report. It used to report the literal "stage-calculator", which names
    // the code rather than anything the user deployed.
    const result = new StageProcessor().process({});

    expect(result.app).toBe("");
  });
});
