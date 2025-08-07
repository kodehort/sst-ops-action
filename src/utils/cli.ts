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
export type SSTRunner = 'bun' | 'npm' | 'pnpm' | 'yarn' | 'sst';

/**
 * Options for CLI command execution
 */
export interface CLIOptions {
  /** Environment variables to pass to the command */
  env?: Record<string, string> | undefined;
  /** Working directory for the command */
  cwd?: string | undefined;
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
 * Environment configuration for SST CLI
 */
export interface SSTEnvironment {
  /** AWS region */
  AWS_REGION?: string;
  /** AWS profile */
  AWS_PROFILE?: string;
  /** AWS access key ID */
  AWS_ACCESS_KEY_ID?: string;
  /** AWS secret access key */
  AWS_SECRET_ACCESS_KEY?: string;
  /** AWS session token */
  AWS_SESSION_TOKEN?: string;
  /** SST configuration */
  SST_CONFIG?: string;
  /** Node environment */
  NODE_ENV?: string;
  /** Additional environment variables */
  [key: string]: string | undefined;
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
    const command = await this.buildCommand(operation, stage, options);

    try {
      // Validate environment and prerequisites
      await this.validateEnvironment(options.cwd);

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
  private async buildCommand(
    operation: SSTOperation,
    stage: string,
    options: CLIOptions
  ): Promise<string[]> {
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
  private buildRunnerCommand(runner: SSTRunner, operation: SSTOperation): string[] {
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
      default:
        throw new Error(`Unsupported runner: ${runner}. Supported runners: bun, npm, pnpm, yarn, sst`);
    }
  }

  /**
   * Build a command array for utility operations like --version
   */
  private buildUtilityCommand(runner: SSTRunner, args: string[]): string[] {
    switch (runner) {
      case 'sst':
        // Direct SST binary execution
        return ['sst', ...args];
      case 'bun':
        return ['bun', 'sst', ...args];
      case 'npm':
        return ['npm', 'run', 'sst', '--', ...args];
      case 'pnpm':
        return ['pnpm', 'sst', ...args];
      case 'yarn':
        return ['yarn', 'sst', ...args];
      default:
        throw new Error(`Unsupported runner: ${runner}. Supported runners: bun, npm, pnpm, yarn, sst`);
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
      const env = this.buildEnvironment(options.env);
      const cwd = options.cwd || process.cwd();

      // Create a timeout promise if timeout is specified
      const execPromise = exec.exec(command[0]!, command.slice(1), {
        cwd,
        env,
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
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Command timeout after ${options.timeout}ms`));
          }, options.timeout);
        });

        exitCode = await Promise.race([execPromise, timeoutPromise]);
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

  /**
   * Build environment variables for SST CLI execution
   */
  private buildEnvironment(
    customEnv?: Record<string, string>
  ): Record<string, string> {
    const env: Record<string, string> = {
      ...process.env,
      // Ensure Node.js can find modules
      NODE_PATH: process.env.NODE_PATH || '',
      // Set production environment for SST
      NODE_ENV: process.env.NODE_ENV || 'production',
      // Disable SST telemetry in CI environments
      SST_TELEMETRY_DISABLED: '1',
      // Ensure non-interactive mode
      CI: '1',
    };

    // Add custom environment variables
    if (customEnv) {
      for (const [key, value] of Object.entries(customEnv)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
    }

    // Filter out undefined values
    const filteredEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined && value !== null) {
        filteredEnv[key] = String(value);
      }
    }

    return filteredEnv;
  }

  /**
   * Validate the environment before executing SST commands
   */
  private async validateEnvironment(cwd?: string): Promise<void> {
    const workingDir = cwd || process.cwd();

    // Check if sst.config.ts exists
    const configPaths = ['sst.config.ts', 'sst.config.js', 'sst.config.mjs'];

    let configFound = false;
    for (const configPath of configPaths) {
      try {
        await accessAsync(join(workingDir, configPath), constants.F_OK);
        configFound = true;
        break;
      } catch {
        // Config file not found, try next one
      }
    }

    if (!configFound) {
      throw new Error(
        'SST configuration file not found. Expected one of: ' +
          configPaths.join(', ') +
          ` in ${workingDir}`
      );
    }
  }

  /**
   * Check if SST CLI is available in the environment
   */
  async checkSSTAvailability(runner: SSTRunner = 'bun'): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const versionCommand = this.buildUtilityCommand(runner, ['--version']);
      const result = await this.executeCommand(versionCommand, {
        timeout: 30_000, // 30 seconds
        maxOutputSize: 1024, // 1KB
      });

      if (result.exitCode === 0) {
        const version = result.stdout.trim();
        return { available: true, version };
      }

      return {
        available: false,
        error: `SST CLI check failed with exit code ${result.exitCode}: ${result.stderr}`,
      };
    } catch (error) {
      return {
        available: false,
        error: `SST CLI not available: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get SST project information
   */
  async getProjectInfo(
    cwd?: string,
    runner: SSTRunner = 'bun'
  ): Promise<{ app?: string; stage?: string; error?: string }> {
    try {
      const envCommand = this.buildUtilityCommand(runner, ['env']);
      const result = await this.executeCommand(envCommand, {
        cwd,
        timeout: 30_000, // 30 seconds
        maxOutputSize: 4096, // 4KB
      });

      if (result.exitCode === 0) {
        // Parse environment output to extract app and stage info
        const lines = result.stdout.split('\n');
        const info: { app?: string; stage?: string } = {};

        for (const line of lines) {
          if (line.includes('App:')) {
            const appValue = line.split(':')[1]?.trim();
            if (appValue) {
              info.app = appValue;
            }
          }
          if (line.includes('Stage:')) {
            const stageValue = line.split(':')[1]?.trim();
            if (stageValue) {
              info.stage = stageValue;
            }
          }
        }

        return info;
      }

      return {
        error: `Failed to get project info: ${result.stderr || 'Unknown error'}`,
      };
    } catch (error) {
      return {
        error: `Failed to get project info: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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
export async function executeSST(
  operation: SSTOperation,
  stage: string,
  options?: CLIOptions
): Promise<SSTCommandResult> {
  const executor = createSSTExecutor();
  return executor.executeSST(operation, stage, options);
}
