/**
 * SST CLI execution utilities with proper error handling, output capture, and timeout management
 * Provides reliable SST CLI command execution for all operation types
 */

import { access, constants } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as exec from '@actions/exec';
import type { SSTOperation } from '../types/index.js';

const accessAsync = promisify(access);

/**
 * Result of executing a CLI command
 */
export interface CLIResult {
  /** Combined stdout and stderr output */
  output: string;
  /** Process exit code */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Full command that was executed */
  command: string;
  /** Error message if command failed */
  error?: string | undefined;
  /** Whether the output was truncated due to size limits */
  truncated: boolean;
  /** Raw stdout content */
  stdout: string;
  /** Raw stderr content */
  stderr: string;
}

/**
 * Supported package managers/runners for SST commands
 */
export const SST_RUNNERS = ['bun', 'npm', 'pnpm', 'yarn', 'sst'] as const;
export type SSTRunner = (typeof SST_RUNNERS)[number];

/**
 * Options for CLI command execution
 */
export interface CLIOptions {
  /** Timeout in milliseconds (default: 15 minutes) */
  timeout?: number | undefined;
  /** Maximum output size in bytes (default: 50KB) */
  maxOutputSize?: number | undefined;
  /** Arguments to pass to the SST command */
  args?: string[] | undefined;
  /** Package manager/runner to use for SST commands (default: 'bun') */
  runner?: SSTRunner | undefined;
}

/**
 * SST CLI command execution result
 */
export interface SSTCommandResult extends CLIResult {
  /** Whether the SST command succeeded */
  success: boolean;
  /** Stage that was operated on */
  stage: string;
  /** Operation that was performed */
  operation: SSTOperation;
}


/**
 * SST CLI executor with comprehensive error handling and timeout management
 */
export class SSTCLIExecutor {
  private readonly defaultTimeout = 15 * 60 * 1000; // 15 minutes
  private readonly defaultMaxOutputSize = 50 * 1024; // 50KB

  /**
   * Execute an SST command with proper error handling and output capture
   */
  async executeSST(
    operation: SSTOperation,
    stage: string,
    options: CLIOptions = {}
  ): Promise<SSTCommandResult> {
    const startTime = Date.now();
    const timeout = options.timeout || this.defaultTimeout;
    const maxOutputSize = options.maxOutputSize || this.defaultMaxOutputSize;

    // Build the command
    const command = this.buildCommand(operation, stage, options);

    try {
      // Execute the command
      const result = await this.executeCommand(command, {
        ...options,
        timeout,
        maxOutputSize,
      });

      const duration = Date.now() - startTime;
      const success = result.exitCode === 0;

      return {
        ...result,
        success,
        stage,
        operation,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        output: `Error executing SST command: ${errorMessage}`,
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        duration,
        command: command.join(' '),
        error: errorMessage,
        truncated: false,
        success: false,
        stage,
        operation,
      };
    }
  }

  /**
   * Build the SST command array based on operation and options
   */
  private buildCommand(
    operation: SSTOperation,
    stage: string,
    options: CLIOptions
  ): string[] {
    const runner = options.runner || 'bun';
    const command = this.buildRunnerCommand(runner, operation);

    // Add stage parameter
    command.push('--stage', stage);

    // Add operation-specific arguments
    switch (operation) {
      case 'deploy':
        // Deploy-specific options
        break;
      case 'diff':
        // Diff-specific options
        break;
      case 'remove':
        // Remove-specific options
        // Auto-confirm removal to avoid interactive prompts
        command.push('--yes');
        break;
      case 'stage':
        // Stage operation doesn't use SST CLI - handled separately
        break;
      default: {
        // Exhaustive check for TypeScript
        const _exhaustive: never = operation;
        throw new Error(`Unsupported operation: ${_exhaustive}`);
      }
    }

    // Add any additional arguments
    if (options.args) {
      command.push(...options.args);
    }

    return command;
  }

  /**
   * Build the command array with the specified runner
   */
  private buildRunnerCommand(
    runner: SSTRunner,
    operation: SSTOperation
  ): string[] {
    switch (runner) {
      case 'sst':
        // Direct SST binary execution
        return ['sst', operation];
      case 'bun':
        return ['bun', 'sst', operation];
      case 'npm':
        return ['npm', 'run', 'sst', '--', operation];
      case 'pnpm':
        return ['pnpm', 'sst', operation];
      case 'yarn':
        return ['yarn', 'sst', operation];
      default: {
        const _exhaustive: never = runner;
        throw new Error(`Unsupported runner: ${_exhaustive}`);
      }
    }
  }


  /**
   * Execute a command with timeout and output capture
   */
  private async executeCommand(
    command: string[],
    options: CLIOptions & { timeout: number; maxOutputSize: number }
  ): Promise<CLIResult> {
    const startTime = Date.now();

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let exitCode = 0;

    try {

      // Create a timeout promise if timeout is specified
      if (!command[0]) {
        throw new Error('Command array is empty');
      }
      const execPromise = exec.exec(command[0], command.slice(1), {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            const chunk = data.toString();
            if (stdout.length + chunk.length > options.maxOutputSize) {
              stdout += chunk.substring(
                0,
                options.maxOutputSize - stdout.length
              );
              truncated = true;
            } else {
              stdout += chunk;
            }
          },
          stderr: (data: Buffer) => {
            const chunk = data.toString();
            if (stderr.length + chunk.length > options.maxOutputSize) {
              stderr += chunk.substring(
                0,
                options.maxOutputSize - stderr.length
              );
              truncated = true;
            } else {
              stderr += chunk;
            }
          },
        },
      });

      if (options.timeout) {
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Command timeout after ${options.timeout}ms`));
          }, options.timeout);
        });

        try {
          exitCode = await Promise.race([execPromise, timeoutPromise]);
        } finally {
          // Always clear the timeout to prevent event loop hanging
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } else {
        exitCode = await execPromise;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's a timeout error
      if (errorMessage.includes('timeout')) {
        return {
          output: `${stdout}${stderr}\nCommand timed out after ${options.timeout}ms`,
          stdout,
          stderr: `${stderr}\nCommand timed out after ${options.timeout}ms`,
          exitCode: 124, // Timeout exit code
          duration,
          command: command.join(' '),
          error: `Command timed out after ${options.timeout}ms`,
          truncated,
        };
      }

      throw new Error(`Failed to execute command: ${errorMessage}`);
    }

    const duration = Date.now() - startTime;
    const output = stdout + stderr;

    return {
      output,
      stdout,
      stderr,
      exitCode,
      duration,
      command: command.join(' '),
      error:
        exitCode !== 0
          ? `Command failed with exit code ${exitCode}`
          : undefined,
      truncated,
    };
  }




}

/**
 * Create a new SST CLI executor instance
 */
export function createSSTExecutor(): SSTCLIExecutor {
  return new SSTCLIExecutor();
}

/**
 * Execute an SST command with default configuration
 */
export function executeSST(
  operation: SSTOperation,
  stage: string,
  options?: CLIOptions
): Promise<SSTCommandResult> {
  const executor = createSSTExecutor();
  return executor.executeSST(operation, stage, options);
}
