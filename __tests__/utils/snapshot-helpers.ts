import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { OperationFormatter } from "@/github/formatters";
import type { OperationResult, SSTOperation } from "@/types/operations";

/**
 * Snapshot testing utilities for SST operations
 * Provides functions to generate, load, and compare snapshots
 */

export interface SnapshotMetadata {
  app: string;
  description?: string;
  files: {
    input: string;
    comment: string;
    summary: string;
    metadata: string;
  };
  generatedAt: string;
  name: string;
  operation: SSTOperation;
  stage: string;
  success: boolean;
}

export interface SnapshotData {
  comment: string;
  input: string;
  metadata: SnapshotMetadata;
  parsed: OperationResult;
  summary: string;
}

const formatter = new OperationFormatter();

/**
 * Example paths are recorded in committed metadata, so they must not vary by
 * checkout location or platform. Building them from `join(process.cwd(), ...)`
 * baked the generating machine's home directory into every committed file, and
 * would emit backslashes on Windows. The repo-relative POSIX form is the source
 * of truth; the absolute paths used for filesystem access derive from it, so
 * the two cannot drift apart.
 */
const EXAMPLES_DIR = "examples";

function toRepoPath(...segments: string[]): string {
  return [EXAMPLES_DIR, ...segments].join("/");
}

function toAbsolutePath(repoPath: string): string {
  return join(process.cwd(), repoPath);
}

/**
 * Get the root directory for examples
 */
export function getExamplesRoot(): string {
  return toAbsolutePath(EXAMPLES_DIR);
}

/**
 * Get the repo-relative path to an input file
 */
function getInputRepoPath(operation: SSTOperation, name: string): string {
  return toRepoPath("inputs", operation, `${name}.txt`);
}

/**
 * Get the repo-relative path to a snapshot file
 */
function getSnapshotRepoPath(
  operation: SSTOperation,
  name: string,
  type: "comment" | "summary"
): string {
  return toRepoPath("snapshots", operation, `${name}.${type}.md`);
}

/**
 * Get the repo-relative path to a metadata file
 */
function getMetadataRepoPath(operation: SSTOperation, name: string): string {
  return toRepoPath("metadata", operation, `${name}.metadata.json`);
}

/**
 * Get the path to an input file
 */
function getInputPath(operation: SSTOperation, name: string): string {
  return toAbsolutePath(getInputRepoPath(operation, name));
}

/**
 * Get the path to a snapshot file
 */
function getSnapshotPath(
  operation: SSTOperation,
  name: string,
  type: "comment" | "summary"
): string {
  return toAbsolutePath(getSnapshotRepoPath(operation, name, type));
}

/**
 * Get the path to a metadata file
 */
function getMetadataPath(operation: SSTOperation, name: string): string {
  return toAbsolutePath(getMetadataRepoPath(operation, name));
}

/**
 * Load raw SST output from input file
 */
export function loadInput(operation: SSTOperation, name: string): string {
  const inputPath = getInputPath(operation, name);
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  return readFileSync(inputPath, "utf8");
}

/**
 * Load snapshot content (comment or summary)
 */
