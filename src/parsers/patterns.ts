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
const URL_TEST_PATTERN = /^https?:\/\//;

/**
 * Metadata patterns for application and stage information
 */
export const MetadataPatterns = {
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
export const StatusPatterns = {
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
export const OperationPatterns = {
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
export const ResourcePatterns = {
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
export const OutputPatterns = {
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
export const SectionPatterns = {
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
export const UtilityPatterns = {
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
   * Extract a single match from text using a pattern
   * Returns the specified capture group or null if no match
   *
   * @param text Text to search
   * @param pattern Regex pattern
   * @param group Capture group index (default: 1)
   * @returns Matched string or null
   *
   * @example
   * ```typescript
   * const app = PatternHelpers.extractMatch(output, MetadataPatterns.app);
   * // Returns: "my-app" or null
   * ```
   */
  static extractMatch(text: string, pattern: RegExp, group = 1): string | null {
    const match = text.match(pattern);
    return match?.[group]?.trim() || null;
  }

  /**
   * Extract all matches from text using a pattern
   * Returns array of strings from the specified capture group
   *
   * @param text Text to search
   * @param pattern Regex pattern (will be made global if not already)
   * @param group Capture group index (default: 1)
   * @returns Array of matched strings
   *
   * @example
   * ```typescript
   * const urls = PatternHelpers.extractAllMatches(output, OutputPatterns.url, 2);
   * // Returns: ["https://api.example.com", "https://web.example.com"]
   * ```
   */
  static extractAllMatches(text: string, pattern: RegExp, group = 1): string[] {
    const globalPattern = new RegExp(pattern.source, "gm");
    return Array.from(text.matchAll(globalPattern), (m) =>
      m[group]?.trim()
    ).filter(Boolean) as string[];
  }

  /**
   * Test if text matches any of the provided patterns
   *
   * @param text Text to test
   * @param patterns Array of regex patterns
   * @returns true if any pattern matches
   *
   * @example
   * ```typescript
   * const isComplete = PatternHelpers.matchesAny(output, [
   *   StatusPatterns.success,
   *   StatusPatterns.partial
   * ]);
   * ```
   */
  static matchesAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(text));
  }

  /**
   * Test if text matches all of the provided patterns
   *
   * @param text Text to test
   * @param patterns Array of regex patterns
   * @returns true if all patterns match
   */
  static matchesAll(text: string, patterns: RegExp[]): boolean {
    return patterns.every((p) => p.test(text));
  }

  /**
   * Clean text by removing ANSI codes and normalizing line endings
   *
   * @param text Text to clean
   * @returns Cleaned text
   *
   * @example
   * ```typescript
   * const clean = PatternHelpers.cleanText(rawOutput);
   * ```
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

  /**
   * Check if a string is a valid URL
   *
   * @param str String to test
   * @returns true if string is a URL
   */
  static isUrl(str: string): boolean {
    return URL_TEST_PATTERN.test(str);
  }

  /**
   * Parse timing information from a string
   *
   * @param str String containing timing like "(2.1s)"
   * @returns Timing in seconds or null
   *
   * @example
   * ```typescript
   * const timing = PatternHelpers.parseTiming("(2.1s)");
   * // Returns: 2.1
   * ```
   */
  static parseTiming(str: string): number | null {
    const match = str.match(UtilityPatterns.timing);
    if (!match?.[1]) {
      return null;
    }
    return Number.parseFloat(match[1]);
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

/**
 * Type for pattern categories
 */
export type SSTPatternCategory = keyof typeof SSTPatterns;
