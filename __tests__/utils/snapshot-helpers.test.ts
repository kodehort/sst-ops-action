import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiffParser } from "@/parsers/diff-parser";
import {
  compareWithSnapshot,
  generateSnapshots,
  listSnapshots,
  loadInput,
  loadMetadata,
  snapshotExists,
  validateSnapshot,
} from "./snapshot-helpers";

/**
 * The generator writes files that are committed, so its output has to be a
 * pure function of its input. It was not: `files.*` recorded
 * `join(process.cwd(), ...)` and `generatedAt` a fresh clock reading, so
 * `bun run snapshots:generate:force` rewrote every metadata file on every run,
 * on any machine — the committed values still carried the original author's
 * home directory.
 *
 * These tests run the generator against a throwaway working directory, so the
 * committed fixtures under `examples/` are never touched.
 */
describe("generateSnapshots", () => {
  const OPERATION = "diff" as const;
  const NAME = "no-changes";
  const DESCRIPTION = `Generated from ${NAME}.txt`;
  const METADATA_PATH = `examples/metadata/${OPERATION}/${NAME}.metadata.json`;

  // Read from the real checkout before any test redirects `process.cwd`.
  const rawOutput = loadInput(OPERATION, NAME);
  const parsed = new DiffParser().parse(rawOutput, "staging", 0, false);

  let workspace: string | undefined;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    if (workspace) {
      rmSync(workspace, { force: true, recursive: true });
      workspace = undefined;
    }
  });

  /**
   * Generate into a scratch directory and hand back the metadata file's bytes.
   *
   * `getExamplesRoot` resolves `process.cwd()` per call, so the spy has to stay
   * in place for the assertions that load the result back.
   */
  function useWorkspace(): string {
    if (!workspace) {
      workspace = mkdtempSync(`${tmpdir()}/sst-snapshots-`);

      // Seed the input the generator's output claims to describe, so
      // `validateSnapshot` sees a complete snapshot triple.
      const inputDir = `${workspace}/examples/inputs/${OPERATION}`;
      mkdirSync(inputDir, { recursive: true });
      writeFileSync(`${inputDir}/${NAME}.txt`, rawOutput);
    }

    vi.spyOn(process, "cwd").mockReturnValue(workspace);

    return workspace;
  }

  function generateIntoWorkspace(
    result = parsed,
    description = DESCRIPTION
  ): string {
    const root = useWorkspace();

    generateSnapshots(OPERATION, NAME, result, description);

    return readFileSync(`${root}/${METADATA_PATH}`, "utf8");
  }

  it("records repository-relative POSIX paths, not machine-absolute ones", () => {
    generateIntoWorkspace();

    expect(loadMetadata(OPERATION, NAME).files).toEqual({
      comment: `examples/snapshots/${OPERATION}/${NAME}.comment.md`,
      input: `examples/inputs/${OPERATION}/${NAME}.txt`,
      metadata: METADATA_PATH,
      summary: `examples/snapshots/${OPERATION}/${NAME}.summary.md`,
    });
  });

  it("records the parsed result alongside the paths", () => {
    generateIntoWorkspace();

    const metadata = loadMetadata(OPERATION, NAME);

    expect(metadata).toMatchObject({
      app: parsed.app,
      description: DESCRIPTION,
      name: NAME,
      operation: OPERATION,
      stage: "staging",
      success: parsed.success,
    });
  });

  it("defaults a missing description to an empty string", () => {
    useWorkspace();

    generateSnapshots(OPERATION, NAME, parsed);

    expect(loadMetadata(OPERATION, NAME).description).toBe("");
  });

  it("writes metadata with the trailing newline the committed files carry", () => {
    expect(generateIntoWorkspace().endsWith("}\n")).toBe(true);
  });

  it("is idempotent: a second run rewrites byte-identical metadata", () => {
    const first = generateIntoWorkspace();

    // Move the clock on. Without this, two runs inside the same millisecond
    // would pass even if the stamp were still being rewritten every time.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    expect(generateIntoWorkspace()).toBe(first);
  });

  it("re-stamps generatedAt when the content actually changes", () => {
    const before = loadMetadataFrom(generateIntoWorkspace()).generatedAt;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    const after = loadMetadataFrom(
      generateIntoWorkspace(parsed, "a different description")
    );

    expect(after.generatedAt).not.toBe(before);
    expect(after.description).toBe("a different description");
  });

  it("stamps a fresh time when no metadata has been committed yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    expect(loadMetadataFrom(generateIntoWorkspace()).generatedAt).toBe(
      "2099-01-01T00:00:00.000Z"
    );
  });

  it("re-stamps rather than throwing when the committed file is corrupt", () => {
    const root = useWorkspace();

    generateSnapshots(OPERATION, NAME, parsed, DESCRIPTION);
    writeCorruptMetadata(`${root}/${METADATA_PATH}`);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    generateSnapshots(OPERATION, NAME, parsed, DESCRIPTION);

    expect(loadMetadata(OPERATION, NAME).generatedAt).toBe(
      "2099-01-01T00:00:00.000Z"
    );
  });

  it("writes comment and summary snapshots the comparison accepts", () => {
    generateIntoWorkspace();

    expect(snapshotExists(OPERATION, NAME)).toBe(true);
    expect(validateSnapshot(OPERATION, NAME)).toEqual({
      errors: [],
      valid: true,
    });

    const comment = readFileSync(
      `${workspace}/examples/snapshots/${OPERATION}/${NAME}.comment.md`,
      "utf8"
    );

    expect(compareWithSnapshot(OPERATION, NAME, "comment", comment)).toEqual({
      matches: true,
    });
    expect(
      compareWithSnapshot(OPERATION, NAME, "comment", "not the snapshot")
        .matches
    ).toBe(false);
  });
});

describe("snapshot loading", () => {
  it("lists the committed inputs for an operation", () => {
    expect(listSnapshots("diff")).toContain("no-changes");
  });

  it("reports no snapshots for an operation with no input directory", () => {
    expect(listSnapshots("stage" as "diff")).toEqual([]);
  });

  it("names the missing file when an input is absent", () => {
    expect(() => loadInput("diff", "does-not-exist")).toThrow(
      /Input file not found/
    );
  });

  it("names the missing file when metadata is absent", () => {
    expect(() => loadMetadata("diff", "does-not-exist")).toThrow(
      /Metadata file not found/
    );
  });

  it("reports a snapshot with no committed files as missing and invalid", () => {
    expect(snapshotExists("diff", "does-not-exist")).toBe(false);

    const { errors, valid } = validateSnapshot("diff", "does-not-exist");

    expect(valid).toBe(false);
    expect(errors).toHaveLength(4);
  });

  it("reports a comparison against a missing snapshot as a mismatch", () => {
    const { diff, matches } = compareWithSnapshot(
      "diff",
      "does-not-exist",
      "comment",
      "anything"
    );

    expect(matches).toBe(false);
    expect(diff).toMatch(/Snapshot file not found/);
  });
});

function loadMetadataFrom(content: string): {
  description: string;
  generatedAt: string;
} {
  return JSON.parse(content) as { description: string; generatedAt: string };
}

function writeCorruptMetadata(path: string): void {
  writeFileSync(path, "{ not json");
}
