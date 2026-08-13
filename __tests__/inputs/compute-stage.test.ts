/**
 * The production stage-computation adapter.
 *
 * Its failure path used to be reachable only by spying on
 * `StageProcessor.prototype.process` from the entry-point tests — prototype
 * surgery standing in for a seam that did not exist. The adapter is its own
 * module now, so the processor is mocked at the module boundary.
 */

import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/parsers/stage-processor");

import { computeStageFromGitContext } from "@/inputs/compute-stage";
import { StageProcessor } from "@/parsers/stage-processor";

/** Stub the processor with whatever a run would have produced. */
function withStageResult(result: Record<string, unknown>): void {
  vi.mocked(StageProcessor).mockImplementation(function (this: {
    process: () => unknown;
  }) {
    this.process = vi.fn().mockReturnValue(result);
  } as never);
}

describe("Computing a stage from Git context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(core, "info").mockImplementation(() => {
      // silence
    });
    vi.spyOn(core, "error").mockImplementation(() => {
      // silence
    });
  });

  it("returns the computed name", () => {
    withStageResult({ computedStage: "pr-123", success: true });

    expect(
      computeStageFromGitContext({ prefix: "pr-", truncationLength: 26 })
    ).toBe("pr-123");
  });

  it("passes the prefix and truncation length to the processor", () => {
    withStageResult({ computedStage: "feat-x", success: true });

    computeStageFromGitContext({ prefix: "feat-", truncationLength: 12 });

    const instance = vi.mocked(StageProcessor).mock.instances[0] as unknown as {
      process: ReturnType<typeof vi.fn>;
    };
    expect(instance.process).toHaveBeenCalledWith({
      prefix: "feat-",
      truncationLength: 12,
    });
  });

  it("throws rather than returning a guess when computation fails", () => {
    withStageResult({
      error: "Failed to generate a valid stage name from Git context",
      success: false,
    });

    expect(() =>
      computeStageFromGitContext({ prefix: "pr-", truncationLength: 26 })
    ).toThrow("Failed to compute stage from Git context");
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to compute stage from Git context")
    );
  });

  it("throws when the processor reports success but no stage", () => {
    // A success with nothing to show for it is still unusable, and deploying
    // to an empty stage name is exactly the accident this guards against.
    withStageResult({ computedStage: "", success: true });

    expect(() =>
      computeStageFromGitContext({ prefix: "pr-", truncationLength: 26 })
    ).toThrow("Failed to compute stage from Git context");
  });
});
