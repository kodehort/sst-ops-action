/**
 * Stage Processor Implementation
 * Handles stage computation based on GitHub context without SST CLI execution
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { StageResult } from '../types/operations';

// Regex patterns for stage computation
const PATH_PREFIX_PATTERN = /.*\//;
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHENS_PATTERN = /^-+|-+$/g;
const STARTS_WITH_DIGIT_PATTERN = /^(\d)/;

/**
 * Options specific to stage processing
 */
export interface StageProcessingOptions {
  /** Maximum length for computed stage names */
  truncationLength?: number;
  /** Prefix to add when stage name starts with a number */
  prefix?: string;
}

/**
 * Processor for stage calculation operations
 * Computes the SST stage name from GitHub context (branch/PR)
 */
export class StageProcessor {
  /**
   * Process stage calculation from GitHub context and options
   * @param options Stage processing configuration
   * @returns Computed stage result
   */
  process(options: StageProcessingOptions): StageResult {
    const context = github.context;
    const truncationLength = options.truncationLength ?? 26;
    const prefix = options.prefix ?? 'pr-';

    try {
      return this.processSuccess(context, truncationLength, prefix);
    } catch (error) {
      return this.processError(context, error);
    }
  }

  /**
   * Handle successful stage processing
   */
  private processSuccess(
    context: typeof github.context,
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

    if (!computedStage) {
      throw new Error('Failed to generate a valid stage name from Git context');
    }

    const finalStage = computedStage;

    core.debug(`Generated stage: ${finalStage}`);
    this.logDebugInfo(context, finalStage);

    const rawOutput = `Stage computation successful\nEvent: ${context.eventName}\nRef: ${ref || 'undefined'}\nComputed Stage: ${finalStage}`;

    return {
      success: true,
      operation: 'stage',
      stage: finalStage,
      app: 'stage-calculator',
      rawOutput,
      exitCode: 0,
      truncated: false,
      completionStatus: 'complete',
      computedStage: finalStage,
      ref: ref || '',
      eventName: context.eventName,
      isPullRequest: context.eventName === 'pull_request',
    };
  }

  /**
   * Handle failed stage processing
   */
  private processError(
    context: typeof github.context,
    error: unknown
  ): StageResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const rawOutput = `Stage computation failed: ${errorMessage}`;

    return {
      success: false,
      operation: 'stage',
      stage: '',
      app: 'stage-calculator',
      rawOutput,
      exitCode: 1,
      truncated: false,
      error: errorMessage,
      completionStatus: 'failed',
      computedStage: '',
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
      return (
        context.payload.pull_request?.head?.ref || context.payload.head_ref
      );
    }

    return context.payload.head_ref || context.payload.ref || context.ref;
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
