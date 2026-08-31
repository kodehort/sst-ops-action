/**
 * The router is the whole operations layer now.
 *
 * These tests used to stub `OperationFactory.prototype.createOperation`, so
 * the thing under test was a stub returning a fixture and no real code ran
 * between the inputs and the result. The mocks were not even the right shape:
 * the CLI executor was given an `execute` method and the GitHub client
 * `commentOnPR`/`updateWorkflowSummary`, none of which exist. Nothing noticed,
 * because the factory was stubbed too.
 *
 * The seams are now the two the router genuinely has — the CLI and the GitHub
 * API — and both are mocked at their real interfaces. Real parsers run against
 * real captured CLI output, so a change to either shows up here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/github/client");
vi.mock("@/utils/cli");

import { GitHubClient } from "@/github/client";
import { executeOperation } from "@/operations/router";
import type { DeployResult, DiffResult, RemoveResult } from "@/types";
import { SSTCLIExecutor } from "@/utils/cli";
import {
  SST_DEPLOY_SUCCESS_OUTPUT,
  SST_DIFF_OUTPUT,
  SST_REMOVE_SUCCESS_OUTPUT,
  SST_STATE_LIST_OUTPUT,
} from "../fixtures/sst-outputs";
import { infrastructureInputs, stageInputs } from "../utils/resolved-inputs";

const executeSST = vi.fn();
const listStages = vi.fn();
const createOrUpdateComment = vi.fn();
const createWorkflowSummary = vi.fn();

/** What the CLI seam returns for a run that produced `output`. */
function cliResult(output: string, overrides: Record<string, unknown> = {}) {
  return {
    command: "bun sst deploy --stage staging",
    duration: 1000,
    exitCode: 0,
    output,
    stderr: "",
    stdout: output,
    success: true,
    truncated: false,
    ...overrides,
  };
}

