/**
 * Deploy Operation Parser
 * Parses SST deploy command output to extract resource changes and generic outputs
 */

import * as core from '@actions/core';
import type { DeployResult } from '../types/operations';
import { OperationParser } from './operation-parser';

// Real SST v3 output patterns based on actual deploy examples
const RESOURCE_CREATED_PATTERN =
  /^\|\s+Created\s+(.+?)\s+(.+?)(?:\s+\(([\d.]+s)\))?$/;
const RESOURCE_UPDATED_PATTERN =
  /^\|\s+Updated\s+(.+?)\s+(.+?)(?:\s+\(([\d.]+s)\))?$/;
const RESOURCE_DELETED_PATTERN =
  /^\|\s+Deleted\s+(.+?)\s+(.+?)(?:\s+\(([\d.]+s)\))?$/;

// Error and completion patterns for real SST output
const COMPLETION_SUCCESS_PATTERN = /^✓\s+Complete\s*$/m;
const COMPLETION_FAILED_PATTERN = /^✕\s+Failed\s*$/m;
const ERROR_SECTION_START_PATTERN = /^Error:/m;
const GRPC_ERROR_PATTERN = /grpc: the client/;
const RESOURCE_NOT_EXIST_PATTERN = /resource '([^']+)' does not exist/;
const PIPE_PREFIX_PATTERN = /^\|\s*/;

export class DeployParser extends OperationParser<DeployResult> {
  /**
   * Parse SST deploy output into structured result
   */
  parse(
    output: string,
    stage: string,
    exitCode: number,
    maxSize?: number
  ): DeployResult {
    // Handle output truncation if size limit specified
    const truncated = maxSize ? output.length > maxSize : false;
    const processedOutput =
      maxSize && output.length > maxSize
        ? output.substring(0, maxSize)
        : output;

    // Parse common information using base parser
    const lines = processedOutput.split('\n');
    const commonInfo = this.parseCommonInfo(lines);

    // Parse deploy-specific information
    const resources = this.parseResourceChanges(processedOutput);
    const outputs = this.parseOutputs(processedOutput);
    const error = this.parseErrorMessage(processedOutput);

    // Determine success based on exit code (primary) and patterns (secondary)
    const success = this.isSuccessfulOperation(processedOutput, exitCode);

    const result: DeployResult = {
      success,
      operation: 'deploy',
      stage,
      app: commonInfo.app || '',
      rawOutput: processedOutput,
      exitCode,
      truncated,
      ...(error && { error }),
      completionStatus:
        commonInfo.completionStatus || (success ? 'complete' : 'failed'),
      ...(commonInfo.permalink && { permalink: commonInfo.permalink }),
      resourceChanges: resources.length,
      resources,
      outputs,
    };

    return result;
  }

  /**
   * Parse resource changes from deployment output
   */
  private parseResourceChanges(output: string): Array<{
    type: string;
    name: string;
    status: 'created' | 'updated' | 'deleted';
    timing?: string;
  }> {
    const lines = output.split('\n');
    const resources: Array<{
      type: string;
      name: string;
      status: 'created' | 'updated' | 'deleted';
      timing?: string;
    }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      const resource = this.parseResourceChangeFromLine(trimmedLine);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Parse a single resource change from a deploy line
   * Real SST format: | Created/Updated/Deleted ResourceName ResourceType (timing)
   */
  private parseResourceChangeFromLine(line: string): {
    type: string;
    name: string;
    status: 'created' | 'updated' | 'deleted';
    timing?: string;
  } | null {
    const patterns = [
      { regex: RESOURCE_CREATED_PATTERN, status: 'created' as const },
      { regex: RESOURCE_UPDATED_PATTERN, status: 'updated' as const },
      { regex: RESOURCE_DELETED_PATTERN, status: 'deleted' as const },
    ];

    for (const { regex, status } of patterns) {
      const match = line.match(regex);
      if (match?.[1] && match[2]) {
        const result = {
          name: match[1].trim(),
          type: match[2].trim(),
          status,
        };

        // Add timing if available
        if (match[3]) {
          return { ...result, timing: match[3] };
        }

        return result;
      }
    }

    return null;
  }

  /**
   * Parse outputs from deployment output
   * SST outputs appear in final output section after completion as key: value pairs
   */
  private parseOutputs(output: string): Array<{
    key: string;
    value: string;
  }> {
    const lines = output.split('\n');
    const outputs: Array<{
      key: string;
      value: string;
    }> = [];

    // Look for outputs after completion marker
    let inOutputSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check if we're in the completion/output section
      if (COMPLETION_SUCCESS_PATTERN.test(trimmedLine)) {
        inOutputSection = true;
        continue;
      }

      if (inOutputSection) {
        this.processOutputLine(trimmedLine, outputs);
      }
    }

    return outputs;
  }

