import { describe, expect, it } from "vitest";
import { parseStageList } from "@/parsers/stage-list";
import { SST_STATE_LIST_OUTPUT } from "../fixtures/sst-outputs";

describe("parseStageList", () => {
  it("reads every stage from the aligned Stages block", () => {
    const listing = parseStageList(SST_STATE_LIST_OUTPUT);

    expect(listing).toEqual({
      app: "my-sst-app",
      stages: ["staging", "production", "pr-42"],
    });
  });

  it("reads a single stage carried on the Stages line itself", () => {
    const listing = parseStageList("App:  solo-app\nStages:     production\n");

    expect(listing).toEqual({ app: "solo-app", stages: ["production"] });
  });

  it("strips ANSI codes before matching", () => {
    const listing = parseStageList(
      "\x1b[1mApp:\x1b[0m        my-app\n\x1b[1mStages:\x1b[0m     staging\n"
    );

    expect(listing).toEqual({ app: "my-app", stages: ["staging"] });
  });

  it("returns an empty stage list when the header carries no stages", () => {
    const listing = parseStageList("App:  bare-app\nStages:\n");

    expect(listing).toEqual({ app: "bare-app", stages: [] });
  });

  it("stops reading at the first line that is not an indented stage", () => {
    const listing = parseStageList(
      "Stages:     staging\n            pr-1\nWarning: something else\n"
    );

    expect(listing?.stages).toEqual(["staging", "pr-1"]);
  });

  it("excludes a stage annotated (not deployed) without stopping the parse", () => {
    // The CLI appends the current OS user's personal stage marked
    // "(not deployed)" when the backend has no state for it — on CI that
    // phantom is literally named `runner`. It must neither count as deployed
    // nor hide stages listed after it.
    const listing = parseStageList(
      "Stages:     staging\n            runner (not deployed)\n            production\n"
    );

    expect(listing?.stages).toEqual(["staging", "production"]);
  });

  it("excludes a (not deployed) stage carried on the Stages line itself", () => {
    const listing = parseStageList("Stages:     runner (not deployed)\n");

    expect(listing?.stages).toEqual([]);
  });

  it("keeps a stage with an unrecognised annotation", () => {
    const listing = parseStageList(
      "Stages:     staging\n            pr-7 (locked)\n"
    );

    expect(listing?.stages).toEqual(["staging", "pr-7"]);
  });

  it("returns null for output with no Stages header, not an empty list", () => {
    expect(parseStageList("✕  AWS credentials are not configured")).toBeNull();
    expect(parseStageList("")).toBeNull();
  });
});