describe("executeOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    executeSST.mockResolvedValue(cliResult(""));
    // The fixture lists "staging" — the builders' default stage — so remove
    // tests exercise the deployed path unless they say otherwise.
    listStages.mockResolvedValue(cliResult(SST_STATE_LIST_OUTPUT));
    createOrUpdateComment.mockResolvedValue(undefined);
    createWorkflowSummary.mockResolvedValue(undefined);

    // Mocked at the real interface. Vitest v4 needs a function, not an arrow,
    // for a constructor mock.
    vi.mocked(SSTCLIExecutor).mockImplementation(function (this: any) {
      this.executeSST = executeSST;
      this.listStages = listStages;
    } as any);

    vi.mocked(GitHubClient).mockImplementation(function (this: any) {
      this.createOrUpdateComment = createOrUpdateComment;
      this.createWorkflowSummary = createWorkflowSummary;
    } as any);
  });

  describe("running a command", () => {
    it("parses a deploy through the real parser and reports it", async () => {
      executeSST.mockResolvedValue(cliResult(SST_DEPLOY_SUCCESS_OUTPUT));

      const result = (await executeOperation(
        infrastructureInputs("deploy", { stage: "production" })
      )) as DeployResult;

      expect(result.operation).toBe("deploy");
      expect(result.success).toBe(true);
      expect(result.app).toBe("www-kodehort-com");
      expect(result.stage).toBe("production");
      expect(result.resources.length).toBeGreaterThan(0);

      expect(createOrUpdateComment).toHaveBeenCalledWith(result, "on-success");
      expect(createWorkflowSummary).toHaveBeenCalledWith(result);
    });

    it("parses a diff through the real parser and reports it", async () => {
      executeSST.mockResolvedValue(cliResult(SST_DIFF_OUTPUT));

      const result = (await executeOperation(
        infrastructureInputs("diff")
      )) as DiffResult;

      expect(result.operation).toBe("diff");
      expect(result.success).toBe(true);
      expect(createOrUpdateComment).toHaveBeenCalled();
    });

    it("parses a remove through the real parser and reports it", async () => {
      executeSST.mockResolvedValue(cliResult(SST_REMOVE_SUCCESS_OUTPUT));

      const result = (await executeOperation(
        infrastructureInputs("remove")
      )) as RemoveResult;

      expect(result.operation).toBe("remove");
      expect(result.success).toBe(true);
      expect(createOrUpdateComment).toHaveBeenCalled();
    });

    it("asks the CLI for the operation and stage, and leaves the timeout to it", async () => {
      await executeOperation(
        infrastructureInputs("diff", { maxOutputSize: 1234, stage: "pr-9" })
      );

      // No `timeout` key: it is a property of the command, so the seam owns
      // it. Every caller used to pass one, which left the seam's own default
      // unreachable.
      expect(executeSST).toHaveBeenCalledWith("diff", "pr-9", {
        maxOutputSize: 1234,
        runner: "bun",
      });
    });

    it("passes the resolved token to the GitHub client", async () => {
      await executeOperation(
        infrastructureInputs("deploy", { token: "ghp_router_token" })
      );

      expect(GitHubClient).toHaveBeenCalledWith("ghp_router_token");
    });
  });

  describe("the remove preflight", () => {
    it("skips the removal when the stage is not deployed", async () => {
      const result = (await executeOperation(
        infrastructureInputs("remove", { stage: "never-deployed" })
      )) as RemoveResult;

      expect(result.success).toBe(true);
      expect(result.completionStatus).toBe("skipped");
      expect(result.resourcesRemoved).toBe(0);
      expect(result.app).toBe("my-sst-app");
      // No removal ran, but the skip is still reported.
      expect(executeSST).not.toHaveBeenCalled();
      expect(createWorkflowSummary).toHaveBeenCalledWith(result);
    });

    it("removes as normal when the state backend knows the stage", async () => {
      executeSST.mockResolvedValue(cliResult(SST_REMOVE_SUCCESS_OUTPUT));

      const result = (await executeOperation(
        infrastructureInputs("remove", { stage: "staging" })
      )) as RemoveResult;

      expect(result.completionStatus).toBe("complete");
      expect(executeSST).toHaveBeenCalledWith("remove", "staging", {
        maxOutputSize: 50_000,
        runner: "bun",
      });
    });

    it("fails open when the stage listing cannot run", async () => {
      listStages.mockRejectedValue(new Error("spawn sst ENOENT"));
      executeSST.mockResolvedValue(cliResult(SST_REMOVE_SUCCESS_OUTPUT));

      const result = (await executeOperation(
        infrastructureInputs("remove", { stage: "never-deployed" })
      )) as RemoveResult;

      expect(executeSST).toHaveBeenCalled();
      expect(result.completionStatus).toBe("complete");
    });

    it("fails open when the stage listing exits non-zero", async () => {
      listStages.mockResolvedValue(
        cliResult("✕  AWS credentials are not configured", { exitCode: 1 })
      );
      executeSST.mockResolvedValue(cliResult(SST_REMOVE_SUCCESS_OUTPUT));

      await executeOperation(
        infrastructureInputs("remove", { stage: "never-deployed" })
      );

      expect(executeSST).toHaveBeenCalled();
    });

    it("fails open when the stage listing is unrecognisable", async () => {
      listStages.mockResolvedValue(cliResult("something entirely different"));
      executeSST.mockResolvedValue(cliResult(SST_REMOVE_SUCCESS_OUTPUT));

      await executeOperation(
        infrastructureInputs("remove", { stage: "never-deployed" })
      );

      expect(executeSST).toHaveBeenCalled();
    });

    it("leaves deploy and diff untouched by the preflight", async () => {
      await executeOperation(infrastructureInputs("deploy"));
      await executeOperation(infrastructureInputs("diff"));

      expect(listStages).not.toHaveBeenCalled();
    });
  });

  describe("the stage operation", () => {
    it("computes a stage without touching the CLI or the GitHub API", async () => {
      const result = await executeOperation(stageInputs());

      // The stage-specific fields prove the processor produced this, rather
      // than it being a failure result the router built. Whether the computed
      // stage succeeds depends on the ambient Git context, which is
      // stage-processor.test.ts's subject, not the router's.
      expect(result.operation).toBe("stage");
      expect(result).toHaveProperty("computedStage");
      expect(result).toHaveProperty("ref");

      // It used to be a class wrapping the processor, reached through a
      // factory branch that first built a GitHub client with a sentinel token.
      expect(executeSST).not.toHaveBeenCalled();
      expect(GitHubClient).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("reports a thrown CLI error as a failed result rather than throwing", async () => {
      executeSST.mockRejectedValue(new Error("spawn sst ENOENT"));

      const result = await executeOperation(infrastructureInputs("deploy"));

      expect(result.success).toBe(false);
      expect(result.completionStatus).toBe("failed");
      expect(result.error).toBe("spawn sst ENOENT");
      expect(result.operation).toBe("deploy");
    });

    it("still parses and reports a failed command, for every operation", async () => {
      // Diff used to bail out here with a synthetic result, posting no comment
      // at all, while deploy and remove parsed the failure and commented on
      // it. One policy now: run, parse, report.
      executeSST.mockResolvedValue(
        cliResult("", {
          exitCode: 1,
          stderr: "Authentication failed: Invalid SST token",
          success: false,
        })
      );

      const result = (await executeOperation(
        infrastructureInputs("diff", { commentMode: "always" })
      )) as DiffResult;

      expect(result.success).toBe(false);
      expect(result.completionStatus).toBe("failed");
      // The CLI's account of the failure survives; only the deploy parser
      // extracts an error from the text.
      expect(result.error).toBe("Authentication failed: Invalid SST token");
      // Never "0 changes planned", which reads as "nothing to do".
      expect(result.changeSummary).toBe(
        "Diff failed - unable to determine changes"
      );
      expect(createOrUpdateComment).toHaveBeenCalled();
    });

    it("rejects an operation type it cannot build a result for", async () => {
      await expect(
        executeOperation({ operation: "invalid" } as any)
      ).rejects.toThrow(
        "Cannot create error result for unknown operation: invalid"
      );
    });
  });
});
