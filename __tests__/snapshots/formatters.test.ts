import { beforeAll, describe, expect, it } from 'vitest';
import { OperationFormatter } from '@/github/formatters';
import { DeployParser } from '@/parsers/deploy-parser';
import { DiffParser } from '@/parsers/diff-parser';
import { RemoveParser } from '@/parsers/remove-parser';
import type { SSTOperation } from '@/types/operations';
import {
  compareWithSnapshot,
  generateSnapshots,
  listSnapshots,
  loadInput,
  loadSnapshotData,
  snapshotExists,
} from '../utils/snapshot-helpers';

/**
 * Comprehensive snapshot testing for GitHub comment and summary formatters
 *
 * This test suite validates that formatter output matches expected snapshots
 * and serves as both regression testing and documentation of formatter behavior.
 */

const parsers = {
  deploy: new DeployParser(),
  diff: new DiffParser(),
  remove: new RemoveParser(),
} as const;

type OperationWithParser = keyof typeof parsers;

const formatter = new OperationFormatter();

// Generate snapshots before running tests if they don't exist
beforeAll(() => {
  generateMissingSnapshots();
});

/**
 * Generate missing snapshots for test operations
 */
function generateMissingSnapshots(): void {
  const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

  for (const operation of operations) {
    const snapshots = listSnapshots(operation);
    for (const name of snapshots) {
      if (!snapshotExists(operation, name)) {
        const rawOutput = loadInput(operation, name);
        const parsed = parsers[operation].parse(
          rawOutput,
          extractStage(rawOutput),
          extractExitCode(rawOutput)
        );
        generateSnapshots(
          operation,
          name,
          parsed,
          `Generated from ${name}.txt`
        );
      }
    }
  }
}

/**
 * Extract stage from SST output
 */
function extractStage(output: string): string {
  const stageMatch = output.match(/Stage:\s+(.+)/);
  return stageMatch?.[1]?.trim() || 'unknown-stage';
}

/**
 * Extract exit code from SST output
 */
function extractExitCode(output: string): number {
  return output.includes('✕  Failed') || output.includes('Error:') ? 1 : 0;
}

/**
 * Test snapshot consistency for an operation
 */
