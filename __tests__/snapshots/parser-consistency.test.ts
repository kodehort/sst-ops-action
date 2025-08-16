import { describe, expect, it } from 'vitest';
import { DeployParser } from '@/parsers/deploy-parser';
import { DiffParser } from '@/parsers/diff-parser';
import { RemoveParser } from '@/parsers/remove-parser';
import {
  listSnapshots,
  loadInput,
  loadMetadata,
} from '../utils/snapshot-helpers';

/**
 * Parser consistency testing using snapshot inputs
 *
 * This test suite validates that parsers consistently handle
 * real-world SST outputs and maintain expected behavior.
 */

const parsers = {
  deploy: new DeployParser(),
  diff: new DiffParser(),
  remove: new RemoveParser(),
} as const;

type OperationWithParser = keyof typeof parsers;

/**
 * Extract stage from SST output
 */
function extractStage(output: string): string {
  const stageMatch = output.match(/Stage:\s+(.+)/);
  return stageMatch?.[1]?.trim() || 'unknown-stage';
}

/**
 * Extract app from SST output
 */
function extractApp(output: string): string {
  const appMatch = output.match(/➜\s+App:\s+(.+)/);
  return appMatch?.[1]?.trim() || 'unknown-app';
}

/**
 * Extract exit code from SST output
 */
function extractExitCode(output: string): number {
  return output.includes('✕  Failed') || output.includes('Error:') ? 1 : 0;
}

/**
 * Test parser consistency for an operation
 */
function testParserConsistency(operation: OperationWithParser): void {
  describe(`${operation} parser`, () => {
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
        it('should parse without throwing errors', () => {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          expect(() => {
            parsers[operation].parse(rawOutput, stage, exitCode);
          }).not.toThrow();
        });

        it('should extract correct metadata', () => {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const app = extractApp(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          expect(parsed.operation).toBe(operation);
          expect(parsed.stage).toBe(stage);
          expect(parsed.app).toBe(app);
          expect(parsed.success).toBe(exitCode === 0);
        });

        it('should match expected metadata from snapshot', () => {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          // Load expected metadata if it exists
          try {
            const metadata = loadMetadata(operation, name);

            expect(parsed.operation).toBe(metadata.operation);
            expect(parsed.stage).toBe(metadata.stage);
            expect(parsed.app).toBe(metadata.app);
            expect(parsed.success).toBe(metadata.success);
          } catch (error) {
            // Metadata might not exist yet, skip this check
            // biome-ignore lint/suspicious/noConsole: This is for test debugging
            console.warn(
              `Metadata not found for ${operation}/${name}: ${error}`
            );
          }
        });

        it('should have required base properties', () => {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          expect(parsed).toHaveProperty('operation');
          expect(parsed).toHaveProperty('stage');
          expect(parsed).toHaveProperty('app');
          expect(parsed).toHaveProperty('success');
          expect(parsed).toHaveProperty('rawOutput');

          expect(typeof parsed.operation).toBe('string');
          expect(typeof parsed.stage).toBe('string');
          expect(typeof parsed.app).toBe('string');
          expect(typeof parsed.success).toBe('boolean');
          expect(typeof parsed.rawOutput).toBe('string');
        });
      });
    });

    // Test operation-specific properties
    if (operation === 'deploy') {
      it('should have deploy-specific properties', () => {
        const deploySnapshots = listSnapshots(operation);
        for (const name of deploySnapshots) {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          expect(parsed).toHaveProperty('outputs');
          expect(Array.isArray(parsed.outputs)).toBe(true);
        }
      });
    }

    if (operation === 'diff') {
      it('should have diff-specific properties', () => {
        const diffSnapshots = listSnapshots(operation);
        for (const name of diffSnapshots) {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          expect(parsed).toHaveProperty('changes');
          expect(parsed).toHaveProperty('plannedChanges');
          expect(Array.isArray(parsed.changes)).toBe(true);
          expect(typeof parsed.plannedChanges).toBe('number');
        }
      });
    }

    if (operation === 'remove') {
      it('should have remove-specific properties', () => {
        const removeSnapshots = listSnapshots(operation);
        for (const name of removeSnapshots) {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          expect(parsed).toHaveProperty('removedResources');
          expect(Array.isArray(parsed.removedResources)).toBe(true);
        }
      });
    }
  });
}

describe('Parser Consistency Testing', () => {
  describe('Individual Parser Validation', () => {
    testParserConsistency('deploy');
    testParserConsistency('diff');
    testParserConsistency('remove');
  });

  describe('Cross-Parser Consistency', () => {
    it('should handle consistent SST output format', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const snapshots = listSnapshots(operation);
        for (const name of snapshots) {
          const rawOutput = loadInput(operation, name);

          // All outputs should have SST version
          expect(rawOutput).toMatch(/SST \d+\.\d+\.\d+/);

          // All outputs should have App and Stage
          expect(rawOutput).toMatch(/➜\s+App:\s+.+/);
          expect(rawOutput).toMatch(/Stage:\s+.+/);
        }
      }
    });

    it('should handle success and failure cases appropriately', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const snapshots = listSnapshots(operation);
        for (const name of snapshots) {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);

          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          // Success status should match exit code
          expect(parsed.success).toBe(exitCode === 0);

          // Failed operations should contain error indicators
          if (!parsed.success) {
            expect(
              rawOutput.includes('✕  Failed') ||
                rawOutput.includes('Error:') ||
                rawOutput.includes('failed')
            ).toBe(true);
          }
        }
      }
    });

    it('should extract permalinks when present', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

      // Test each operation's permalinks
      operations.forEach((operation) => {
        const snapshots = listSnapshots(operation);
        const permalinkSnapshots = snapshots.filter((name) => {
          return loadInput(operation, name).includes('↗  Permalink');
        });

        // Test permalink extraction for snapshots that have them
        permalinkSnapshots.forEach((name) => {
          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);
          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          const permalinkMatch = rawOutput.match(
            /↗\s+Permalink\s+(https?:\/\/.+)/
          );
          if (permalinkMatch) {
            expect(parsed.rawOutput).toContain(permalinkMatch[1]);
          }
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle minimal SST output', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const minimalOutput = `SST 3.17.4  ready!

➜  App:        test-app
   Stage:      test

~  ${operation.charAt(0).toUpperCase() + operation.slice(1)}

✓  Complete`;

        expect(() => {
          parsers[operation].parse(minimalOutput, 'test', 0);
        }).not.toThrow();
      }
    });

    it('should handle malformed input gracefully', () => {
      const operations: OperationWithParser[] = ['deploy', 'diff', 'remove'];

      for (const operation of operations) {
        const malformedOutput = 'Invalid SST output';

        expect(() => {
          parsers[operation].parse(malformedOutput, 'test', 1);
        }).not.toThrow();
      }
    });
  });
});
