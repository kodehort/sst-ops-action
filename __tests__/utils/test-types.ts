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
export type MockRemoveResult = DeepPartial<
  import("../../src/types/operations.js").RemoveResult
>;
export type MockSSTCommandResult = DeepPartial<
  import("../../src/types/sst.js").SSTCommandResult
>;
export type MockSSTOutput = DeepPartial<{ key: string; value: string }>;
export type MockSSTResource = DeepPartial<
  import("../../src/types/sst.js").SSTResource
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

export const createMockRemoveResult = (
  overrides: MockRemoveResult = {}
): MockRemoveResult => ({
  app: "test-app",
  completionStatus: "complete",
  exitCode: 0,
  operation: "remove",
  rawOutput: "",
  removedResources: [],
  resourcesRemoved: 0,
  stage: "test",
  success: true,
  truncated: false,
  ...overrides,
});

export const createMockSSTCommandResult = (
  overrides: MockSSTCommandResult = {}
): MockSSTCommandResult => ({
  command: ["sst", "deploy"],
  duration: 1000,
  environment: {},
  executionTime: 1000,
  exitCode: 0,
  stderr: "",
  stdout: "",
  success: true,
  workingDirectory: "/test",
  ...overrides,
});

export const createMockSSTOutput = (
  overrides: MockSSTOutput = {}
): MockSSTOutput => ({
  key: "API",
  value: "https://test.example.com",
  ...overrides,
});

export const createMockSSTResource = (
  overrides: MockSSTResource = {}
): MockSSTResource => ({
  logicalId: "test-logical-id",
  name: "test-resource",
  status: "CREATE_COMPLETE",
  type: "TestResource",
  ...overrides,
});

/**
 * Helper for creating change objects for DiffResult
 */
export const createMockDiffChange = (
  overrides: {
    type?: string;
    name?: string;
    action?: "create" | "update" | "delete";
    details?: string;
  } = {}
) => ({
  action: "create" as const,
  name: "test-resource",
  type: "TestResource",
  ...overrides,
});

/**
 * Helper for creating removed resource objects for RemoveResult
 */
export const createMockRemovedResource = (
  overrides: {
    type?: string;
    name?: string;
    status?: "removed" | "failed" | "skipped";
  } = {}
) => ({
  name: "test-resource",
  status: "removed" as const,
  type: "TestResource",
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

/**
 * Create a batch of mock outputs for testing large collections
 */
export const createMockOutputBatch = (
  count: number,
  baseOverrides: any = {}
): MockSSTOutput[] =>
  Array.from({ length: count }, (_, i) =>
    createMockSSTOutput({
      key: `Service${i}`,
      value: `https://service${i}.example.com`,
      ...baseOverrides,
    })
  );
