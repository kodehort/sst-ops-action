/**
 * Operation Factory
 * Creates operation instances based on operation type
 * Provides consistent interface for all SST operations
 */

import type { GitHubClient } from '../github/client';
import type { OperationOptions, SSTOperation } from '../types';
import type { SSTCLIExecutor } from '../utils/cli';
import { DeployOperation } from './deploy';
import { DiffOperation } from './diff';
import { RemoveOperation } from './remove';
import { StageOperation } from './stage';

/**
 * Base operation interface that all operations must implement
 */
export interface BaseOperation {
  execute(options: OperationOptions): Promise<unknown>;
}

/**
 * Factory for creating SST operation instances
 * Encapsulates the creation logic and dependencies
 */
export class OperationFactory {
  private readonly cliExecutor: SSTCLIExecutor;
  private readonly githubClient: GitHubClient;

  constructor(cliExecutor: SSTCLIExecutor, githubClient: GitHubClient) {
    this.cliExecutor = cliExecutor;
    this.githubClient = githubClient;
  }

  /**
   * Create an operation instance based on the operation type
   * @param operationType The type of SST operation to create
   * @returns The appropriate operation instance
   * @throws Error if operation type is unknown
   */
  createOperation(operationType: SSTOperation): BaseOperation {
    switch (operationType) {
      case 'deploy':
        return new DeployOperation(this.cliExecutor, this.githubClient);
      case 'diff':
        return new DiffOperation(this.cliExecutor, this.githubClient);
      case 'remove':
        return new RemoveOperation(this.cliExecutor, this.githubClient);
      case 'stage':
        return new StageOperation();
      default:
        throw new Error(
          `Unknown operation type: ${operationType}. Supported operations: deploy, diff, remove, stage`
        );
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
    return ['deploy', 'diff', 'remove', 'stage'].includes(operationType);
  }

  /**
   * Get all supported operation types
   * @returns Array of supported operation types
   */
  static getSupportedOperations(): SSTOperation[] {
    return ['deploy', 'diff', 'remove', 'stage'];
  }
}
