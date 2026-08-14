import type {
  BaseOperationResult,
  CompletionStatus,
  SSTOperation,
} from "../types/operations";
import { PatternHelpers, SSTPatterns } from "./patterns";

/**
 * What every parser reads out of a capture before it looks for anything
 * operation-specific: the cleaned text, and the fields common to all results.
 */
interface CommonParse {
  commonInfo: Partial<BaseOperationResult>;
  output: string;
}

/**
 * The fields every operation result carries, in the one place that builds them.
 */
interface BaseResultInput {
  commonInfo: Partial<BaseOperationResult>;
  completionStatus: CompletionStatus;
  error?: string | undefined;
  exitCode: number;
  operation: SSTOperation;
  output: string;
  stage: string;
  success: boolean;
  truncated: boolean;
}

/**
 * Abstract base parser for SST CLI outputs
 *
 * Holds what is genuinely shared: reading the common header fields, and
 * assembling the nine fields every result carries. Everything else belongs to
 * the parser that uses it.
 *
 * It previously offered eleven protected helpers, seven of which no parser
 * called — kept alive by a test subclass whose stated purpose was to re-expose
 * them. That is why the dead-code analysis saw nothing: pure functions
 * extracted for testability, with the real behaviour left unexercised.
 *
 * Reads patterns straight from patterns.ts. It used to re-expose them under a
 * second set of names, which meant one pattern could be referred to three
 * ways — by its library name, by the alias, and by whatever private copy a
 * concrete parser had made.
 */
export abstract class OperationParser<T extends BaseOperationResult> {
  /**
   * Patterns that mean the operation failed despite a zero exit code.
   *
   * Each parser states its own rule. The three used to be a base
   * implementation plus two overrides that differed only in this list, so the
   * shared half was copied twice while deploy silently inherited a third rule.
   */
  protected abstract readonly failurePatterns: RegExp[];

  /**
   * Parse a capture into a structured result.
   *
   * @param truncated Whether the CLI capture hit its size budget. Truncation
   *   is a fact about the capture, not about the text, so the parser is told
   *   rather than trying to infer it.
   */
  abstract parse(
    output: string,
    stage: string,
    exitCode: number,
    truncated: boolean
  ): T;

  /**
   * Clean the capture and read the fields common to every operation.
   *
   * One entry point, so the cleaning cannot be skipped by one parser and
   * applied by the others. Deploy used to parse the raw capture while diff and
   * remove parsed a cleaned one, which meant the same header line could be
   * read differently depending on which command produced it.
   */
  protected parseCommon(rawOutput: string): CommonParse {
    const output = this.cleanText(rawOutput || "");

    return { commonInfo: this.parseCommonInfo(output.split("\n")), output };
  }

  /**
   * Build the fields every result carries, with one set of defaults.
   *
   * The three parsers each assembled these by hand and disagreed: a missing
   * permalink was an absent key in one and `""` in the other two.
   */
  protected buildBaseResult({
    commonInfo,
    completionStatus,
    error,
    exitCode,
    operation,
    output,
    stage,
    success,
    truncated,
  }: BaseResultInput): BaseOperationResult {
    return {
      // An unknown app name is empty, never invented. See app-fallback.test.ts.
      app: commonInfo.app || "",
      completionStatus,
      exitCode,
      operation,
      rawOutput: output,
      stage,
      success,
      truncated,
      // Both are optional on the result, so an unknown one is an absent key
      // rather than an empty string. The output layer defaults them to "".
      ...(commonInfo.permalink ? { permalink: commonInfo.permalink } : {}),
      ...(error ? { error } : {}),
    };
  }

  /**
   * Extract app name, permalink and completion status from the header lines.
   *
   * @param lines Array of output lines from SST CLI
   * @returns Partial result containing common fields
   */
  protected parseCommonInfo(lines: string[]): Partial<BaseOperationResult> {
    const fullOutput = lines.join("\n");
    const result: Partial<BaseOperationResult> = {};

    try {
      const appMatch = fullOutput.match(SSTPatterns.metadata.app);
      if (appMatch?.[1]) {
        result.app = appMatch[1].trim();
      }

      const permalinkMatch = fullOutput.match(SSTPatterns.metadata.permalink);
      if (permalinkMatch?.[1]) {
        result.permalink = permalinkMatch[1].trim();
      }

      if (SSTPatterns.status.success.test(fullOutput)) {
        result.completionStatus = "complete";
      } else if (SSTPatterns.status.partial.test(fullOutput)) {
        result.completionStatus = "partial";
      } else if (SSTPatterns.status.failed.test(fullOutput)) {
        result.completionStatus = "failed";
      }
    } catch {
      // Parsing is optional - continue without it
    }

    return result;
  }

  /**
   * Determine whether the operation succeeded.
   *
   * The exit code is the primary indicator; `failurePatterns` supplies the
   * per-operation cases where a zero exit still means failure. Partial
   * completion counts as success with warnings.
   */
  protected isSuccessfulOperation(output: string, exitCode: number): boolean {
    if (exitCode !== 0) {
      return false;
    }

    return !this.failurePatterns.some((pattern) => pattern.test(output));
  }

  /**
   * Normalize line endings, trailing whitespace and runs of blank lines, so
   * pattern matching behaves the same across environments and SST versions.
   */
  private cleanText(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    try {
      return PatternHelpers.cleanText(text);
    } catch {
      // If cleaning fails, return original text
      return text;
    }
  }
}
