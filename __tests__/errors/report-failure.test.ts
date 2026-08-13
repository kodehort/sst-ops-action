/**
 * Failure reporting, through its own interface.
 *
 * The layer the entry point actually imported had no test file at all: the
 * suite reached the error subsystem two layers down, through the constructors
 * the middle layer happened to call. So the thing that decided what a user
 * saw was never exercised directly.
 */

import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutputFormattingError, reportFailure } from "@/errors/report-failure";
import type { DeployResult } from "@/types";
import { ValidationError } from "@/utils/validation";

const failedDeploy: DeployResult = {
  app: "test-app",
  completionStatus: "failed",
  error: "Authentication failed",
  exitCode: 1,
  operation: "deploy",
  outputs: [],
  rawOutput: "",
  resourceChanges: 0,
  resources: [],
  stage: "staging",
  success: false,
  truncated: false,
};

describe("Reporting a failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("one message format", () => {
    it("names the operation for a failed result", () => {
      reportFailure({
        failOnError: true,
        result: failedDeploy,
        type: "result",
      });

      expect(core.setFailed).toHaveBeenCalledWith(
        "SST deploy operation failed: Authentication failed"
      );
    });

    it("says the same thing when the operation threw instead", () => {
      // These two used to print different things: a failed result terminated
      // at a bare call in the entry point, a thrown error went through the
      // elaborate handler.
      reportFailure({
        error: new Error("Authentication failed"),
        failOnError: true,
        operation: "deploy",
        stage: "staging",
        type: "operation",
      });

      expect(core.setFailed).toHaveBeenCalledWith(
        "SST deploy operation failed: Authentication failed"
      );
    });

    it("falls back to a fixed phrase when a result carries no error", () => {
      const { error: _dropped, ...withoutError } = failedDeploy;

      reportFailure({
        failOnError: true,
        result: withoutError,
        type: "result",
      });

      expect(core.setFailed).toHaveBeenCalledWith(
        "SST deploy operation failed: Unknown error"
      );
    });

    it("does not name an operation when none ran", () => {
      reportFailure({ error: new Error("boom"), type: "unexpected" });

      expect(core.setFailed).toHaveBeenCalledWith("SST action failed: boom");
    });

    it("handles a thrown non-Error", () => {
      reportFailure({ error: "just a string", type: "unexpected" });

      expect(core.setFailed).toHaveBeenCalledWith(
        "SST action failed: just a string"
      );
    });
  });

  describe("the fail-on-error decision", () => {
    it("fails the workflow when fail-on-error is set", () => {
      reportFailure({
        failOnError: true,
        result: failedDeploy,
        type: "result",
      });

      expect(core.setFailed).toHaveBeenCalled();
      expect(core.warning).not.toHaveBeenCalled();
    });

    it("warns and continues when it is not", () => {
      reportFailure({
        failOnError: false,
        result: failedDeploy,
        type: "result",
      });

      expect(core.setFailed).not.toHaveBeenCalled();
      expect(core.warning).toHaveBeenCalledWith(
        "SST deploy operation failed: Authentication failed"
      );
      expect(core.info).toHaveBeenCalledWith(
        "🔄 Continuing workflow as fail-on-error is disabled"
      );
    });

    it("fails on bad inputs regardless, because nothing ran", () => {
      // fail-on-error is about tolerating a failed operation. There is no
      // operation here, so continuing would run the rest of a workflow on a
      // false premise.
      reportFailure({
        error: new ValidationError("Token cannot be empty", "token", ""),
        type: "input-validation",
      });

      expect(core.setFailed).toHaveBeenCalledWith(
        "SST action failed: Token cannot be empty"
      );
    });
  });

  describe("context", () => {
    it("shows the offending field and its suggestions", () => {
      reportFailure({
        error: new ValidationError("Token cannot be empty", "token", "", [
          "Use secrets.GITHUB_TOKEN",
        ]),
        type: "input-validation",
      });

      expect(core.error).toHaveBeenCalledWith("Invalid input: token = ");
      expect(core.info).toHaveBeenCalledWith("  • Use secrets.GITHUB_TOKEN");
    });

    it("shows a non-zero exit code", () => {
      reportFailure({
        failOnError: true,
        result: failedDeploy,
        type: "result",
      });

      expect(core.info).toHaveBeenCalledWith("Exit code: 1");
    });

    it("keeps the stack out of the log and in the debug channel", () => {
      reportFailure({ error: new Error("boom"), type: "unexpected" });

      expect(core.debug).toHaveBeenCalledWith(
        expect.stringContaining("Stack trace:")
      );
    });
  });

  describe("OutputFormattingError", () => {
    it("is recognisable by type rather than by phrase", () => {
      // Classification used to be error.message.includes("Failed to set
      // outputs") against a message the error subsystem did not own, so
      // rewording a throw silently changed how it was handled.
      const error = new OutputFormattingError("anything at all");

      expect(error).toBeInstanceOf(OutputFormattingError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("OutputFormattingError");
    });

    it("is recognised by the reporter, which says the operation may have run", () => {
      reportFailure({
        error: new OutputFormattingError("Failed to set outputs: boom"),
        failOnError: true,
        operation: "deploy",
        stage: "staging",
        type: "operation",
      });

      expect(core.info).toHaveBeenCalledWith(
        "The operation itself may have completed; the failure was in writing its outputs."
      );
    });

    it("keeps the original error as its cause", () => {
      const cause = new Error("underlying");
      const error = new OutputFormattingError("wrapper", { cause });

      expect(error.cause).toBe(cause);
    });
  });
});
