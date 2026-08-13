/**
 * Centralized SST CLI Output Pattern Library
 * Single source of truth for all regex patterns used to parse SST CLI output
 *
 * It had claimed to be the single source of truth while every concrete parser
 * kept private copies, which is how three different glyphs for one failure
 * marker survived. Patterns now live here and nowhere else, so a change to the
 * CLI's output format is one file's problem.
 *
 * Groups are shared-first, then per-operation. A pattern belongs in a shared
 * group only when every operation reads the same syntax; near-identical
 * patterns that differ in what they accept stay apart, with the difference
 * documented on each.
 *
 * Stage-name slugification (`src/parsers/stage-processor.ts`) is deliberately
 * not here: those patterns match a Git ref, not SST output.
 */

/**
 * Metadata patterns for application and stage information
 */
const MetadataPatterns = {
  /** Matches: "App: my-app" or "➜ App: my-app" */
  app: /^(?:➜\s+)?App:\s+(.+)$/m,

  /** Matches: "Permalink: https://..." or "↗ Permalink: https://..." */
  permalink: /^(?:↗\s+)?Permalink:?\s+(https?:\/\/.+)$/m,

  /** Matches: "  Stage: production" */
  stage: /^\s*Stage:\s+(.+)$/m,
} as const;

/**
 * Completion status patterns
 */
const StatusPatterns = {
  /**
   * Matches: "✕ Failed".
   *
   * Real SST output uses U+2715 (✕). The codebase previously carried three
   * different glyphs for this one marker — U+2715, U+2717 (✗) and U+00D7 (×) —
   * so all three are accepted. An unmatched marker fails silently, degrading
   * error extraction without failing anything, and one real capture is thin
   * evidence for narrowing to a single glyph.
   */
  failed: /^[✕✗×]\s+Failed\s*$/m,

  /**
   * Matches: "⚠ Partial".
   *
   * Distinct from `remove.partialCompletion`, which matches the longer
   * "⚠ Partial completion" that remove output emits.
   */
  partial: /^⚠\s+Partial\s*$/m,

  /**
   * Matches: "✓ Complete", "✓ Generated", "✓ Removed".
   *
   * Real remove output ends with "✓  Removed", which no pattern in the
   * codebase matched. Deliberately wider than `deploy.completionSuccess`.
   */
  success: /^✓\s+(?:Complete|Generated|Removed)\s*$/m,
} as const;

/**
 * Error patterns shared across operations
 */
const ErrorPatterns = {
  /**
   * Matches: "Error: something went wrong", capturing the message.
   *
   * Requires content after the colon. `deploy.errorSectionStart` deliberately
   * does not, because it marks the start of a block rather than reading a
   * message out of one line.
   */
  message: /^Error:\s*(.+)$/m,
} as const;

/**
 * Resource patterns shared across operations
 */
const ResourcePatterns = {
  /**
   * Generic resource line with pipe separator
   * Format: "| resource information"
   */
  line: /^\|\s+(.+)$/m,
} as const;

/**
 * Output and URL patterns
 */
const OutputPatterns = {
  /**
   * Matches URL outputs from various SST resource types
   * Example: "Router: https://example.com"
   */
  url: /^\s*(Router|Api|Web|Website|StaticSite|NextjsSite|RemixSite|SvelteKitSite|SolidStartSite|AstroSite):\s+(https?:\/\/.+)$/m,
} as const;

/**
 * Section and structure patterns
 */
const SectionPatterns = {
  /** Matches: "✓ Generated" - marks start of diff section */
  generated: /^✓\s+Generated\s*$/m,

  /** Matches multiple consecutive newlines */
  separator: /\n\n+/,
} as const;

/**
 * Common utility patterns
 */
