/**
 * Builders for resolved action inputs.
 *
 * `ResolvedInputs` has no optional fields — that is the point of it, since an
 * optional field is somewhere a default gets applied a second time. Tests that
 * only care about one or two values would otherwise have to spell out the
 * whole shape, so they spread a builder and override what matters.
 */

import type { InfrastructureInputs, StageInputs } from "@/inputs/resolve";

/**
 * Inputs for an operation that runs the SST CLI, with the values the resolver
 * would have produced for an otherwise empty workflow.
 */
export function infrastructureInputs(
  operation: InfrastructureInputs["operation"],
  overrides: Partial<InfrastructureInputs> = {}
): InfrastructureInputs {
  return {
    commentMode: "on-success",
    failOnError: true,
    maxOutputSize: 50_000,
    operation,
    runner: "bun",
    stage: "staging",
    token: "test-token",
    ...overrides,
  };
}

/** Inputs for the stage operation. */
export function stageInputs(overrides: Partial<StageInputs> = {}): StageInputs {
  return {
    failOnError: true,
    operation: "stage",
    prefix: "pr-",
    refs: [],
    truncationLength: 26,
    ...overrides,
  };
}
