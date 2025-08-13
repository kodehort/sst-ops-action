/**
 * Deploy Operation Parser
 * Parses SST deploy command output to extract resource changes and URLs
 */

import type { DeployResult } from '../types/operations';
import { OperationParser } from './operation-parser';

// Top-level regex patterns for better performance
const RESOURCE_CREATED_PATTERN =
  /^\|\s+Created\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;
const RESOURCE_UPDATED_PATTERN =
  /^\|\s+Updated\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;
const RESOURCE_UNCHANGED_PATTERN =
  /^\|\s+Unchanged\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;
const RESOURCE_FAILED_PATTERN =
  /^\|\s+Failed\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/;

const URL_ROUTER_PATTERN = /^\s*Router:\s+(https?:\/\/.+)$/;
const URL_API_PATTERN = /^\s*Api:\s+(https?:\/\/.+)$/;
const URL_WEB_PATTERN = /^\s*Web:\s+(https?:\/\/.+)$/;
const URL_WEBSITE_PATTERN = /^\s*Website:\s+(https?:\/\/.+)$/;
const URL_FUNCTION_PATTERN = /^\s*Function:\s+(https?:\/\/.+)$/;

const ERROR_MESSAGE_PATTERN = /^Error:\s*(.+)$/m;
const DEPLOYMENT_FAILED_PATTERN = /Deployment failed/;

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
    const urls = this.parseDeployedURLs(processedOutput);
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
      urls,
    };

    return result;
  }

  /**
   * Parse resource changes from deployment output
   */
  private parseResourceChanges(output: string): Array<{
    type: string;
    name: string;
    status: 'created' | 'updated' | 'unchanged';
  }> {
    const lines = output.split('\n');
    const resources: Array<{
      type: string;
      name: string;
      status: 'created' | 'updated' | 'unchanged';
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
   */
  private parseResourceChangeFromLine(line: string): {
    type: string;
    name: string;
    status: 'created' | 'updated' | 'unchanged';
  } | null {
    const patterns = [
      { regex: RESOURCE_CREATED_PATTERN, status: 'created' as const },
      { regex: RESOURCE_UPDATED_PATTERN, status: 'updated' as const },
      { regex: RESOURCE_UNCHANGED_PATTERN, status: 'unchanged' as const },
      { regex: RESOURCE_FAILED_PATTERN, status: 'unchanged' as const }, // Map failed to unchanged
    ];

    for (const { regex, status } of patterns) {
      const match = line.match(regex);
      if (match?.[1] && match[2]) {
        return {
          type: match[1].trim(),
          name: match[2].trim(),
          status,
        };
      }
    }

    return null;
  }

  /**
   * Parse deployed URLs from deployment output
   */
  private parseDeployedURLs(output: string): Array<{
    name: string;
    url: string;
    type: 'api' | 'web' | 'function' | 'other';
  }> {
    const lines = output.split('\n');
    const urls: Array<{
      name: string;
      url: string;
      type: 'api' | 'web' | 'function' | 'other';
    }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      const url = this.parseUrlFromLine(trimmedLine);
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  }

  /**
   * Parse a single URL from a deploy line
   */
  private parseUrlFromLine(line: string): {
    name: string;
    url: string;
    type: 'api' | 'web' | 'function' | 'other';
  } | null {
    const patterns = [
      { regex: URL_ROUTER_PATTERN, name: 'Router', type: 'api' as const },
      { regex: URL_API_PATTERN, name: 'Api', type: 'api' as const },
      { regex: URL_WEB_PATTERN, name: 'Web', type: 'web' as const },
      { regex: URL_WEBSITE_PATTERN, name: 'Website', type: 'web' as const },
      {
        regex: URL_FUNCTION_PATTERN,
        name: 'Function',
        type: 'function' as const,
      },
    ];

    for (const { regex, name, type } of patterns) {
      const match = line.match(regex);
      if (match?.[1]) {
        return {
          name,
          url: match[1].trim(),
          type,
        };
      }
    }

    return null;
  }

  /**
   * Parse error messages from failed deployments
   */
  private parseErrorMessage(output: string): string | undefined {
    const errorMatch = output.match(ERROR_MESSAGE_PATTERN);
    if (errorMatch?.[1]) {
      return errorMatch[1].trim();
    }

    // Look for deployment failure pattern
    if (DEPLOYMENT_FAILED_PATTERN.test(output)) {
      return 'Deployment failed';
    }

    return;
  }
}