const UtilityPatterns = {
  /** Matches ANSI color codes */
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require control characters
  ansiCodes: /\x1b\[\d+m/g,

  /** Matches Windows-style line endings (CRLF) */
  lineEnding: /\r\n/g,

  /** Matches trailing whitespace at end of line */
  trailingWhitespace: /\s+$/,
} as const;

/**
 * Deploy output patterns
 *
 * The three resource patterns read SST v3's pipe-prefixed progress lines, e.g.
 * "|  Created  Function my-fn (2.1s)".
 */
const DeployPatterns = {
  /**
   * Matches: "✓ Complete".
   *
   * Deliberately narrower than `status.success`: this marks where the outputs
   * section begins, so widening it to accept "Generated" or "Removed" would
   * move where deploy starts reading outputs.
   */
  completionSuccess: /^✓\s+Complete\s*$/m,

  /**
   * Matches a line beginning "Error:", with no capture and no requirement that
   * the line carry a message. It opens an error block that is read line by
   * line; `errors.message` reads a single line instead.
   */
  errorSectionStart: /^Error:/m,

  /** Matches the gRPC client failure SST surfaces on a lost connection */
  grpcError: /grpc: the client/,

  /** Strips the leading "| " from a progress line */
  pipePrefix: /^\|\s*/,

  /** Matches: "|  Created  Function my-fn (2.1s)" */
  resourceCreated: /^\|\s+Created\s+(.+?)\s+(.+?)(?:\s+\(([\d.]+s)\))?$/,

  /** Matches: "|  Deleted  Function my-fn (0.8s)" */
  resourceDeleted: /^\|\s+Deleted\s+(.+?)\s+(.+?)(?:\s+\(([\d.]+s)\))?$/,

  /** Matches: "resource 'X' does not exist", capturing the resource id */
  resourceNotExist: /resource '([^']+)' does not exist/,

  /** Matches: "|  Updated  Function my-fn (1.5s)" */
  resourceUpdated: /^\|\s+Updated\s+(.+?)\s+(.+?)(?:\s+\(([\d.]+s)\))?$/,
} as const;

/**
 * Diff output patterns
 */
const DiffPatterns = {
  /** Matches the failure modes that mean no diff could be produced at all */
  failed: /Unable to generate diff|Permission denied|Error parsing/i,

  /** Matches a nested change line, which belongs to the resource above it */
  indentedChild: /^\s+[+*-]/,

  /** Matches: "No changes" */
  noChanges: /^No changes$/m,

  /**
   * Matches a top-level planned change.
   * Groups: [1] = action symbol, [2] = identifier, [3] = optional detail
   */
  topLevelResource: /^([+*-])\s+([^\s].*?)(?:\s+→\s+(.+))?$/,
} as const;

/**
 * Remove output patterns
 *
 * The three resource patterns share a shape and differ only in leading glyph,
 * which is what distinguishes a removed resource from a failed or skipped one.
 */
const RemovePatterns = {
  /**
   * Matches: "× Function my-fn (1.2s)".
   *
   * U+00D7 here marks a resource line, not the "✕ Failed" completion marker in
   * `status.failed`, despite the glyph overlap.
   */
  failedResource: /^×\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,

  /** Matches: "⚠ Partial completion", which is longer than `status.partial` */
  partialCompletion: /^⚠\s+Partial completion\s*$/m,

  /** Matches: "- Function my-fn (0.8s)" */
  removedResource: /^-\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,

  /** Matches the failure modes that mean the removal could not run */
  removeFailed: /Unable to connect|Permission denied|Error removing/i,

  /** Matches: "~ Function my-fn" */
  skippedResource: /^~\s+(\w+)\s+(.+?)(?:\s+\(([^)]+)\))?$/,
} as const;

/**
 * Pattern helper utilities
 */
// biome-ignore lint/complexity/noStaticOnlyClass: This is a namespace-like pattern for organizing pattern utility functions
export class PatternHelpers {
  /**
   * Clean text by removing ANSI codes and normalizing line endings
   *
   * @param text Text to clean
   * @returns Cleaned text
   */
  static cleanText(text: string): string {
    return text
      .replace(UtilityPatterns.ansiCodes, "")
      .replace(UtilityPatterns.lineEnding, "\n")
      .split("\n")
      .map((line) => line.replace(UtilityPatterns.trailingWhitespace, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n") // Collapse excessive blank lines
      .trim();
  }
}

/**
 * All patterns grouped for convenient access
 */
export const SSTPatterns = {
  deploy: DeployPatterns,
  diff: DiffPatterns,
  errors: ErrorPatterns,
  metadata: MetadataPatterns,
  outputs: OutputPatterns,
  remove: RemovePatterns,
  resources: ResourcePatterns,
  sections: SectionPatterns,
  status: StatusPatterns,
  utilities: UtilityPatterns,
} as const;
