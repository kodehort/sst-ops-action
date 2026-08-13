/**
 * The type module's remaining runtime surface.
 *
 * It used to export around ten validators, type guards and error constructors
 * that nothing in `src/` called — reached only from this file, which is what
 * made the dead-code tool report them as live. Three survive, and all three
 * have production callers in `src/utils/validation.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  isValidCommentMode,
  isValidOperation,
  validateMaxOutputSize,
} from "../../src/types/index.js";

describe("isValidOperation", () => {
  it("accepts every operation the action supports", () => {
    for (const operation of ["deploy", "diff", "remove", "stage"]) {
      expect(isValidOperation(operation)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isValidOperation("invalid")).toBe(false);
    expect(isValidOperation("")).toBe(false);
    expect(isValidOperation("DEPLOY")).toBe(false);
  });
});

describe("isValidCommentMode", () => {
  it("accepts every comment mode", () => {
    for (const mode of ["always", "on-success", "on-failure", "never"]) {
      expect(isValidCommentMode(mode)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isValidCommentMode("sometimes")).toBe(false);
    expect(isValidCommentMode("")).toBe(false);
  });
});

describe("validateMaxOutputSize", () => {
  it("accepts a number in range", () => {
    expect(validateMaxOutputSize(50_000)).toBe(50_000);
  });

  it("parses a numeric string, because Actions inputs arrive as text", () => {
    expect(validateMaxOutputSize("50000")).toBe(50_000);
  });

  it("rejects a value below the floor", () => {
    expect(() => validateMaxOutputSize(999)).toThrow("at least 1000 bytes");
  });

  it("rejects a value above the ceiling", () => {
    expect(() => validateMaxOutputSize(2 * 1024 * 1024)).toThrow("exceed 1MB");
  });

  it("rejects what is not a number at all", () => {
    expect(() => validateMaxOutputSize("not a number")).toThrow();
    expect(() => validateMaxOutputSize(-1)).toThrow();
  });

  it("allows zero, which action.yml documents as unlimited", () => {
    // The documentation and the implementation disagree about what 0 does
    // once it reaches the CLI executor — see #160. This asserts only that
    // validation lets it through, which it always has.
    expect(validateMaxOutputSize(0)).toBe(0);
  });
});
