import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubClient } from "../../src/github/client";
import type { ResolvedInputs } from "../../src/inputs/resolve";
import { OperationFactory } from "../../src/operations/factory";
import { SST_OPERATIONS } from "../../src/types/operations";
import type { SSTCLIExecutor } from "../../src/utils/cli";
import { infrastructureInputs, stageInputs } from "../utils/resolved-inputs";

const mockSSTExecutor = {
  executeSST: vi.fn(),
} as unknown as SSTCLIExecutor;

const mockGitHubClient = {
  createOrUpdateComment: vi.fn(),
  createWorkflowSummary: vi.fn(),
  postPRComment: vi.fn(),
} as unknown as GitHubClient;

describe("Operation Factory - Operation Creation", () => {
  let factory: OperationFactory;
  let createClient: () => GitHubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    createClient = vi
      .fn()
      .mockReturnValue(mockGitHubClient) as unknown as () => GitHubClient;
    factory = new OperationFactory(mockSSTExecutor, createClient);
  });

  describe("Operation Creation", () => {
    it("should create DeployOperation for deploy operation type", () => {
      const operation = factory.createOperation(infrastructureInputs("deploy"));

      expect(typeof operation).toBe("function");
    });

    it("should create DiffOperation for diff operation type", () => {
      const operation = factory.createOperation(infrastructureInputs("diff"));

      expect(typeof operation).toBe("function");
    });

    it("should create RemoveOperation for remove operation type", () => {
      const operation = factory.createOperation(infrastructureInputs("remove"));

      expect(typeof operation).toBe("function");
    });

    it("should create StageOperation for stage operation type", () => {
      const operation = factory.createOperation(stageInputs());

      expect(typeof operation).toBe("function");
    });

    it("should throw error for unknown operation type", () => {
      expect(() => {
        factory.createOperation({
          operation: "unknown",
        } as unknown as ResolvedInputs);
      }).toThrow("Unknown operation type: unknown");
    });

    it("should create different instances for each operation type", () => {
      const deploy = factory.createOperation(infrastructureInputs("deploy"));
      const diff = factory.createOperation(infrastructureInputs("diff"));
      const remove = factory.createOperation(infrastructureInputs("remove"));
      const stage = factory.createOperation(stageInputs());

      expect(deploy).not.toBe(diff);
      expect(diff).not.toBe(remove);
      expect(deploy).not.toBe(remove);
      expect(stage).not.toBe(deploy);
      expect(stage).not.toBe(diff);
      expect(stage).not.toBe(remove);
    });
  });

  describe("GitHub client", () => {
    it("is not created for the stage operation", () => {
      // The stage operation has no GitHub integration. Creating a client for
      // it eagerly is what required the sentinel token "fake-token" to get
      // past the constructor's credential check.
      factory.createOperation(stageInputs());

      expect(createClient).not.toHaveBeenCalled();
    });

    it("is created for an operation that comments", () => {
      factory.createOperation(infrastructureInputs("deploy"));

      expect(createClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("Operation Type Validation", () => {
    it("should return true for valid operation types", () => {
      expect(OperationFactory.isValidOperationType("deploy")).toBe(true);
      expect(OperationFactory.isValidOperationType("diff")).toBe(true);
      expect(OperationFactory.isValidOperationType("remove")).toBe(true);
      expect(OperationFactory.isValidOperationType("stage")).toBe(true);
    });

    it("should return false for invalid operation types", () => {
      expect(OperationFactory.isValidOperationType("unknown")).toBe(false);
      expect(OperationFactory.isValidOperationType("build")).toBe(false);
      expect(OperationFactory.isValidOperationType("")).toBe(false);
      expect(OperationFactory.isValidOperationType("DEPLOY")).toBe(false);
    });

    it("should handle null and undefined gracefully", () => {
      expect(OperationFactory.isValidOperationType(null as any)).toBe(false);
      expect(OperationFactory.isValidOperationType(undefined as any)).toBe(
        false
      );
    });
  });

  describe("Supported Operations Query", () => {
    it("should return all supported operation types", () => {
      const supportedOps = OperationFactory.getSupportedOperations();

      expect(supportedOps).toEqual([...SST_OPERATIONS]);
      expect(supportedOps).toHaveLength(4);
    });

    it("should return a new array each time (not mutate original)", () => {
      const ops1 = OperationFactory.getSupportedOperations();
      const ops2 = OperationFactory.getSupportedOperations();

      expect(ops1).toEqual(ops2);
      expect(ops1).not.toBe(ops2); // Different array instances

      ops1.push("test" as any);
      expect(ops2).not.toContain("test");
    });
  });

  describe("Instance Management", () => {
    it("should maintain separate instances for different operation types", () => {
      const deploy1 = factory.createOperation(infrastructureInputs("deploy"));
      const deploy2 = factory.createOperation(infrastructureInputs("deploy"));
      const diff1 = factory.createOperation(infrastructureInputs("diff"));

      // Each call should create a new instance
      expect(deploy1).not.toBe(deploy2);
      expect(deploy1).not.toBe(diff1);
    });
  });

  describe("Constructor Integration", () => {
    it("should create operations with the provided dependencies", () => {
      const deployOp = factory.createOperation(infrastructureInputs("deploy"));
      const diffOp = factory.createOperation(infrastructureInputs("diff"));
      const removeOp = factory.createOperation(infrastructureInputs("remove"));
      const stageOp = factory.createOperation(stageInputs());

      // Verify all operations have required methods
      expect(typeof deployOp).toBe("function");
      expect(typeof diffOp).toBe("function");
      expect(typeof removeOp).toBe("function");
      expect(typeof stageOp).toBe("function");
    });

    it("binds the inputs rather than taking them later", () => {
      // The factory closes over the resolved inputs, so the caller cannot hand
      // a stage operation an infrastructure bag by mistake.
      const operation = factory.createOperation(infrastructureInputs("deploy"));

      expect(typeof operation).toBe("function");
      expect(operation.length).toBe(0);
    });
  });

  describe("Type Safety Validation", () => {
    it("should enforce correct operation types at compile time", () => {
      // These should compile without errors
      factory.createOperation(infrastructureInputs("deploy"));
      factory.createOperation(infrastructureInputs("diff"));
      factory.createOperation(infrastructureInputs("remove"));
      factory.createOperation(stageInputs());

      // This would cause TypeScript compile error if uncommented:
      // factory.createOperation('invalid');
    });

    it("should return operations with correct interfaces", () => {
      const deployOp = factory.createOperation(infrastructureInputs("deploy"));
      const diffOp = factory.createOperation(infrastructureInputs("diff"));
      const removeOp = factory.createOperation(infrastructureInputs("remove"));
      const stageOp = factory.createOperation(stageInputs());

      expect(typeof deployOp).toBe("function");
      expect(typeof diffOp).toBe("function");
      expect(typeof removeOp).toBe("function");
      expect(typeof stageOp).toBe("function");
    });
  });
});
