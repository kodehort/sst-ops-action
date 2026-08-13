/**
 * Operation Factory
 * Creates operation instances based on operation type
 * Provides consistent interface for all SST operations
 */

import type { GitHubClient } from "../github/client";
import type {
  InfrastructureInputs,
  ResolvedInputs,
  StageInputs,
} from "../inputs/resolve";
import type { OperationResult, SSTOperation } from "../types";
import { SST_OPERATIONS } from "../types/operations";
import type { SSTCLIExecutor } from "../utils/cli";
import { DeployOperation } from "./deploy";
import { DiffOperation } from "./diff";
import { RemoveOperation } from "./remove";
import { StageOperation } from "./stage";

/**
 * An operation bound to the inputs it accepts.
 *
 * The stage operation takes a different shape from the three that run the SST
 * CLI, so the factory returns a closure over the resolved inputs rather than
 * something that takes a bag every caller has to re-check.
 */
export type BoundOperation = () => Promise<OperationResult>;

/**
 * Factory for creating SST operation instances
 * Encapsulates the creation logic and dependencies
 */
export class OperationFactory {
  private readonly cliExecutor: SSTCLIExecutor;
  private readonly createGitHubClient: () => GitHubClient;

  /**
   * @param createGitHubClient Called only by the operations that need it. The
   *   stage operation has no GitHub client, which is why this is a function
   *   rather than an instance: constructing one eagerly is what required a
   *   sentinel token to get past its credential check.
   */
  constructor(
    cliExecutor: SSTCLIExecutor,
    createGitHubClient: () => GitHubClient
  ) {
    this.cliExecutor = cliExecutor;
    this.createGitHubClient = createGitHubClient;
  }

  /**
   * Bind an operation to the inputs it was resolved with
   * @param inputs Resolved action inputs, tagged by operation
   * @returns A thunk that runs the operation
   * @throws Error if operation type is unknown
   */
  createOperation(inputs: ResolvedInputs): BoundOperation {
    switch (inputs.operation) {
      case "deploy": {
        const operation = new DeployOperation(
          this.cliExecutor,
          this.createGitHubClient()
        );
        return () => operation.execute(inputs satisfies InfrastructureInputs);
      }
      case "diff": {
        const operation = new DiffOperation(
          this.cliExecutor,
          this.createGitHubClient()
        );
        return () => operation.execute(inputs satisfies InfrastructureInputs);
      }
      case "remove": {
        const operation = new RemoveOperation(
          this.cliExecutor,
          this.createGitHubClient()
        );
        return () => operation.execute(inputs satisfies InfrastructureInputs);
      }
      case "stage": {
        const operation = new StageOperation();
        return () => operation.execute(inputs satisfies StageInputs);
      }
      default: {
        const _exhaustive: never = inputs;
        throw new Error(
          `Unknown operation type: ${(_exhaustive as { operation: string }).operation}`
        );
      }
    }
  }

  /**
   * Validate that an operation type is supported
   * @param operationType The operation type to validate
   * @returns true if the operation type is valid
   */
  static isValidOperationType(
    operationType: string
  ): operationType is SSTOperation {
    return SST_OPERATIONS.includes(operationType as SSTOperation);
  }

  /**
   * Get all supported operation types
   * @returns Array of supported operation types
   */
  static getSupportedOperations(): SSTOperation[] {
    return [...SST_OPERATIONS];
  }
}
