/**
 * Fixture-driven pipeline test: parser → router → output formatter.
 *
 * This seam had never been tested. Every seam around the router's transform was
 * mocked — the router tests fed hand-written fixtures no parser produces, the
 * operation tests stubbed the parser, the integration test mocked the router
 * wholesale, and the snapshot tests ran parser to formatter and skipped the
 * router entirely. So nothing put a real parser result through the router, and
 * the transform silently rebuilt every result from an envelope that was always
 * undefined.
 *
 * Only the two ends are stubbed here: the CLI (replaced by a real captured
 * fixture) and the GitHub client (no network). Parser, router and formatter are
 * the real thing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/github/client");
vi.mock("@/utils/cli");

import { GitHubClient } from "@/github/client";
import { OperationFormatter } from "@/github/formatters";
import type { InfrastructureInputs } from "@/inputs/resolve";
import { executeOperation } from "@/operations/router";
import type { DeployResult, DiffResult, RemoveResult } from "@/types";
import { SSTCLIExecutor } from "@/utils/cli";
import { loadInput } from "../utils/snapshot-helpers";

/** Resolved inputs for one of the three operations that run the SST CLI. */
function inputsFor(
  operation: InfrastructureInputs["operation"],
  overrides: Partial<InfrastructureInputs> = {}
): InfrastructureInputs {
  return {
    commentMode: "never",
    failOnError: true,
    maxOutputSize: 500_000,
    operation,
    runner: "bun",
    stage: "sst-ops-actions",
    token: "test-token",
    ...overrides,
  };
}

/**
 * Stub the CLI seam with a real captured SST run.
 */
function withCapture(
  capture: string,
  exitCode: number,
  truncated = false
): void {
  vi.mocked(SSTCLIExecutor).mockImplementation(function (this: any) {
    this.executeSST = vi.fn().mockResolvedValue({
      command: "sst",
      exitCode,
      output: capture,
      stderr: "",
      stdout: capture,
      success: exitCode === 0,
      truncated,
    });
  } as any);
}

describe("Captured CLI output through parser, router and formatter", () => {
  const formatter = new OperationFormatter();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(GitHubClient).mockImplementation(function (this: any) {
      this.createOrUpdateComment = vi.fn().mockResolvedValue(undefined);
      this.createWorkflowSummary = vi.fn().mockResolvedValue(undefined);
    } as any);
  });

  it("reports the real app name for a captured deploy", async () => {
    withCapture(loadInput("deploy", "output-deployment"), 0);

    const result = (await executeOperation(
      inputsFor("deploy")
    )) as DeployResult;

    // The transform used to make this the literal string "unknown" on every
    // run, for every operation.
    expect(result.app).not.toBe("unknown");
    expect(result.app).toBe("www-kodehort-com");
    expect(result.operation).toBe("deploy");

    // And it has to survive all the way into what a user actually sees.
    const comment = formatter.formatOperationComment(result);
    expect(comment).toContain("www-kodehort-com");
  });

  it("reports the real app name and permalink for a captured failed deploy", async () => {
    withCapture(loadInput("deploy", "failed-deployment"), 1);

    const result = (await executeOperation(
      inputsFor("deploy")
    )) as DeployResult;

    expect(result.app).toBe("kodehort-scratch");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    // This capture ends with "View more in the console:", which no permalink
    // pattern matches, so there is nothing to preserve here. Permalink
    // survival is asserted against the remove capture below.
    expect(result.error).toBeDefined();
  });

  it("reports the real planned-change count for a captured diff", async () => {
    withCapture(loadInput("diff", "complex-changes"), 0);

    const result = (await executeOperation(inputsFor("diff"))) as DiffResult;

    expect(result.app).not.toBe("unknown");
    // The transform read this from a differently-named schema field, so the
    // output reported 0 and "No changes detected" regardless of the changes
    // just mapped.
    expect(result.plannedChanges).toBe(result.changes.length);
    expect(result.plannedChanges).toBeGreaterThan(0);
    expect(result.changeSummary).not.toBe("No changes detected");
  });

  it("reports the real app name and completion status for a captured remove", async () => {
    withCapture(loadInput("remove", "complete-cleanup"), 0);

    const result = (await executeOperation(
      inputsFor("remove")
    )) as RemoveResult;

    expect(result.app).not.toBe("unknown");
    // Read from the "✓  Removed" marker the parser now recognises, rather than
    // being dropped and defaulted to "failed".
    expect(result.completionStatus).toBe("complete");
    expect(result.success).toBe(true);
    // The transform dropped the parser's permalink entirely.
    expect(result.permalink).toBe("https://sst.dev/u/9d14bf2c");
  });

  // Truncation is a fact about capture, not about the text, so it can only come
  // from the CLI layer. The diff and remove parsers used to hardcode it false,
  // which meant the truncation warning could never fire for those operations,
  // and deploy applied a second truncation layer of its own against the same
  // budget.
  it.each([
    ["deploy", "output-deployment"],
    ["diff", "complex-changes"],
    ["remove", "complete-cleanup"],
  ] as const)("reports truncation for %s", async (operation, fixture) => {
    withCapture(loadInput(operation, fixture), 0, true);

    const result = await executeOperation(inputsFor(operation));

    expect(result.truncated).toBe(true);
  });

  it.each([
    ["deploy", "output-deployment"],
    ["diff", "complex-changes"],
    ["remove", "complete-cleanup"],
  ] as const)(
    "reports no truncation for %s when the capture is whole",
    async (operation, fixture) => {
      withCapture(loadInput(operation, fixture), 0, false);

      const result = await executeOperation(inputsFor(operation));

      expect(result.truncated).toBe(false);
    }
  );
});
