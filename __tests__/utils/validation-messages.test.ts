/**
 * What a user sees when their inputs are wrong.
 *
 * The existing validation tests mostly assert `toThrow()` with no argument, so
 * they pass whatever the message says. That is fine for "this input is
 * rejected" but useless as a guard when the point of a change is that the
 * messages do *not* move — which is exactly the constraint on #140 and #141,
 * both of which restructure how these strings are produced.
 *
 * These are characterisation tests: they record the messages as they are, not
 * as anyone designed them. "Invalid input" for a bad operation is not good
 * text, but changing it is a separate decision from restructuring the module
 * that emits it.
 */

import { describe, expect, it } from "vitest";
import { parseOperationInputs, ValidationError } from "@/utils/validation";

interface Expected {
  field: string;
  firstSuggestion: string;
  message: string;
}

const cases: [string, Record<string, unknown>, Expected][] = [
  [
    "an unrecognised operation",
    { operation: "explode", token: "t" },
    {
      field: "operation",
      firstSuggestion: "Valid operations are: deploy, diff, remove, stage",
      message: "Invalid input",
    },
  ],
  [
    "a missing token",
    { operation: "deploy", stage: "s" },
    {
      field: "token",
      firstSuggestion:
        "Deploy operations require GitHub token for authentication",
      message: "Invalid input: expected string, received undefined",
    },
  ],
  [
    "a stage with illegal characters",
    { operation: "diff", stage: "not a stage!", token: "t" },
    {
      field: "stage",
      firstSuggestion: "Diff operations require explicit stage name",
      message:
        "Stage must contain only alphanumeric characters, hyphens, and underscores",
    },
  ],
  [
    "a prefix that is not lowercase",
    { operation: "stage", prefix: "BAD_PREFIX" },
    {
      field: "prefix",
      firstSuggestion: "Prefix is added to stage names that start with numbers",
      message:
        "Prefix must contain only lowercase letters, numbers, and hyphens",
    },
  ],
  [
    "a truncation length out of range",
    { operation: "stage", truncationLength: 500 },
    {
      field: "truncationLength",
      firstSuggestion:
        "Truncation length controls maximum stage name length (1-100 characters)",
      message: "Truncation length must be between 1 and 100 characters",
    },
  ],
  [
    "an unrecognised comment mode",
    {
      commentMode: "sometimes",
      operation: "deploy",
      stage: "s",
      token: "t",
    },
    {
      field: "commentMode",
      firstSuggestion:
        "Valid comment modes are: always, on-success, on-failure, never",
      message:
        "Invalid comment mode. Must be one of: always, on-success, on-failure, never",
    },
  ],
  [
    "an unrecognised runner",
    { operation: "deploy", runner: "cargo", stage: "s", token: "t" },
    {
      field: "runner",
      firstSuggestion: "Valid runners are: bun, npm, pnpm, yarn, sst",
      message: "Invalid runner. Must be one of: bun, npm, pnpm, yarn, sst",
    },
  ],
];

describe("Validation errors a user sees", () => {
  it.each(cases)("report %s", (_name, input, expected) => {
    let caught: unknown;
    try {
      parseOperationInputs(input);
    } catch (thrown) {
      caught = thrown;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    const error = caught as ValidationError;

    expect(error.message).toBe(expected.message);
    expect(error.field).toBe(expected.field);
    expect(error.suggestions?.[0]).toBe(expected.firstSuggestion);
  });

  it("passes a non-schema failure through untouched", () => {
    // The catch block has to distinguish a schema failure from anything else.
    // Only a schema failure becomes a ValidationError; everything else keeps
    // its identity so the caller can tell a bug from bad input.
    const exploding = {
      get operation(): string {
        throw new TypeError("not a schema problem");
      },
    };

    expect(() => parseOperationInputs(exploding)).toThrow(TypeError);
    expect(() => parseOperationInputs(exploding)).toThrow(
      "not a schema problem"
    );
  });
});
