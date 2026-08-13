import { describe, expect, it } from "vitest";
import { OperationFormatter } from "@/github/formatters";
import { DeployParser } from "@/parsers/deploy-parser";
import { DiffParser } from "@/parsers/diff-parser";
import { RemoveParser } from "@/parsers/remove-parser";
import type { SSTOperation } from "@/types/operations";
import {
  compareWithSnapshot,
  listSnapshots,
  loadInput,
  loadSnapshotData,
  snapshotExists,
} from "../utils/snapshot-helpers";

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

const REGENERATE_HINT =
  "Snapshots are committed fixtures and are never generated during a test run. " +
  "If the output is meant to change, run `bun run snapshots:generate:force`, " +
  "review the diff, and commit it.";

/**
 * Fail on a missing snapshot rather than creating one.
 *
 * This suite used to regenerate missing snapshots in a `beforeAll` hook, so a
 * deleted snapshot was silently recreated from whatever the code currently
 * produced and then compared against itself. Only a *changed* snapshot could
 * fail, which left an entire class of regression undetectable.
 */
function assertSnapshotCommitted(
  operation: OperationWithParser,
  name: string
): void {
  if (!snapshotExists(operation, name)) {
    throw new Error(
      `Missing committed snapshot for ${operation}/${name}. ${REGENERATE_HINT}`
    );
  }
}

/**
 * Extract stage from SST output
 */
function extractStage(output: string): string {
  const stageMatch = output.match(/Stage:\s+(.+)/);
  return stageMatch?.[1]?.trim() || "unknown-stage";
}

/**
 * Extract exit code from SST output
 */
function extractExitCode(output: string): number {
  return output.includes("✕  Failed") || output.includes("Error:") ? 1 : 0;
}

/**
 * Test snapshot consistency for an operation
 */
function testOperationSnapshots(operation: OperationWithParser): void {
  describe(`${operation} snapshots`, () => {
    const snapshots = listSnapshots(operation);

    if (snapshots.length === 0) {
      it.skip(`No input files found for ${operation}`, () => {
        // Empty test case for operations with no input files
      });
      return;
    }

    snapshots.forEach((name) => {
      describe(`${name}`, () => {
        it("should have a committed snapshot", () => {
          assertSnapshotCommitted(operation, name);
        });

        it("should match comment snapshot", () => {
          assertSnapshotCommitted(operation, name);

          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);
          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          const generated = formatter.formatOperationComment(parsed);
          const comparison = compareWithSnapshot(
            operation,
            name,
            "comment",
            generated
          );

          // The diff goes in the assertion message so a mismatch actually
          // reports what changed. It used to be logged after the assertion,
          // which threw first, so it never printed.
          expect(
            comparison.matches,
            `Comment snapshot mismatch for ${operation}/${name}:\n${comparison.diff}`
          ).toBe(true);
        });

        it("should match summary snapshot", () => {
          assertSnapshotCommitted(operation, name);

          const rawOutput = loadInput(operation, name);
          const stage = extractStage(rawOutput);
          const exitCode = extractExitCode(rawOutput);
          const parsed = parsers[operation].parse(rawOutput, stage, exitCode);

          const generated = formatter.formatOperationSummary(parsed);
          const comparison = compareWithSnapshot(
            operation,
            name,
            "summary",
            generated
          );

          expect(
            comparison.matches,
            `Summary snapshot mismatch for ${operation}/${name}:\n${comparison.diff}`
          ).toBe(true);
        });

        it("should have consistent metadata", () => {
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
              `Failed to validate metadata for ${operation}/${name}: ${error}`,
              { cause: error }
            );
          }
        });

        it("should have non-empty snapshots", () => {
          try {
            const snapshotData = loadSnapshotData(operation, name);

            expect(snapshotData.comment.trim()).not.toBe("");
            expect(snapshotData.summary.trim()).not.toBe("");
            expect(snapshotData.input.trim()).not.toBe("");
          } catch (error) {
            throw new Error(
              `Failed to validate snapshot content for ${operation}/${name}: ${error}`,
              { cause: error }
            );
          }
        });
      });
    });

    // Integration test for the operation as a whole
    it(`should have valid snapshots for all ${operation} examples`, () => {
      expect(snapshots.length).toBeGreaterThan(0);

      const missing = snapshots.filter(
        (name) => !snapshotExists(operation, name)
      );

      expect(
        missing,
        `Inputs without a committed snapshot: ${missing.join(", ")}. ${REGENERATE_HINT}`
      ).toEqual([]);
    });
  });
}

// Test all operations
describe("Snapshot Testing Suite", () => {
  describe("Formatter Output Validation", () => {
    testOperationSnapshots("deploy");
    testOperationSnapshots("diff");
    testOperationSnapshots("remove");
  });

  describe("Cross-Operation Consistency", () => {
    it("should have consistent snapshot structure across operations", () => {
      const operations: OperationWithParser[] = ["deploy", "diff", "remove"];
      const snapshotCounts = operations.map((op) => listSnapshots(op).length);

      // Ensure each operation has at least some test cases
      for (let i = 0; i < operations.length; i += 1) {
        expect(snapshotCounts[i]).toBeGreaterThanOrEqual(1);
      }
    });

    it("should generate parseable content for all snapshots", () => {
      const operations: OperationWithParser[] = ["deploy", "diff", "remove"];

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

  describe("Regression Testing", () => {
    it("should maintain backward compatibility with existing format", () => {
      // Test that snapshots maintain expected structure and content
      const operations: SSTOperation[] = ["deploy", "diff", "remove"];

      for (const operation of operations) {
        const snapshots = listSnapshots(operation);
        for (const name of snapshots) {
          assertSnapshotCommitted(operation as OperationWithParser, name);

          const snapshotData = loadSnapshotData(operation, name);

          // Comment should start with operation indicator
          expect(snapshotData.comment).toMatch(/^(##|###|\*\*|<!--)/);

          // Summary should contain key information
          expect(snapshotData.summary.length).toBeGreaterThan(10);

          // Metadata should have required fields
          expect(snapshotData.metadata).toHaveProperty("operation");
          expect(snapshotData.metadata).toHaveProperty("stage");
          expect(snapshotData.metadata).toHaveProperty("success");
        }
      }
    });
  });
});
