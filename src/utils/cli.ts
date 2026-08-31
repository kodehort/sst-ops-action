/**
 * SST CLI execution utilities with proper error handling, output capture, and timeout management
 * Provides reliable SST CLI command execution for all operation types
 */

import * as exec from "@actions/exec";
import { DEFAULT_MAX_OUTPUT_SIZE, type SSTOperation } from "../types/index.js";

/**
 * Result of executing a CLI command
 */
export interface CLIResult {
  /** Full command that was executed */
  command: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if command failed */
  error?: string | undefined;
  /** Process exit code */
  exitCode: number;
  /** stdout and stderr merged in arrival order — what every parser reads */
  output: string;
  /** The stderr half of `output`, for diagnostics */
  stderr: string;
  /** The stdout half of `output`, for diagnostics */
  stdout: string;
  /** Whether the output was truncated due to size limits */
  truncated: boolean;
}

/**
 * Supported package managers/runners for SST commands
 */
export const SST_RUNNERS = ["bun", "npm", "pnpm", "yarn", "sst"] as const;
export type SSTRunner = (typeof SST_RUNNERS)[number];

/**
 * Options for CLI command execution
 */
export interface CLIOptions {
  /** Arguments to pass to the SST command */
  args?: string[] | undefined;
  /** Maximum output size in bytes (default: 50KB) */
  maxOutputSize?: number | undefined;
  /** Package manager/runner to use for SST commands (default: 'bun') */
  runner?: SSTRunner | undefined;
  /** Timeout in milliseconds (default: 15 minutes) */
  timeout?: number | undefined;
}

/**
 * SST CLI command execution result
 */
export interface SSTCommandResult extends CLIResult {
  /** Operation that was performed */
  operation: SSTOperation;
  /** Stage that was operated on */
  stage: string;
  /** Whether the SST command succeeded */
  success: boolean;
}

/**
 * How long each SST command is given before it is killed.
 *
 * These lived on the operation classes, so every caller had to pass one and
 * the seam's own default was unreachable. A timeout is a property of the
 * command, not of whoever is calling it.
 */
const COMMAND_TIMEOUTS: Record<"deploy" | "diff" | "remove", number> = {
  deploy: 900_000, // 15 minutes
  diff: 300_000, // 5 minutes
  remove: 900_000, // 15 minutes
};

/**
 * `sst state list` runs no infrastructure work, but it does initialise every
 * provider in the app config before reading the state backend, which takes
 * tens of seconds on a cold runner.
 */
const STATE_LIST_TIMEOUT = 120_000; // 2 minutes

/**
 * SST CLI executor with comprehensive error handling and timeout management
 */
export class SSTCLIExecutor {
  private readonly defaultTimeout = 15 * 60 * 1000; // 15 minutes
  private readonly defaultMaxOutputSize = DEFAULT_MAX_OUTPUT_SIZE;

  /**
   * Execute an SST command with proper error handling and output capture
   */
  async executeSST(
    operation: SSTOperation,
    stage: string,
    options: CLIOptions = {}
  ): Promise<SSTCommandResult> {
    const startTime = Date.now();
    // The stage operation never reaches here — it runs no command — so the
    // map covers exactly the three that do.
    const timeout =
      options.timeout ||
      COMMAND_TIMEOUTS[operation as "deploy" | "diff" | "remove"] ||
      this.defaultTimeout;
    // `??`, not `||`. Absent and zero are different answers: absent takes the
    // default, zero means no cap. `||` conflated them, so `max-output-size: 0`
    // — documented as unlimited — produced the tightest realistic budget.
    const maxOutputSize = options.maxOutputSize ?? this.defaultMaxOutputSize;

    // Build the command
    const command = this.buildCommand(operation, stage, options);

    try {
      // Execute the command
      const result = await this.executeCommand(command, {
        ...options,
        maxOutputSize,
        timeout,
      });

      const duration = Date.now() - startTime;
      const success = result.exitCode === 0;

      return {
        ...result,
        duration,
        operation,
        stage,
        success,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        command: command.join(" "),
        duration,
        error: errorMessage,
        exitCode: 1,
        operation,
        output: `Error executing SST command: ${errorMessage}`,
        stage,
        stderr: errorMessage,
        stdout: "",
        success: false,
        truncated: false,
      };
    }
  }