function testOperationSnapshots(operation: OperationWithParser): void {
  describe(`${operation} snapshots`, () => {
    const snapshots = listSnapshots(operation);

    if (snapshots.length === 0) {
      // biome-ignore lint/suspicious/noSkippedTests: This is intentional for empty test cases
      it.skip(`No input files found for ${operation}`, () => {
        // Empty test case for operations with no input files
      });
      return;
    }

    snapshots.forEach((name) => {
      describe(`${name}`, () => {
        it('should match comment snapshot', () => {
          try {
            const rawOutput = loadInput(operation, name);
            const stage = extractStage(rawOutput);
            const exitCode = extractExitCode(rawOutput);
            const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

            const generated = formatter.formatOperationComment(parsed);
            const comparison = compareWithSnapshot(
              operation,
              name,
              'comment',
              generated
            );

            expect(comparison.matches).toBe(true);
            if (comparison.diff) {
              // biome-ignore lint/suspicious/noConsole: This is for test debugging output
              console.error(
                `Comment snapshot mismatch for ${operation}/${name}:\n${comparison.diff}`
              );
            }
          } catch (error) {
            throw new Error(
              `Failed to test comment snapshot for ${operation}/${name}: ${error}`
            );
          }
        });

        it('should match summary snapshot', () => {
          try {
            const rawOutput = loadInput(operation, name);
            const stage = extractStage(rawOutput);
            const exitCode = extractExitCode(rawOutput);
            const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

            const generated = formatter.formatOperationSummary(parsed);
            const comparison = compareWithSnapshot(
              operation,
              name,
              'summary',
              generated
            );

            expect(comparison.matches).toBe(true);
            if (comparison.diff) {
              // biome-ignore lint/suspicious/noConsole: This is for test debugging output
              console.error(
                `Summary snapshot mismatch for ${operation}/${name}:\n${comparison.diff}`
              );
            }
          } catch (error) {
            throw new Error(
              `Failed to test summary snapshot for ${operation}/${name}: ${error}`
            );
          }
        });

        it('should have consistent metadata', () => {
          try {
            const snapshotData = loadSnapshotData(operation, name);

            expect(snapshotData.metadata.operation).toBe(operation);
            expect(snapshotData.metadata.name).toBe(name);
            expect(snapshotData.metadata.generatedAt).toBeDefined();
            expect(snapshotData.metadata.files.input).toContain(`${name}.txt`);
            expect(snapshotData.metadata.files.comment).toContain(
              `${name}.comment.md`
            );
            expect(snapshotData.metadata.files.summary).toContain(
              `${name}.summary.md`
            );
            expect(snapshotData.metadata.files.metadata).toContain(
              `${name}.metadata.json`
            );
          } catch (error) {
            throw new Error(
              `Failed to validate metadata for ${operation}/${name}: ${error}`
            );
          }
        });

        it('should have non-empty snapshots', () => {
          try {
            const snapshotData = loadSnapshotData(operation, name);

            expect(snapshotData.comment.trim()).not.toBe('');
            expect(snapshotData.summary.trim()).not.toBe('');
            expect(snapshotData.input.trim()).not.toBe('');
          } catch (error) {
            throw new Error(
              `Failed to validate snapshot content for ${operation}/${name}: ${error}`
            );
          }
        });
      });
    });

    // Integration test for the operation as a whole
    it(`should have valid snapshots for all ${operation} examples`, () => {
      const totalSnapshots = snapshots.length;
      expect(totalSnapshots).toBeGreaterThan(0);

      let validSnapshots = 0;
      for (const name of snapshots) {
        if (snapshotExists(operation, name)) {
          validSnapshots++;
        }
      }

      expect(validSnapshots).toBe(totalSnapshots);
    });
  });
}

// Test all operations
describe('Snapshot Testing Suite', () => {
  describe('Formatter Output Validation', () => {
    testOperationSnapshots('deploy');
    testOperationSnapshots('diff');
    testOperationSnapshots('remove');
  });

  describe('Cross-Operation Consistency', () => {
    it('should have consistent snapshot structure across operations', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];
      const snapshotCounts = operations.map((op) => listSnapshots(op).length);

      // Ensure each operation has at least some test cases
      for (let i = 0; i < operations.length; i++) {
        expect(snapshotCounts[i]).toBeGreaterThanOrEqual(1);
      }
    });

    it('should generate parseable content for all snapshots', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const snapshots = listSnapshots(operation);
        for (const name of snapshots) {
          expect(() => {
            const rawOutput = loadInput(operation, name);
            const stage = extractStage(rawOutput);
            const exitCode = extractExitCode(rawOutput);
            parsers[operation].parse(rawOutput, stage, exitCode);
          }).not.toThrow();
        }
      }
    });
  });

  describe('Regression Testing', () => {
    it('should maintain backward compatibility with existing format', () => {
      // Test that snapshots maintain expected structure and content
      const operations: SSTOperation[] = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const snapshots = listSnapshots(operation);
        for (const name of snapshots) {
          if (!snapshotExists(operation, name)) {
            continue;
          }

          const snapshotData = loadSnapshotData(operation, name);

          // Comment should start with operation indicator
          expect(snapshotData.comment).toMatch(/^(##|###|\*\*|<!--)/);

          // Summary should contain key information
          expect(snapshotData.summary.length).toBeGreaterThan(10);

          // Metadata should have required fields
          expect(snapshotData.metadata).toHaveProperty('operation');
          expect(snapshotData.metadata).toHaveProperty('stage');
          expect(snapshotData.metadata).toHaveProperty('success');
        }
      }
    });
  });
});
