import type { BaseOperationResult } from '../types/operations';

/**
 * Options for input-based processing operations
 */
export interface ProcessingOptions {
  /** Maximum size for output truncation */
  maxOutputSize?: number;
  /** Additional processing parameters */
  [key: string]: unknown;
}

/**
 * Abstract base class for input-based operations that compute results from inputs and context
 * rather than parsing CLI output. Used for operations like stage calculation that derive
 * values from GitHub context, environment variables, or configuration.
 */
export abstract class InputProcessor<T extends BaseOperationResult> {
  /**
   * Abstract method that must be implemented by subclasses
   * @param options Processing configuration options
   * @returns Computed operation result
   */
  abstract process(options: ProcessingOptions): T;

  /**
   * Format and truncate output if necessary
   * @param rawOutput Raw output content
   * @param maxOutputSize Maximum allowed size
   * @returns Formatted output with truncation info
   */
  protected formatOutput(
    rawOutput: string,
    maxOutputSize?: number
  ): { rawOutput: string; truncated: boolean } {
    const truncated = maxOutputSize ? rawOutput.length > maxOutputSize : false;
    const finalOutput =
      truncated && maxOutputSize
        ? rawOutput.substring(0, maxOutputSize)
        : rawOutput;

    return { rawOutput: finalOutput, truncated };
  }

  /**
   * Create a success result with common fields
   * @param operation The operation type
   * @param stage The stage name
   * @param app The app name
   * @param rawOutput Raw output content
   * @param exitCode Exit code (typically 0 for success)
   * @param truncated Whether output was truncated
   * @returns Partial result with common success fields
   */
  protected createSuccessBase(
    operation: string,
    stage: string,
    app: string,
    rawOutput: string,
    exitCode = 0,
    truncated = false
  ): Partial<BaseOperationResult> {
    return {
      success: true,
      operation: operation as BaseOperationResult['operation'],
      stage,
      app,
      rawOutput,
      exitCode,
      truncated,
      completionStatus: 'complete',
    };
  }

  /**
   * Create a failure result with common fields
   * @param operation The operation type
   * @param stage The stage name
   * @param app The app name (default: 'unknown')
   * @param error Error message
   * @param rawOutput Raw output content (default: empty)
   * @param exitCode Exit code (typically 1 for failure)
   * @param truncated Whether output was truncated
   * @returns Partial result with common failure fields
   */
  protected createFailureBase(
    operation: string,
    stage: string,
    error: string,
    app = 'unknown',
    rawOutput = '',
    exitCode = 1,
    truncated = false
  ): Partial<BaseOperationResult> {
    return {
      success: false,
      operation: operation as BaseOperationResult['operation'],
      stage,
      app,
      rawOutput,
      exitCode,
      truncated,
      error,
      completionStatus: 'failed',
    };
  }

  /**
   * Validate required processing options
   * @param options Processing options to validate
   * @param requiredFields Array of required field names
   * @throws Error if any required fields are missing
   */
  protected validateOptions(
    options: ProcessingOptions,
    requiredFields: string[]
  ): void {
    for (const field of requiredFields) {
      if (!(field in options) || options[field] === undefined) {
        throw new Error(`Missing required processing option: ${field}`);
      }
    }
  }

  /**
   * Safely extract a string value from options
   * @param options Processing options
   * @param key Option key to extract
   * @param defaultValue Default value if not found
   * @returns Extracted string value
   */
  protected getStringOption(
    options: ProcessingOptions,
    key: string,
    defaultValue = ''
  ): string {
    const value = options[key];
    return typeof value === 'string' ? value : defaultValue;
  }

  /**
   * Safely extract a number value from options
   * @param options Processing options
   * @param key Option key to extract
   * @param defaultValue Default value if not found
   * @returns Extracted number value
   */
  protected getNumberOption(
    options: ProcessingOptions,
    key: string,
    defaultValue = 0
  ): number {
    const value = options[key];
    return typeof value === 'number' ? value : defaultValue;
  }
}
