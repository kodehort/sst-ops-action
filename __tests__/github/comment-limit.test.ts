/**
 * A comment body over GitHub's limit is rejected, and the failure is silent.
 *
 * `GitHubClient.createOrUpdateComment` turns an API failure into a warning and
 * resolves, so a comment that breaches the limit simply never appears while
 * the run stays green. Nothing bounded the rendered body: the formatter caps
 * the resource and outputs lists, but the diff section — the largest and most
 * variable content — was emitted whole (#177).
 *
 * Measured before the fix: the comment is the diff section plus ~532
 * characters, so a capture over roughly 88KB produced an unpostable comment.
 * `max-output-size` already permits 1MB.
 */

import { describe, expect, it } from "vitest";
import { OperationFormatter } from "@/github/formatters";
import type { DiffResult } from "@/types";

/** GitHub rejects an issue or pull request comment body longer than this. */
const COMMENT_LIMIT = 65_536;

const formatter = new OperationFormatter();

function diffWith(diffSection: string): DiffResult {
  return {
    app: "test-app",
    changeSummary: "3 changes planned",
    changes: [
      { action: "create", name: "Fn", type: "Function" },
      { action: "update", name: "Bucket", type: "Bucket" },
      { action: "delete", name: "Queue", type: "Queue" },
    ],
    completionStatus: "complete",
    diffSection,
    exitCode: 0,
    operation: "diff",
    permalink: "https://sst.dev/u/abc123",
    plannedChanges: 3,
    rawOutput: "",
    stage: "staging",
    success: true,
    truncated: false,
  };
}

/** A diff section far beyond the limit, in realistic-looking lines. */
function oversizedDiffSection(): string {
  const line = "   * environment_placeholder = some/reasonably/long/value/here";
  return Array.from(
    { length: Math.ceil((COMMENT_LIMIT * 2) / line.length) },
    (_, i) => `${line}-${i}`
  ).join("\n");
}

describe("The comment length guard", () => {
  it("keeps an oversized comment under GitHub's limit", () => {
    const comment = formatter.formatOperationComment(
      diffWith(oversizedDiffSection())
    );

    expect(comment.length).toBeLessThanOrEqual(COMMENT_LIMIT);
  });

  it("says it truncated, and points at the summary", () => {
    const comment = formatter.formatOperationComment(
      diffWith(oversizedDiffSection())
    );

    // Silently cutting would be as misleading as silently dropping the whole
    // comment — a reviewer would read a partial diff as the whole one.
    expect(comment).toMatch(/truncated/i);
    expect(comment).toMatch(/workflow summary/i);
  });

  it("cuts on a line boundary", () => {
    const comment = formatter.formatOperationComment(
      diffWith(oversizedDiffSection())
    );

    // A half-line inside a fenced diff reads as corrupted output.
    const body = comment.slice(0, comment.indexOf("```\n\n</details>"));
    for (const line of body.split("\n")) {
      if (line.startsWith("   * environment_placeholder")) {
        expect(line).toMatch(/-\d+$/);
      }
    }
  });

  it("closes the code fence and the details block it cut into", () => {
    const comment = formatter.formatOperationComment(
      diffWith(oversizedDiffSection())
    );

    // The diff lives inside `<details>` wrapping a ```diff fence. Truncating
    // mid-block leaves both open, which breaks rendering for everything after
    // it in the comment.
    expect((comment.match(/```/g) || []).length % 2).toBe(0);
    expect((comment.match(/<details>/g) || []).length).toBe(
      (comment.match(/<\/details>/g) || []).length
    );
  });

  it("leaves a comment that already fits completely alone", () => {
    const ordinary = diffWith("+ Function MyFunction\n* Bucket MyBucket");
    const comment = formatter.formatOperationComment(ordinary);

    expect(comment).not.toMatch(/truncated/i);
    expect(comment).toContain("+ Function MyFunction");
    expect(comment).toContain("* Bucket MyBucket");
  });

  it("does not truncate the workflow summary to the same bound", () => {
    // The summary has a 1MB budget and is what the notice points at, so
    // applying the comment's limit to it would remove the fallback.
    const summary = formatter.formatOperationSummary(
      diffWith(oversizedDiffSection())
    );

    expect(summary.length).toBeGreaterThan(COMMENT_LIMIT);
    expect(summary).not.toMatch(/truncated/i);
  });

  it("bounds every operation's comment, not just diff", () => {
    // The guard sits at the single entry point rather than in the diff path,
    // so a future unbounded field in any operation cannot slip past it.
    const huge = "x".repeat(COMMENT_LIMIT * 2);
    const comment = formatter.formatOperationComment({
      app: huge,
      completionStatus: "complete",
      exitCode: 0,
      operation: "remove",
      rawOutput: "",
      stage: "staging",
      success: true,
      truncated: false,
    });

    expect(comment.length).toBeLessThanOrEqual(COMMENT_LIMIT);
  });
});

/**
 * The summary has its own limit, and the same silent failure.
 *
 * `createWorkflowSummary` catches a failed write into a warning and resolves,
 * exactly as the comment path did. GitHub caps a job summary at 1MB. That was
 * unreachable while capture was capped at 1MB (a 1MB capture yields roughly a
 * 730KB summary), but `max-output-size: 0` now means genuinely unlimited
 * capture (#160), so the summary is the next unbounded surface.
 */
describe("The summary length guard", () => {
  const SUMMARY_LIMIT = 1024 * 1024;

  function hugeDiff(bytes: number): DiffResult {
    const line = "   * some.property = a/reasonably/long/value/goes/here";
    return diffWith(
      Array.from(
        { length: Math.ceil(bytes / line.length) },
        (_, i) => `${line}-${i}`
      ).join("\n")
    );
  }

  it("keeps an oversized summary under GitHub's 1MB limit", () => {
    const summary = formatter.formatOperationSummary(
      hugeDiff(2 * SUMMARY_LIMIT)
    );

    expect(summary.length).toBeLessThanOrEqual(SUMMARY_LIMIT);
    expect(summary).toMatch(/truncated/i);
  });

  it("still allows a summary far larger than a comment", () => {
    // The summary is the comment's fallback, so it must not collapse to the
    // comment's much tighter bound.
    const summary = formatter.formatOperationSummary(hugeDiff(200_000));

    expect(summary.length).toBeGreaterThan(COMMENT_LIMIT);
    expect(summary).not.toMatch(/truncated/i);
  });

  it("closes the blocks it cut into", () => {
    const summary = formatter.formatOperationSummary(
      hugeDiff(2 * SUMMARY_LIMIT)
    );

    expect((summary.match(/```/g) || []).length % 2).toBe(0);
    expect((summary.match(/<details>/g) || []).length).toBe(
      (summary.match(/<\/details>/g) || []).length
    );
  });
});
