/**
 * Test utility types for flexible mocking
 * These types allow creating partial mock objects without complex type casting
 */

/**
 * DeepPartial utility types for flexible mocking
 */
export type DeepPartial<Thing> = Thing extends (...args: any[]) => any
  ? Thing
  : Thing extends Array<infer InferredArrayMember>
    ? DeepPartialArray<InferredArrayMember>
    : Thing extends object
      ? DeepPartialObject<Thing>
      : Thing | undefined;

export interface DeepPartialArray<Thing> extends Array<DeepPartial<Thing>> {}

export type DeepPartialObject<Thing> = {
  [Key in keyof Thing]?: DeepPartial<Thing[Key]>;
};

/**
 * Mock result types for operation testing
 */
export type MockDeployResult = DeepPartial<
  import("../../src/types/operations.js").DeployResult
>;
export type MockDiffResult = DeepPartial<
  import("../../src/types/operations.js").DiffResult
>;

/**
 * Helper functions for creating mock objects
 */
export const createMockDeployResult = (
  overrides: MockDeployResult = {}
): MockDeployResult => ({
  app: "test-app",
  completionStatus: "complete",
  exitCode: 0,
  operation: "deploy",
  outputs: [],
  rawOutput: "",
  resourceChanges: 0,
  resources: [],
  stage: "test",
  success: true,
  truncated: false,
  ...overrides,
});

/**
 * Helper for creating simplified resources compatible with DeployResult
 */
export const createMockDeployResource = (
  overrides: {
    name?: string;
    type?: string;
    status?: "created" | "updated" | "deleted";
  } = {}
) => ({
  name: "test-resource",
  status: "created" as const,
  type: "TestResource",
  ...overrides,
});

export const createMockDiffResult = (
  overrides: MockDiffResult = {}
): MockDiffResult => ({
  app: "test-app",
  changeSummary: "",
  changes: [],
  completionStatus: "complete",
  exitCode: 0,
  operation: "diff",
  plannedChanges: 0,
  rawOutput: "",
  stage: "test",
  success: true,
  truncated: false,
  ...overrides,
});

/**
 * Create a batch of mock resources for testing large collections
 */
export const createMockResourceBatch = (
  count: number,
  baseOverrides: any = {}
): any[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `Resource${i}`,
    status: "created",
    type: "AWS::Lambda::Function",
    ...baseOverrides,
  }));
