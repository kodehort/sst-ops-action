/**
 * Action input resolution
 *
 * One place reads the Actions inputs, applies each default exactly once, and
 * hands back a shape where per-operation nonsense is unrepresentable.
 *
 * Before this module, the runner was defaulted four times — coerced with a
 * warning at the read site, given a schema default that could never fire
 * because the coercion had already happened, then defaulted again on the way
 * into the operation. Comment mode was defaulted four times too, and the last
 * one used "never" where the other three used "on-success". Stage computation
 * was control flow rather than a step: the entry point caught a validation
 * error, mutated the raw inputs and re-ran validation.
 */

import * as core from "@actions/core";
import type { CommentMode } from "../types";
import type { SSTRunner } from "../utils/cli";
import {
  createValidationContext,
  INPUT_DEFAULTS,
  validateOperationWithContext,
} from "../utils/validation";

/**
 * Inputs for an operation that runs the SST CLI.
 */
export interface InfrastructureInputs {
  /** Restore, warm and save the SST provider cache around the operation. */
  cacheProviders: boolean;
  commentMode: CommentMode;
  failOnError: boolean;
  maxOutputSize: number;
  operation: "deploy" | "diff" | "remove";
  runner: SSTRunner;
  stage: string;
  token: string;
  /** Directory holding sst.config.ts; every SST command runs from here. */
  workingDirectory: string;
}

/**
 * Inputs for the stage operation, which computes a name from Git context and
 * never runs SST.
 *
 * It carries no token, runner or output budget, because it has no use for any
 * of them. The previous shape gave it all three as empty strings and a
 * hardcoded runner, which is what forced a sentinel token through the router
 * to get past a credential check for a client that was never used.
 */
export interface StageInputs {
  failOnError: boolean;
  operation: "stage";
  prefix: string;
  /** Refs to slugify in addition to the context-derived stage; often empty. */
  refs: string[];
  truncationLength: number;
}

export type ResolvedInputs = InfrastructureInputs | StageInputs;

/**
 * Computes a stage name from Git context.
 *
 * Injected because there are genuinely two adapters: the real Git context in
 * production, and a fixed one in tests. Reading the Actions input API is not
 * injected — it is already globally mocked in the test setup, so a second
 * adapter would be hypothetical.
 *
 * @throws {Error} When no valid stage can be computed. That is unrecoverable:
 *   deploying to a guessed stage is worse than not deploying.
 */
export type ComputeStage = (input: {
  prefix: string;
  truncationLength: number;
}) => string;

/**
 * Read an Actions input, treating blank as absent.
 *
 * `core.getInput` returns `""` for an input nobody set, and a Zod `.default()`
 * only fires on `undefined`. Normalising here is what lets every default live
 * in the schema instead of being applied again at the read site.
 */
function optionalInput(name: string): string | undefined {
  const value = core.getInput(name);
  return value.trim() === "" ? undefined : value;
}

/**
 * The same, for a boolean input.
 *
 * `core.getBooleanInput` throws on anything that is not a YAML boolean, and a
 * blank string is one of those. An input wired to an expression that evaluates
 * to nothing — `cache-providers: ${{ inputs.cache }}` on a workflow that did
 * not set `cache` — would otherwise fail the whole run over an optional
 * speed-up. Blank means absent here, as everywhere else in this module, and
 * the schema supplies the default; a value that is present but not a boolean
 * still throws, because that is a typo worth reporting.
 */
function optionalBooleanInput(name: string): boolean | undefined {
  return core.getInput(name).trim() === ""
    ? undefined
    : core.getBooleanInput(name);
}

/**
 * Read every Actions input, with blanks normalised to absent.
 */
function readRawInputs(): Record<string, unknown> {
  return {
    cacheProviders: optionalBooleanInput("cache-providers"),
    commentMode: optionalInput("comment-mode"),
    failOnError: core.getBooleanInput("fail-on-error"),
    maxOutputSize: optionalInput("max-output-size"),
    operation: core.getInput("operation"),
    prefix: optionalInput("prefix"),
    refs: optionalInput("refs"),
    runner: optionalInput("runner"),
    stage: optionalInput("stage"),
    token: core.getInput("token"),
    truncationLength: optionalInput("truncation-length"),
    workingDirectory: optionalInput("working-directory"),
  };
}

/**
 * Resolve the action's inputs into a validated, fully-defaulted shape.
 *
 * @throws {ValidationError} When an input fails validation
 * @throws {Error} When a deploy stage must be computed and cannot be
 */
export function resolveActionInputs({
  computeStage,
}: {
  computeStage: ComputeStage;
}): ResolvedInputs {
  const raw = readRawInputs();
  const inputs = validateOperationWithContext(raw, createValidationContext());

  // Deploy may compute its stage from Git context, which uses the same two
  // inputs the stage operation takes. They are not part of the deploy shape —
  // they are arguments to the computation — so they are read here rather than
  // carried through the resolved type.
  const stageOptions = {
    prefix: (raw.prefix as string | undefined) ?? INPUT_DEFAULTS.prefix,
    truncationLength: Number(
      raw.truncationLength ?? INPUT_DEFAULTS.truncationLength
    ),
  };

  if (inputs.operation === "stage") {
    return {
      failOnError: inputs.failOnError,
      operation: "stage",
      prefix: inputs.prefix,
      refs: inputs.refs,
      truncationLength: inputs.truncationLength,
    };
  }

  return {
    cacheProviders: inputs.cacheProviders,
    commentMode: inputs.commentMode,
    failOnError: inputs.failOnError,
    maxOutputSize: inputs.maxOutputSize,
    operation: inputs.operation,
    runner: inputs.runner,
    stage: resolveStage({ computeStage, inputs, stageOptions }),
    token: inputs.token,
    workingDirectory: inputs.workingDirectory,
  };
}

/**
 * Deploy may omit the stage, in which case it is computed from Git context.
 *
 * An ordinary step, reached when the input is blank. It used to be a catch
 * block: validation was allowed to fail, the raw inputs were mutated with a
 * computed stage, and validation was run a second time.
 */
function resolveStage({
  computeStage,
  inputs,
  stageOptions,
}: {
  computeStage: ComputeStage;
  inputs: { operation: "deploy" | "diff" | "remove"; stage: string };
  stageOptions: { prefix: string; truncationLength: number };
}): string {
  if (inputs.operation !== "deploy" || inputs.stage.trim() !== "") {
    return inputs.stage;
  }

  const computed = computeStage(stageOptions);
  core.info(
    `📋 Stage input was empty, computed from Git context: "${computed}"`
  );
  return computed;
}
