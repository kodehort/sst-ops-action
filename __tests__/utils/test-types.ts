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
  import('../../src/types/operations.js').DeployResult
>;
export type MockDiffResult = DeepPartial<
  import('../../src/types/operations.js').DiffResult
>;
export type MockRemoveResult = DeepPartial<
  import('../../src/types/operations.js').RemoveResult
>;
export type MockSSTCommandResult = DeepPartial<
  import('../../src/types/sst.js').SSTCommandResult
>;
export type MockSSTOutput = DeepPartial<{ key: string; value: string }>;
export type MockSSTResource = DeepPartial<
  import('../../src/types/sst.js').SSTResource
>;

/**
 * Helper functions for creating mock objects
 */
export const createMockDeployResult = (
  overrides: MockDeployResult = {}
): MockDeployResult => ({
  success: true,
  operation: 'deploy',
  stage: 'test',
  app: 'test-app',
  rawOutput: '',
  exitCode: 0,
  truncated: false,
  completionStatus: 'complete',
  resourceChanges: 0,
  outputs: [],
  resources: [],
  ...overrides,
});

/**
 * Helper for creating simplified resources compatible with DeployResult
 */
export const createMockDeployResource = (
  overrides: {
    name?: string;
    type?: string;
    status?: 'created' | 'updated' | 'deleted';
  } = {}
) => ({
  name: 'test-resource',
  type: 'TestResource',
  status: 'created' as const,
  ...overrides,
});

export const createMockDiffResult = (
  overrides: MockDiffResult = {}
): MockDiffResult => ({
  success: true,
  operation: 'diff',
  stage: 'test',
  app: 'test-app',
  rawOutput: '',
  exitCode: 0,
  truncated: false,
  completionStatus: 'complete',
  plannedChanges: 0,
  changeSummary: '',
  changes: [],
  ...overrides,
});

export const createMockRemoveResult = (
  overrides: MockRemoveResult = {}
): MockRemoveResult => ({
  success: true,
  operation: 'remove',
  stage: 'test',
  app: 'test-app',
  rawOutput: '',
  exitCode: 0,
  truncated: false,
  completionStatus: 'complete',
  resourcesRemoved: 0,
  removedResources: [],
  ...overrides,
});

export const createMockSSTCommandResult = (
  overrides: MockSSTCommandResult = {}
): MockSSTCommandResult => ({
  success: true,
  exitCode: 0,
  stdout: '',
  stderr: '',
  duration: 1000,
  executionTime: 1000,
  command: ['sst', 'deploy'],
  workingDirectory: '/test',
  environment: {},
  ...overrides,
});

export const createMockSSTOutput = (
  overrides: MockSSTOutput = {}
): MockSSTOutput => ({
  key: 'API',
  value: 'https://test.example.com',
  ...overrides,
});

export const createMockSSTResource = (
  overrides: MockSSTResource = {}
): MockSSTResource => ({
  type: 'TestResource',
  name: 'test-resource',
  logicalId: 'test-logical-id',
  status: 'CREATE_COMPLETE',
  ...overrides,
});

/**
 * Helper for creating change objects for DiffResult
 */
export const createMockDiffChange = (
  overrides: {
    type?: string;
    name?: string;
    action?: 'create' | 'update' | 'delete';
    details?: string;
  } = {}
) => ({
  type: 'TestResource',
  name: 'test-resource',
  action: 'create' as const,
  ...overrides,
});

/**
 * Helper for creating removed resource objects for RemoveResult
 */
export const createMockRemovedResource = (
  overrides: {
    type?: string;
    name?: string;
    status?: 'removed' | 'failed' | 'skipped';
  } = {}
) => ({
  type: 'TestResource',
  name: 'test-resource',
  status: 'removed' as const,
  ...overrides,
});

/**
 * Create a batch of mock resources for testing large collections
 */
export const createMockResourceBatch = (
  count: number,
  baseOverrides: any = {}
): any[] => {
  return Array.from({ length: count }, (_, i) => ({
    name: `Resource${i}`,
    type: 'AWS::Lambda::Function',
    status: 'created',
    ...baseOverrides,
  }));
};

/**
 * Create a batch of mock outputs for testing large collections
 */
export const createMockOutputBatch = (
  count: number,
  baseOverrides: any = {}
): MockSSTOutput[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockSSTOutput({
      key: `Service${i}`,
      value: `https://service${i}.example.com`,
      ...baseOverrides,
    })
  );
};