  /**
   * Process a single output line and add to outputs array if valid
   * Also handles debug logging for invalid lines that might be outputs
   */
  private processOutputLine(
    trimmedLine: string,
    outputs: Array<{ key: string; value: string }>
  ): void {
    const outputPair = this.parseOutputFromLine(trimmedLine);
    if (outputPair) {
      outputs.push(outputPair);
    } else if (trimmedLine?.includes(':')) {
      // Log potentially valid output lines that failed parsing for debugging
      // Cache truncated line to avoid repeated substring operations
      const logLine =
        trimmedLine.length > 100
          ? `${trimmedLine.substring(0, 100)}...`
          : trimmedLine;
      core.debug(
        `Skipped potential output line: "${logLine}" (parsing failed)`
      );
    }
  }

  /**
   * Parse a single output from a deploy line
   *
   * Extracts key-value pairs from SST deployment output lines. The method expects
   * lines in the format "key: value" and handles various edge cases and formatting.
   *
   * **Supported Formats:**
   * - Standard: `ApiUrl: https://api.example.com`
   * - With spaces: `Web URL : https://web.example.com`
   * - Mixed case: `webUrl: https://web.example.com`
   * - Numeric values: `Port: 3000`
   * - Boolean values: `Enabled: true`
   *
   * **Ignored Formats:**
   * - Separator lines: `--- Deployment Complete ---`
   * - Empty lines or whitespace-only lines
   * - Lines without colons: `Invalid format line`
   * - Lines with colon at start/end: `: value` or `key:`
   * - Lines with empty keys or values after trimming
   *
   * **Error Conditions:**
   * - Returns `null` for any line that doesn't match expected format
   * - Handles malformed input gracefully without throwing
   * - Ignores lines that contain '---' (deployment separators)
   *
   * @param line Raw output line from SST deployment
   * @returns Parsed key-value pair or null if line doesn't match expected format
   *
   * @example
   * ```typescript
   * parseOutputFromLine("ApiUrl: https://api.example.com")
   * // Returns: { key: "ApiUrl", value: "https://api.example.com" }
   *
   * parseOutputFromLine("--- Deployment Complete ---")
   * // Returns: null (separator line ignored)
   *
   * parseOutputFromLine("InvalidLine")
   * // Returns: null (no colon found)
   * ```
   */
  private parseOutputFromLine(line: string): {
    key: string;
    value: string;
  } | null {
    // Ignore separator lines
    if (line.includes('---')) {
      return null;
    }

    // Parse key: value format
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0 && colonIndex < line.length - 1) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (key && value) {
        return { key, value };
      }
    }

    return null;
  }

  /**
   * Parse error messages from failed deployments
   * Real SST errors include stack traces and specific failure reasons
   */
  private parseErrorMessage(output: string): string | undefined {
    // Check for completion failure marker
    if (COMPLETION_FAILED_PATTERN.test(output)) {
      return this.extractDetailedError(output);
    }

    // Check for specific error patterns
    const specificError = this.parseSpecificErrors(output);
    if (specificError) {
      return specificError;
    }

    // Look for generic Error: sections
    return this.parseGenericErrorSections(output);
  }

  /**
   * Parse specific known error patterns
   */
  private parseSpecificErrors(output: string): string | undefined {
    // Check for resource existence errors
    const resourceError = output.match(RESOURCE_NOT_EXIST_PATTERN);
    if (resourceError?.[1]) {
      return `Resource '${resourceError[1]}' does not exist`;
    }

    // Check for gRPC errors
    if (GRPC_ERROR_PATTERN.test(output)) {
      return 'gRPC client error occurred during deployment';
    }

    return;
  }

  /**
   * Parse generic Error: sections from output
   */
  private parseGenericErrorSections(output: string): string | undefined {
    const lines = output.split('\n');
    let errorSection = false;
    const errorLines: string[] = [];

    for (const line of lines) {
      if (ERROR_SECTION_START_PATTERN.test(line)) {
        errorSection = true;
        errorLines.push(line.trim());
        continue;
      }

      if (errorSection) {
        if (line.trim() === '' && errorLines.length > 0) {
          break; // End of error section
        }
        if (line.trim()) {
          errorLines.push(line.trim());
        }
      }
    }

    return errorLines.length > 0 ? errorLines.join(' ') : undefined;
  }

  /**
   * Extract detailed error information from failed output
   */
  private extractDetailedError(output: string): string {
    const lines = output.split('\n');
    const errorMessages: string[] = [];

    // Look for resource errors and main error messages
    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.includes('Error')) {
        errorMessages.push(trimmed.replace(PIPE_PREFIX_PATTERN, ''));
      } else if (trimmed.startsWith('Error:')) {
        errorMessages.push(trimmed);
      }
    }

    return errorMessages.length > 0
      ? errorMessages.join('; ')
      : 'Deployment failed';
  }
}
