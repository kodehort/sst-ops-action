/**
 * `max-output-size: 0` is documented as unlimited and behaved as 50KB.
 *
 * `0` is falsy, so `options.maxOutputSize || default` read it as *absent* and
 * substituted the default — giving the tightest realistic budget rather than
 * no budget, the opposite of what `action.yml` promises (#160).
 *
 * The contract was already written down twice: `action.yml` says "Use 0 for
 * unlimited", and `validateMaxOutputSize` special-cases `0` and its error
 * message reads "(except 0 for unlimited)". Only the consumer disagreed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as exec from "@actions/exec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateMaxOutputSize } from "@/types";
import { SSTCLIExecutor } from "@/utils/cli";
import { INPUT_DEFAULTS } from "@/utils/validation";

/** Emit `size` bytes on stdout from the mocked child process. */
function emitting(size: number) {
  return (
    _cmd: string,
    _args: string[],
    options: {
      listeners?: {
        stdout?: (data: Buffer) => void;
      };
    }
  ) => {
    options.listeners?.stdout?.(Buffer.from("x".repeat(size)));
    return Promise.resolve(0);
  };
}

describe("max-output-size: 0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures without truncating, however much arrives", async () => {
    // Comfortably past the 50KB default that `0` used to collapse to.
    const size = 400_000;
    vi.mocked(exec.exec).mockImplementation(emitting(size) as never);

    const result = await new SSTCLIExecutor().executeSST("diff", "staging", {
      maxOutputSize: 0,
    });

    expect(result.output.length).toBe(size);
    expect(result.truncated).toBe(false);
  });

  it("still truncates when a budget is set", async () => {
    vi.mocked(exec.exec).mockImplementation(emitting(80_000) as never);

    const result = await new SSTCLIExecutor().executeSST("diff", "staging", {
      maxOutputSize: 50_000,
    });

    expect(result.output.length).toBe(50_000);
    expect(result.truncated).toBe(true);
  });

  it("still applies the default when the budget is absent", async () => {
    vi.mocked(exec.exec).mockImplementation(emitting(80_000) as never);

    const result = await new SSTCLIExecutor().executeSST("diff", "staging", {});

    // Absent and zero must not mean the same thing — conflating them is the
    // bug. Absent takes the default; zero takes no cap.
    expect(result.truncated).toBe(true);
    expect(result.output.length).toBe(INPUT_DEFAULTS.maxOutputSize);
  });
});

describe("The documented budget", () => {
  const actionYml = readFileSync(join(process.cwd(), "action.yml"), "utf8");

  it("admits 0, as the documentation and the validator both promise", () => {
    expect(validateMaxOutputSize(0)).toBe(0);
    expect(actionYml).toMatch(/Use 0 for unlimited/);
  });

  it("agrees with the validator on the default", () => {
    // Three values disagreed: action.yml and INPUT_DEFAULTS said 50000, while
    // the CLI seam used 50 * 1024. That 51200 was only reachable through the
    // `0` bug, so setting `0` produced a budget stated nowhere.
    expect(actionYml).toMatch(
      new RegExp(`default: "${INPUT_DEFAULTS.maxOutputSize}"`)
    );
    expect(actionYml).toMatch(
      new RegExp(`Default: ${INPUT_DEFAULTS.maxOutputSize}`)
    );
  });

  it("states a maximum the validator actually enforces", () => {
    const max = 1024 * 1024;

    expect(validateMaxOutputSize(max)).toBe(max);
    expect(() => validateMaxOutputSize(max + 1)).toThrow();
    // Documented as 1000000 while the validator allowed 1048576.
    expect(actionYml).toContain(String(max));
    expect(actionYml).not.toMatch(/Range: 1000-1000000/);
  });

  it("states a range that does not contradict the 0 sentence", () => {
    // The range line read "1000-1000000" directly above a sentence offering
    // 0, which is outside it. `/0/` would pass on any digit in "1000", so
    // this asserts 0 is named as a value rather than merely present.
    const range = actionYml.match(/• Range: (.+)/)?.[1] ?? "";
    expect(range).not.toBe("");
    expect(range).toMatch(/(^|[^\d])0([^\d]|$)/);
  });
});