function loadSnapshot(
  operation: SSTOperation,
  name: string,
  type: "comment" | "summary"
): string {
  const snapshotPath = getSnapshotPath(operation, name, type);
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found: ${snapshotPath}`);
  }
  return readFileSync(snapshotPath, "utf8");
}

/**
 * Load snapshot metadata
 */
export function loadMetadata(
  operation: SSTOperation,
  name: string
): SnapshotMetadata {
  const metadataPath = getMetadataPath(operation, name);
  if (!existsSync(metadataPath)) {
    throw new Error(`Metadata file not found: ${metadataPath}`);
  }
  const content = readFileSync(metadataPath, "utf8");
  return JSON.parse(content) as SnapshotMetadata;
}

/**
 * Load complete snapshot data
 */
export function loadSnapshotData(
  operation: SSTOperation,
  name: string
): SnapshotData {
  const input = loadInput(operation, name);
  const comment = loadSnapshot(operation, name, "comment");
  const summary = loadSnapshot(operation, name, "summary");
  const metadata = loadMetadata(operation, name);

  return {
    comment,
    input,
    metadata,
    parsed: metadata as any, // Will be populated by the parser
    summary,
  };
}

/**
 * Save snapshot content to file
 */
function saveSnapshot(
  operation: SSTOperation,
  name: string,
  type: "comment" | "summary",
  content: string
): void {
  const snapshotPath = getSnapshotPath(operation, name, type);
  const dir = dirname(snapshotPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(snapshotPath, content);
}

/**
 * Serialize metadata exactly as it is committed.
 *
 * The trailing newline is load-bearing: the committed files carry one, so a
 * file written without it comes back as a diff on every regeneration.
 */
function serializeMetadata(metadata: SnapshotMetadata): string {
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

/**
 * Save snapshot metadata
 */
function saveMetadata(
  operation: SSTOperation,
  name: string,
  metadata: SnapshotMetadata
): void {
  const metadataPath = getMetadataPath(operation, name);
  const dir = dirname(metadataPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(metadataPath, serializeMetadata(metadata));
}

/**
 * Read the committed metadata file, when it exists and carries a stamp.
 *
 * A truncated or hand-mangled file is treated as absent: the snapshot is
 * rewritten from scratch with a fresh stamp rather than throwing.
 */
function readExistingMetadata(
  operation: SSTOperation,
  name: string
): { content: string; generatedAt: string } | null {
  const metadataPath = getMetadataPath(operation, name);

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, "utf8");
    const { generatedAt } = JSON.parse(content) as Partial<SnapshotMetadata>;

    return typeof generatedAt === "string" ? { content, generatedAt } : null;
  } catch {
    return null;
  }
}

function buildMetadata(
  operation: SSTOperation,
  name: string,
  parsed: OperationResult,
  description: string,
  generatedAt: string
): SnapshotMetadata {
  return {
    app: parsed.app,
    description,
    files: {
      comment: getSnapshotRepoPath(operation, name, "comment"),
      input: getInputRepoPath(operation, name),
      metadata: getMetadataRepoPath(operation, name),
      summary: getSnapshotRepoPath(operation, name, "summary"),
    },
    generatedAt,
    name,
    operation,
    stage: parsed.stage,
    success: parsed.success,
  };
}

/**
 * Keep the committed `generatedAt` when re-stamping would be the only change.
 *
 * A fresh timestamp on every run made `snapshots:generate:force` dirty all the
 * committed metadata files even when the generated content was identical, so
 * the command could not be used to check for drift. The stamp now moves only
 * when the content it describes does. The comparison is against the file's
 * actual bytes rather than a deep compare of parsed objects, so it is immune
 * to key ordering: a hand-reordered file earns one fresh stamp and is then
 * rewritten canonically.
 */
function resolveMetadata(
  operation: SSTOperation,
  name: string,
  parsed: OperationResult,
  description: string
): SnapshotMetadata {
  const existing = readExistingMetadata(operation, name);

  if (existing) {
    const reused = buildMetadata(
      operation,
      name,
      parsed,
      description,
      existing.generatedAt
    );

    if (serializeMetadata(reused) === existing.content) {
      return reused;
    }
  }

  return buildMetadata(
    operation,
    name,
    parsed,
    description,
    new Date().toISOString()
  );
}

/**
 * Generate snapshots for a given input
 */
export function generateSnapshots(
  operation: SSTOperation,
  name: string,
  parsed: OperationResult,
  description?: string
): void {
  // Generate formatted output
  const comment = formatter.formatOperationComment(parsed);
  const summary = formatter.formatOperationSummary(parsed);

  // Save snapshots
  saveSnapshot(operation, name, "comment", comment);
  saveSnapshot(operation, name, "summary", summary);

  saveMetadata(
    operation,
    name,
    resolveMetadata(operation, name, parsed, description || "")
  );
}

/**
 * Compare generated content with existing snapshot
 */
export function compareWithSnapshot(
  operation: SSTOperation,
  name: string,
  type: "comment" | "summary",
  generated: string
): { matches: boolean; diff?: string } {
  try {
    const existing = loadSnapshot(operation, name, type);
    const matches = existing.trim() === generated.trim();

    if (!matches) {
      return {
        diff: `Expected:\n${existing}\n\nActual:\n${generated}`,
        matches: false,
      };
    }

    return { matches: true };
  } catch (error) {
    return {
      diff: `Snapshot file not found or error loading: ${error}`,
      matches: false,
    };
  }
}

/**
 * List all available snapshots for an operation
 */
export function listSnapshots(operation: SSTOperation): string[] {
  const inputDir = join(getExamplesRoot(), "inputs", operation);

  if (!existsSync(inputDir)) {
    return [];
  }

  const files = readdirSync(inputDir, { withFileTypes: true });
  return files
    .filter((file) => file.isFile() && file.name.endsWith(".txt"))
    .map((file) => file.name.replace(".txt", ""));
}

/**
 * Check if snapshot exists
 */
export function snapshotExists(operation: SSTOperation, name: string): boolean {
  const commentPath = getSnapshotPath(operation, name, "comment");
  const summaryPath = getSnapshotPath(operation, name, "summary");
  const metadataPath = getMetadataPath(operation, name);

  return (
    existsSync(commentPath) &&
    existsSync(summaryPath) &&
    existsSync(metadataPath)
  );
}

/**
 * Validate snapshot integrity
 */
export function validateSnapshot(
  operation: SSTOperation,
  name: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Check if all required files exist
    const inputPath = getInputPath(operation, name);
    const commentPath = getSnapshotPath(operation, name, "comment");
    const summaryPath = getSnapshotPath(operation, name, "summary");
    const metadataPath = getMetadataPath(operation, name);

    if (!existsSync(inputPath)) {
      errors.push(`Input file missing: ${inputPath}`);
    }
    if (!existsSync(commentPath)) {
      errors.push(`Comment snapshot missing: ${commentPath}`);
    }
    if (!existsSync(summaryPath)) {
      errors.push(`Summary snapshot missing: ${summaryPath}`);
    }
    if (!existsSync(metadataPath)) {
      errors.push(`Metadata file missing: ${metadataPath}`);
    }

    // Validate metadata if it exists
    if (existsSync(metadataPath)) {
      try {
        const metadata = loadMetadata(operation, name);
        if (metadata.operation !== operation) {
          errors.push(
            `Metadata operation mismatch: expected ${operation}, got ${metadata.operation}`
          );
        }
        if (metadata.name !== name) {
          errors.push(
            `Metadata name mismatch: expected ${name}, got ${metadata.name}`
          );
        }
      } catch (error) {
        errors.push(`Invalid metadata JSON: ${error}`);
      }
    }

    return { errors, valid: errors.length === 0 };
  } catch (error) {
    errors.push(`Validation error: ${error}`);
    return { errors, valid: false };
  }
}
