/**
 * Stage Parser Implementation
 * Handles stage computation based on GitHub context without SST CLI execution
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { StageResult } from '../types/operations';
import { BaseParser } from './base-parser';

// Regex patterns for stage computation
const PATH_PREFIX_PATTERN = /.*\//;
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHENS_PATTERN = /^-+|-+$/g;
const STARTS_WITH_DIGIT_PATTERN = /^(\d)/;

/**
 * Parser for stage calculation operations
 * Computes the SST stage name from GitHub context (branch/PR)
 */
export class StageParser extends BaseParser<StageResult> {
  /**
   * Parse stage calculation (this operation doesn't use SST CLI output)
   * @param _output Unused for stage operation
   * @param fallbackStage Fallback stage if computation fails
   * @param exitCode Should always be 0 for stage operation
   * @param maxOutputSize Maximum size for output truncation
   * @param truncationLength Maximum length for computed stage names
   * @param prefix Prefix to add when stage name starts with a number
   * @returns Parsed stage result
   */
  parse(
    _output: string,
    fallbackStage: string,
    exitCode: number,
    maxOutputSize?: number,
    truncationLength = 26,
    prefix = 'pr-'
  ): StageResult {
    const context = github.context;

    try {
      return this.parseSuccess(
        context,
        fallbackStage,
        exitCode,
        maxOutputSize,
        truncationLength,
        prefix
      );
    } catch (error) {
      return this.parseError(
        context,
        fallbackStage,
        error,
        maxOutputSize,
        truncationLength,
        prefix
      );
    }
  }

  /**
   * Handle successful stage parsing
   */
  private parseSuccess(
    context: typeof github.context,
    fallbackStage: string,
    exitCode: number,
    maxOutputSize?: number,
    truncationLength = 26,
    prefix = 'pr-'
  ): StageResult {
    const ref = this.extractRef(context);

    core.debug('Computing SST stage from ref...');
    core.debug(`Event name: ${context.eventName}`);
    core.debug(`Input ref: ${ref}`);

    // Process the ref into a stage name
    const computedStage = this.computeStageFromRef(
      ref || '',
      truncationLength,
      prefix
    );
    const finalStage = computedStage || fallbackStage;

    if (!finalStage) {
      throw new Error('Failed to generate a valid stage name from ref');
    }

    core.debug(`Generated stage: ${finalStage}`);
    this.logDebugInfo(context, finalStage);

    const { rawOutput, truncated } = this.formatOutput(
      `Stage computation successful\nEvent: ${context.eventName}\nRef: ${ref || 'undefined'}\nComputed Stage: ${finalStage}`,
      maxOutputSize
    );

    return {
      success: true,
      operation: 'stage',
      stage: finalStage,
      app: 'stage-calculator',
      rawOutput,
      exitCode,
      truncated,
      completionStatus: 'complete',
      computedStage: finalStage,
      ref: ref || '',
      eventName: context.eventName,
      isPullRequest: context.eventName === 'pull_request',
    };
  }

  /**
   * Handle failed stage parsing
   */
  private parseError(
    context: typeof github.context,
    fallbackStage: string,
    error: unknown,
    maxOutputSize?: number,
    _truncationLength = 26,
    _prefix = 'pr-'
  ): StageResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { rawOutput, truncated } = this.formatOutput(
      `Stage computation failed: ${errorMessage}`,
      maxOutputSize
    );

    return {
      success: false,
      operation: 'stage',
      stage: fallbackStage,
      app: 'stage-calculator',
      rawOutput,
      exitCode: 1,
      truncated,
      error: errorMessage,
      completionStatus: 'failed',
      computedStage: fallbackStage,
      ref: '',
      eventName: context.eventName,
      isPullRequest: context.eventName === 'pull_request',
    };
  }

  /**
   * Extract ref from GitHub context based on event type
   */
  private extractRef(context: typeof github.context): string | undefined {
    if (context.eventName === 'pull_request') {
      return context.payload.pull_request?.head?.ref;
    }

    return context.payload.head_ref || context.payload.ref || context.ref;
  }

  /**
   * Format and truncate output if necessary
   */
  private formatOutput(
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
   * Compute stage name from a Git ref
   * Turn the input into a slugable value and shorten to prevent
   * overflowing the limits for Route53 or other naming constraints
   */
  private computeStageFromRef(
    ref: string,
    truncationLength = 26,
    prefix = 'pr-'
  ): string {
    // Basic sanitization
    let stage = ref
      .replace(PATH_PREFIX_PATTERN, '') // Remove path prefix (refs/heads/, etc.)
      .toLowerCase() // Convert to lowercase
      .replace(NON_ALPHANUMERIC_PATTERN, '-') // Replace non-alphanumeric with single hyphen
      .replace(LEADING_TRAILING_HYPHENS_PATTERN, ''); // Remove leading and trailing hyphens

    // Handle prefix BEFORE truncation
    if (STARTS_WITH_DIGIT_PATTERN.test(stage)) {
      stage = prefix + stage;
    }

    // Apply truncation including the prefix
    if (stage.length > truncationLength) {
      stage = stage.substring(0, truncationLength);
      // Clean up any trailing hyphens that might result from truncation
      stage = stage.replace(LEADING_TRAILING_HYPHENS_PATTERN, '');
    }

    return stage;
  }

  /**
   * Log debug information for immediate visibility
   */
  private logDebugInfo(
    context: typeof github.context,
    finalStage: string
  ): void {
    core.debug(`ref: ${context.ref || 'undefined'}`);
    core.debug(`head_ref: ${context.payload.head_ref || 'undefined'}`);
    core.debug(`event.ref: ${context.payload.ref || 'undefined'}`);
    core.debug(`base_ref: ${context.payload.base_ref || 'undefined'}`);
    if (context.eventName === 'pull_request') {
      core.debug(
        `PR head ref: ${context.payload.pull_request?.head?.ref || 'undefined'}`
      );
      core.debug(
        `PR base ref: ${context.payload.pull_request?.base?.ref || 'undefined'}`
      );
    }
    core.debug(`STAGE: ${finalStage}`);
  }
}
