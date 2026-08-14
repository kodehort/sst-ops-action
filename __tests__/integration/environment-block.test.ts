/**
 * The resource `environment` block must not reach a pull request comment.
 *
 * SST renders every environment variable of a changed resource into its diff
 * output. On a GitHub runner that includes the runner's own environment, which
 * carries credential-bearing URLs — `ACTIONS_ID_TOKEN_REQUEST_URL` and
 * `ACTIONS_RUNTIME_URL` embed a runner-scoped identifier, and they are not
 * masked even in the workflow log. The action reads the child process output
 * directly and posts it through the API, so nothing between the CLI and a
 * world-readable comment was removing them (#155).
 *
 * These tests drive the committed real captures end to end, parser through
 * formatter, and assert against the rendered markdown a reviewer would see.
 * Whether SST redacts *secret-valued* variables is a separate question (#176);
 * this block should not be published either way.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OperationFormatter } from "@/github/formatters";
import { DiffParser } from "@/parsers/diff-parser";

function capture(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** The flat form: one `environment.NAME = value` line per variable. */
const FLAT = "examples/inputs/diff/environment-variables.txt";

/** The block form: `environment.variables = {` opening a brace block. */
const BLOCK = "examples/outputs/diff/real-output-2-raw.txt";

/**
 * Any environment entry, in any of the three shapes.
 *
 * Deliberately not `/environment\./`. SST writes `environment["INPUT_TOKEN"]`
 * for names that are not bare identifiers, and an assertion anchored on the
 * dot passes while those lines are still being published — which is exactly
 * what happened on the first pass at this fix. The placeholder this leaves
 * behind reads `environment (N variables changed, ...)`, with a space, so it
 * does not match.
 */
const ANY_ENVIRONMENT_ENTRY = /environment[.[]/;

function render(path: string): {
  comment: string;
  diffSection: string;
  summary: string;
} {
  const result = new DiffParser().parse(capture(path), "staging", 0, false);
  const formatter = new OperationFormatter();

  return {
    comment: formatter.formatOperationComment(result),
    diffSection: result.diffSection,
    summary: formatter.formatOperationSummary(result),
  };
}

describe("The environment block", () => {
  it.each([
    ["the flat form", FLAT],
    ["the brace-block form", BLOCK],
  ])("never reaches the parsed diff section, for %s", (_shape, path) => {
    // Filtered in the parser rather than the formatter, so the lines are not
    // sitting on the result for a future consumer to re-publish.
    expect(render(path).diffSection).not.toMatch(ANY_ENVIRONMENT_ENTRY);
  });

  it.each([
    ["the flat form", FLAT],
    ["the brace-block form", BLOCK],
  ])("never reaches the pull request comment, for %s", (_shape, path) => {
    expect(render(path).comment).not.toMatch(ANY_ENVIRONMENT_ENTRY);
  });

  it.each([
    ["the flat form", FLAT],
    ["the brace-block form", BLOCK],
  ])("never reaches the workflow summary, for %s", (_shape, path) => {
    // The summary renders the same block through a different method. Easy to
    // fix one and miss the other.
    expect(render(path).summary).not.toMatch(ANY_ENVIRONMENT_ENTRY);
  });

  it("removes the specific values that are known to be published unmasked", () => {
    const { comment } = render(FLAT);

    // These three are not masked even in the runner log, so they certainly
    // reached the comment verbatim.
    expect(comment).not.toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(comment).not.toContain("ACTIONS_RUNTIME_URL");
    expect(comment).not.toContain("ACTIONS_CACHE_URL");
    // The runner-scoped identifier those URLs embed.
    expect(comment).not.toContain(
      "YiRw6b4j0YehLWXAZlEKzBPEU9dOCzWm5vDzxOHqrSY88agxO0"
    );
  });

  it("removes the subscript form, which carries no dot", () => {
    const { comment, diffSection } = render(FLAT);

    // The capture contains `+ environment["INPUT_COMMENT-MODE"] = on-success`.
    // The first version of this fix matched only `environment.` and published
    // eight of these, while the tests passed — they grepped for the dot too.
    expect(capture(FLAT)).toContain('environment["INPUT_');
    expect(diffSection).not.toContain('environment["');
    expect(comment).not.toContain('environment["');
  });

  it("keeps the review signal by saying how many variables changed", () => {
    const { diffSection } = render(FLAT);

    // Deleting the lines silently would tell a reviewer nothing changed. The
    // capture has 65 environment lines inside the diff section: 61 dotted and
    // 4 subscript. One placeholder stands for the whole contiguous run.
    expect(diffSection).toMatch(
      /environment \(65 variables changed, values hidden\)/
    );
    expect(diffSection.split("values hidden").length - 1).toBe(1);
  });

  it("leaves no dangling brace from the block form", () => {
    const { diffSection } = render(BLOCK);

    // `environment.variables = {` opens a block whose closing `}` is on its
    // own line. Dropping only the matching lines would strand it.
    const opens = (diffSection.match(/\{/g) || []).length;
    const closes = (diffSection.match(/\}/g) || []).length;
    expect(closes).toBe(opens);
  });

  it("leaves the rest of the diff alone", () => {
    const { diffSection } = render(BLOCK);

    // Neighbouring properties of the same resource still have to survive —
    // this is what a reviewer is actually reading.
    expect(diffSection).toContain("handler = bundle.handler");
    expect(diffSection).toContain("runtime = nodejs20.x");
    expect(diffSection).toContain("ApiFunction");
  });

  it("does not change a diff that has no environment block", () => {
    const path = "examples/outputs/diff/real-output-1-raw.txt";
    const raw = capture(path);
    expect(raw).not.toMatch(/environment\./);

    const { diffSection } = render(path);
    expect(diffSection.length).toBeGreaterThan(0);
    expect(diffSection).not.toContain("values hidden");
  });
});
