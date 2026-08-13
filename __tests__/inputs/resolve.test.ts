/**
 * Input resolution: every default applied exactly once, and a shape where
 * per-operation nonsense cannot be expressed.
 *
 * The stage computation is a parameter here, which is the whole point of
 * injecting it: reaching the stage-fallback branch used to require
 * `vi.spyOn(StageProcessor.prototype, "process")` from the entry-point tests.
 */

import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ComputeStage,
  InfrastructureInputs,
  StageInputs,
} from "@/inputs/resolve";
import { resolveActionInputs } from "@/inputs/resolve";

/** Every input unset, as `core.getInput` reports it: an empty string. */
function withInputs(inputs: Record<string, string>): void {
  vi.spyOn(core, "getInput").mockImplementation(
    (name: string) => inputs[name] ?? ""
  );
  vi.spyOn(core, "getBooleanInput").mockImplementation((name: string) =>
    inputs[name] === undefined ? true : inputs[name] === "true"
  );
}

const neverComputes: ComputeStage = () => {
  throw new Error("stage computation should not have been reached");
};

describe("Resolving action inputs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(core, "info").mockImplementation(() => {
      // silence
    });
  });

  describe("defaults", () => {
    it("applies every infrastructure default when nothing is set", () => {
      withInputs({ operation: "diff", stage: "staging", token: "t" });

      const resolved = resolveActionInputs({
        computeStage: neverComputes,
      }) as InfrastructureInputs;

      // `core.getInput` returns "" for an unset input, and a Zod default only
      // fires on undefined. If the blank-to-absent normalisation regressed,
      // these would fail as validation errors rather than wrong values.
      expect(resolved).toEqual({
        commentMode: "on-success",
        failOnError: true,
        maxOutputSize: 50_000,
        operation: "diff",
        runner: "bun",
        stage: "staging",
        token: "t",
      });
    });

    it("applies every stage default when nothing is set", () => {
      withInputs({ operation: "stage" });

      const resolved = resolveActionInputs({
        computeStage: neverComputes,
      }) as StageInputs;

      expect(resolved).toEqual({
        failOnError: true,
        operation: "stage",
        prefix: "pr-",
        truncationLength: 26,
      });
    });

    it("prefers what the user set over the default", () => {
      // Not "prod": createValidationContext reads GITHUB_REF, and on a run
      // from main it reports isProduction, which makes a remove against a
      // stage containing "prod" throw. This test is about defaults, so the
      // stage name has no business deciding whether it passes.
      withInputs({
        "comment-mode": "always",
        "fail-on-error": "false",
        "max-output-size": "1000",
        operation: "remove",
        runner: "sst",
        stage: "staging",
        token: "t",
      });

      const resolved = resolveActionInputs({
        computeStage: neverComputes,
      }) as InfrastructureInputs;

      expect(resolved.commentMode).toBe("always");
      expect(resolved.failOnError).toBe(false);
      expect(resolved.maxOutputSize).toBe(1000);
      expect(resolved.runner).toBe("sst");
    });
  });

  describe("the shape", () => {
    it("gives the stage operation no token, runner or output budget", () => {
      withInputs({ operation: "stage" });

      const resolved = resolveActionInputs({ computeStage: neverComputes });

      // The old shape handed stage an empty-string token and a hardcoded
      // runner, which is what forced a sentinel token through the router.
      expect(Object.keys(resolved).sort()).toEqual([
        // fail-on-error applies to every operation, per action.yml.
        "failOnError",
        "operation",
        "prefix",
        "truncationLength",
      ]);
    });

    it("gives an infrastructure operation no prefix or truncation length", () => {
      withInputs({ operation: "deploy", stage: "staging", token: "t" });

      const resolved = resolveActionInputs({ computeStage: neverComputes });

      expect(Object.keys(resolved)).not.toContain("prefix");
      expect(Object.keys(resolved)).not.toContain("truncationLength");
    });
  });

  describe("stage computation", () => {
    it("computes a deploy stage when the input is blank", () => {
      withInputs({ operation: "deploy", token: "t" });
      const computeStage = vi.fn().mockReturnValue("pr-123");

      const resolved = resolveActionInputs({
        computeStage,
      }) as InfrastructureInputs;

      expect(resolved.stage).toBe("pr-123");
    });

    it("passes the prefix and truncation length through to the computation", () => {
      // These belong to the stage operation, but deploy's computation uses
      // them, so a deploy that sets them still gets what it asked for.
      withInputs({
        operation: "deploy",
        prefix: "feat-",
        token: "t",
        "truncation-length": "12",
      });
      const computeStage = vi.fn().mockReturnValue("feat-x");

      resolveActionInputs({ computeStage });

      expect(computeStage).toHaveBeenCalledWith({
        prefix: "feat-",
        truncationLength: 12,
      });
    });

    it("does not compute when a deploy stage is given", () => {
      withInputs({ operation: "deploy", stage: "production", token: "t" });
      const computeStage = vi.fn();

      const resolved = resolveActionInputs({
        computeStage,
      }) as InfrastructureInputs;

      expect(computeStage).not.toHaveBeenCalled();
      expect(resolved.stage).toBe("production");
    });

    it("propagates a computation failure instead of guessing", () => {
      withInputs({ operation: "deploy", token: "t" });
      const computeStage = vi.fn().mockImplementation(() => {
        throw new Error("Failed to generate a valid stage name");
      });

      expect(() => resolveActionInputs({ computeStage })).toThrow(
        "Failed to generate a valid stage name"
      );
    });
  });

  describe("validation", () => {
    it("rejects an invalid runner rather than falling back to bun", () => {
      // This used to warn and coerce to "bun", so the schema's runner message
      // could never fire end to end and a typo silently ran the wrong package
      // manager.
      withInputs({
        operation: "deploy",
        runner: "cargo",
        stage: "s",
        token: "t",
      });

      expect(() =>
        resolveActionInputs({ computeStage: neverComputes })
      ).toThrow("Invalid runner");
    });

    it("rejects a missing operation", () => {
      withInputs({ stage: "s", token: "t" });

      expect(() =>
        resolveActionInputs({ computeStage: neverComputes })
      ).toThrow();
    });
  });
});
