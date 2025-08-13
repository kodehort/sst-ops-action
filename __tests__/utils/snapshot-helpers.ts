import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { OperationFormatter } from '@/github/formatters';
import type { OperationResult, SSTOperation } from '@/types/operations';

/**
 * Snapshot testing utilities for SST operations
 * Provides functions to generate, load, and compare snapshots
 */

export interface SnapshotMetadata {
  name: string;
  operation: SSTOperation;
  app: string;
  stage: string;
  success: boolean;
  description?: string;
  generatedAt: string;
  files: {
    input: string;
    comment: string;
    summary: string;
    metadata: string;
  };
}

export interface SnapshotData {
  input: string;
  comment: string;
  summary: string;
  metadata: SnapshotMetadata;
  parsed: OperationResult;
}

const formatter = new OperationFormatter();

/**
 * Get the root directory for examples
 */
export function getExamplesRoot(): string {
  return join(process.cwd(), 'examples');
}

/**
 * Get the path to an input file
 */
export function getInputPath(operation: SSTOperation, name: string): string {
  return join(getExamplesRoot(), 'inputs', operation, `${name}.txt`);
}

/**
 * Get the path to a snapshot file
 */
export function getSnapshotPath(
  operation: SSTOperation,
  name: string,
  type: 'comment' | 'summary'
): string {
  return join(getExamplesRoot(), 'snapshots', operation, `${name}.${type}.md`);
}

/**
 * Get the path to a metadata file
 */
export function getMetadataPath(operation: SSTOperation, name: string): string {
  return join(
    getExamplesRoot(),
    'metadata',
    operation,
    `${name}.metadata.json`
  );
}

/**
 * Load raw SST output from input file
 */
export function loadInput(operation: SSTOperation, name: string): string {
  const inputPath = getInputPath(operation, name);
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  return readFileSync(inputPath, 'utf8');
}

/**
 * Load snapshot content (comment or summary)
 */
export function loadSnapshot(
  operation: SSTOperation,
  name: string,
  type: 'comment' | 'summary'
): string {
  const snapshotPath = getSnapshotPath(operation, name, type);
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found: ${snapshotPath}`);
  }
  return readFileSync(snapshotPath, 'utf8');
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
  const content = readFileSync(metadataPath, 'utf8');
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
  const comment = loadSnapshot(operation, name, 'comment');
  const summary = loadSnapshot(operation, name, 'summary');
  const metadata = loadMetadata(operation, name);

  return {
    input,
    comment,
    summary,
    metadata,
    parsed: metadata as any, // Will be populated by the parser
  };
}

/**
 * Save snapshot content to file
 */
export function saveSnapshot(
  operation: SSTOperation,
  name: string,
  type: 'comment' | 'summary',
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
 * Save snapshot metadata
 */
export function saveMetadata(
  operation: SSTOperation,
  name: string,
  metadata: SnapshotMetadata
): void {
  const metadataPath = getMetadataPath(operation, name);
  const dir = dirname(metadataPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
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
  saveSnapshot(operation, name, 'comment', comment);
  saveSnapshot(operation, name, 'summary', summary);

  // Create metadata
  const metadata: SnapshotMetadata = {
    name,
    operation,
    app: parsed.app,
    stage: parsed.stage,
    success: parsed.success,
    description: description || '',
    generatedAt: new Date().toISOString(),
    files: {
      input: getInputPath(operation, name),
      comment: getSnapshotPath(operation, name, 'comment'),
      summary: getSnapshotPath(operation, name, 'summary'),
      metadata: getMetadataPath(operation, name),
    },
  };

  saveMetadata(operation, name, metadata);
}

/**
 * Compare generated content with existing snapshot
 */
export function compareWithSnapshot(
  operation: SSTOperation,
  name: string,
  type: 'comment' | 'summary',
  generated: string
): { matches: boolean; diff?: string } {
  try {
    const existing = loadSnapshot(operation, name, type);
    const matches = existing.trim() === generated.trim();

    if (!matches) {
      return {
        matches: false,
        diff: `Expected:\n${existing}\n\nActual:\n${generated}`,
      };
    }

    return { matches: true };
  } catch (error) {
    return {
      matches: false,
      diff: `Snapshot file not found or error loading: ${error}`,
    };
  }
}

/**
 * List all available snapshots for an operation
 */
export function listSnapshots(operation: SSTOperation): string[] {
  const inputDir = join(getExamplesRoot(), 'inputs', operation);

  if (!existsSync(inputDir)) {
    return [];
  }

  const files = readdirSync(inputDir, { withFileTypes: true });
  return files
    .filter((file) => file.isFile() && file.name.endsWith('.txt'))
    .map((file) => file.name.replace('.txt', ''));
}

/**
 * Check if snapshot exists
 */
export function snapshotExists(operation: SSTOperation, name: string): boolean {
  const commentPath = getSnapshotPath(operation, name, 'comment');
  const summaryPath = getSnapshotPath(operation, name, 'summary');
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
    const commentPath = getSnapshotPath(operation, name, 'comment');
    const summaryPath = getSnapshotPath(operation, name, 'summary');
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

    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Validation error: ${error}`);
    return { valid: false, errors };
  }
}
