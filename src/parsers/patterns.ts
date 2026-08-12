/**
 * Centralized SST CLI Output Pattern Library
 * Single source of truth for all regex patterns used to parse SST CLI output
 *
 * Benefits:
 * - Easy to find and update patterns
 * - Reduced duplication across parsers
 * - Better documentation of pattern purpose
 * - Easier to test patterns in isolation
 * - Type-safe pattern access
 */

/**
 * Top-level regex patterns for performance
 * These are used in helper functions and should not be recreated on each call
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
  /** Matches: "✗ Failed" */
  failed: /^✗\s+Failed\s*$/m,

  /** Matches: "⚠ Partial" */
  partial: /^⚠\s+Partial\s*$/m,
  /** Matches: "✓ Complete" */
  success: /^✓\s+Complete\s*$/m,
} as const;

/**
 * Operation start marker patterns
 */
const OperationPatterns = {
  /** Matches: "Deploy: my-app" or "→ Deploy: my-app" */
  deploy: /^(?:→\s+)?Deploy:\s+(.+)$/m,

  /** Matches: "Diff: my-app" or "→ Diff: my-app" */
  diff: /^(?:→\s+)?Diff:\s+(.+)$/m,

  /** Matches: "Remove: my-app" or "→ Remove: my-app" */
  remove: /^(?:→\s+)?Remove:\s+(.+)$/m,
} as const;

/**
 * Resource patterns for parsing infrastructure changes
 */
const ResourcePatterns = {
  /**
   * Matches resource creation lines
   * Format: "+ ResourceType resource-name (optional timing)"
   * Example: "+ AWS::Lambda::Function my-function (2.1s)"
   */
  created: /^\s*\+\s+(.+?)\s+([\w-]+)(?:\s+(.+))?$/,

  /**
   * Matches resource deletion lines
   * Format: "- ResourceType resource-name (optional timing)"
   * Example: "- AWS::DynamoDB::Table my-table (0.8s)"
   */
  deleted: /^\s*-\s+(.+?)\s+([\w-]+)(?:\s+(.+))?$/,

  /**
   * Unified diff pattern that captures action symbol
   * Matches any resource change with action indicator
   * Groups: [1] = action (+/~/−), [2] = type, [3] = name, [4] = optional timing
   */
  diff: /^\s*([~+-])\s+(.+?)\s+([\w-]+)(?:\s+(.+))?$/,

  /**
   * Generic resource line with pipe separator
   * Format: "| resource information"
   */
  line: /^\|\s+(.+)$/m,

  /**
   * Matches resource update lines
   * Format: "~ ResourceType resource-name (optional timing)"
   * Example: "~ AWS::S3::Bucket my-bucket (1.5s)"
   */
  updated: /^\s*~\s+(.+?)\s+([\w-]+)(?:\s+(.+))?$/,
} as const;

/**
 * Output and URL patterns
 */
const OutputPatterns = {
  /**
   * Matches key-value output pairs
   * Format: "OutputKey: value" or "OutputKey = value"
   * Example: "ApiUrl: https://api.example.com"
   */
  keyValue: /^([A-Za-z0-9_-]+)[:=]\s*(.+)$/,

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
  /** Matches line containing only dashes (separator line) */
  dashSeparator: /^-+$/m,
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

  /** Matches timing information like "(2.1s)" or "2.1s" */
  timing: /\(?([\d.]+s)\)?/,

  /** Matches trailing whitespace at end of line */
  trailingWhitespace: /\s+$/,
} as const;

/**
 * Pattern helper utilities
 */
// biome-ignore lint/complexity/noStaticOnlyClass: This is a namespace-like pattern for organizing pattern utility functions
export class PatternHelpers {
  /**
   * Clean text by removing ANSI codes and normalizing line endings
   *
   * Reached as `this.helpers.cleanText(...)` via the `helpers` alias on
   * OperationParser, which fallow's static analysis cannot follow — hence the
   * suppression rather than a deletion.
   *
   * @param text Text to clean
   * @returns Cleaned text
   */
  // fallow-ignore-next-line unused-class-member
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
  metadata: MetadataPatterns,
  operations: OperationPatterns,
  outputs: OutputPatterns,
  resources: ResourcePatterns,
  sections: SectionPatterns,
  status: StatusPatterns,
  utilities: UtilityPatterns,
} as const;