  /**
   * List the stages deployed in the app's state backend.
   *
   * Backend-agnostic on purpose: `sst state list` answers from whichever home
   * the app config declares (AWS, Cloudflare, …), so callers need no knowledge
   * of where state lives. Returns the raw CLI result; parsing is the caller's
   * concern.
   *
   * @throws {Error} When the command cannot be executed at all — callers that
   *   use this as a preflight check should treat a throw as "unknown", not as
   *   "no stages".
   */
  async listStages(options: CLIOptions = {}): Promise<CLIResult> {
    const runner = options.runner || "bun";
    const command = [...this.buildRunnerCommand(runner, "state"), "list"];

    return await this.executeCommand(command, {
      ...options,
      maxOutputSize: options.maxOutputSize ?? this.defaultMaxOutputSize,
      timeout: options.timeout ?? STATE_LIST_TIMEOUT,
    });
  }

  /**
   * Build the SST command array based on operation and options
   */
  private buildCommand(
    operation: SSTOperation,
    stage: string,
    options: CLIOptions
  ): string[] {
    const runner = options.runner || "bun";
    const command = this.buildRunnerCommand(runner, operation);

    // Add stage parameter
    command.push("--stage", stage);

    // Add operation-specific arguments
    switch (operation) {
      case "deploy":
        // Deploy-specific options
        break;
      case "diff":
        // Diff-specific options
        break;
      case "remove":
        // Remove-specific options
        // Auto-confirm removal to avoid interactive prompts
        command.push("--yes");
        break;
      case "stage":
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
    operation: SSTOperation | "state"
  ): string[] {
    switch (runner) {
      case "sst":
        // Direct SST binary execution
        return ["sst", operation];
      case "bun":
        return ["bun", "sst", operation];
      case "npm":
        return ["npm", "run", "sst", "--", operation];
      case "pnpm":
        return ["pnpm", "sst", operation];
      case "yarn":
        return ["yarn", "sst", operation];
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

    // One buffer, appended by both listeners in arrival order, so the value
    // every parser reads is what the process actually wrote. The per-stream
    // copies are kept for diagnostics and hold exactly what `output` holds,
    // split by origin — they are not a second, larger capture.
    let output = "";
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let exitCode = 0;

    // 0 means no cap, which is a documented value rather than a sentinel the
    // arithmetic below should ever see: `remaining` would be negative on the
    // first chunk and every byte would be dropped as "over budget".
    const unlimited = options.maxOutputSize === 0;

    const append = (data: Buffer, stream: "stderr" | "stdout"): void => {
      const chunk = data.toString();
      const kept = unlimited
        ? chunk
        : capped(chunk, options.maxOutputSize - output.length);

      if (kept === null) {
        truncated = true;
        return;
      }

      if (kept.length < chunk.length) {
        truncated = true;
      }

      output += kept;
      if (stream === "stdout") {
        stdout += kept;
      } else {
        stderr += kept;
      }
    };

    try {
      if (!command[0]) {
        throw new Error("Command array is empty");
      }
      const execPromise = exec.exec(command[0], command.slice(1), {
        ignoreReturnCode: true,
        listeners: {
          stderr: (data: Buffer) => append(data, "stderr"),
          stdout: (data: Buffer) => append(data, "stdout"),
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
      if (errorMessage.includes("timeout")) {
        return {
          command: command.join(" "),
          duration,
          error: `Command timed out after ${options.timeout}ms`,
          exitCode: 124, // Timeout exit code
          output: `${output}\nCommand timed out after ${options.timeout}ms`,
          stderr: `${stderr}\nCommand timed out after ${options.timeout}ms`,
          stdout,
          truncated,
        };
      }

      throw new Error(`Failed to execute command: ${errorMessage}`, {
        cause: error,
      });
    }

    const duration = Date.now() - startTime;

    return {
      command: command.join(" "),
      duration,
      error:
        exitCode === 0
          ? undefined
          : `Command failed with exit code ${exitCode}`,
      exitCode,
      output,
      stderr,
      stdout,
      truncated,
    };
  }
}

/**
 * Trim a chunk to the remaining budget.
 *
 * @returns The part that fits, or null when the budget is already spent
 */
function capped(chunk: string, remaining: number): string | null {
  if (remaining <= 0) {
    return null;
  }

  return chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
}
