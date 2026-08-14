/**
 * The fields every parser reports have to be built the same way.
 *
 * Before #151 each parser hand-assembled the nine shared fields and they
 * disagreed twice over:
 *
 * - a missing permalink was an absent key in deploy and `""` in diff and
 *   remove;
 * - deploy parsed the raw capture while diff and remove parsed a cleaned one,
 *   so the same header line could be read differently depending on which
 *   command produced it.
 *
 * They now come from one builder behind one entry point. These tests are the
 * guard on that; the companion is app-fallback.test.ts, which pins the third
 * shared default.
 */

import { describe, expect, it } from "vitest";
import { DeployParser } from "@/parsers/deploy-parser";
import { DiffParser } from "@/parsers/diff-parser";
import { RemoveParser } from "@/parsers/remove-parser";

/** Real SST output shape with no `↗ Permalink` line. */
const WITHOUT_PERMALINK = `SST 3.17.10  ready!

➜  App:        my-app
   Stage:      staging

✓  Complete
`;

/** The same run, reported with Windows line endings and padded blank lines. */
const NEEDS_CLEANING =
  "SST 3.17.10  ready!\r\n\r\n➜  App:        my-app   \r\n" +
  "   Stage:      staging\r\n\r\n\r\n\r\n✓  Complete\r\n\r\n\r\n";

const parsers = [
  ["deploy", () => new DeployParser()],
  ["diff", () => new DiffParser()],
  ["remove", () => new RemoveParser()],
] as const;

describe("Fields shared by every parser", () => {
  it.each(parsers)(
    "leaves a missing permalink absent rather than empty, for %s",
    (_operation, build) => {
      const result = build().parse(WITHOUT_PERMALINK, "staging", 0, false);

      // Absent, not "". `permalink` is optional on the result and the output
      // layer defaults it to "", so inventing one here states a fact the
      // capture did not contain.
      expect(result.permalink).toBeUndefined();
      expect(Object.hasOwn(result, "permalink")).toBe(false);
    }
  );

  it.each(parsers)(
    "reports the permalink when the capture carries one, for %s",
    (_operation, build) => {
      const withPermalink = WITHOUT_PERMALINK.replace(
        "✓  Complete",
        "↗  Permalink   https://sst.dev/u/1a3e112e\n\n✓  Complete"
      );

      const result = build().parse(withPermalink, "staging", 0, false);

      expect(result.permalink).toBe("https://sst.dev/u/1a3e112e");
    }
  );

  it.each(parsers)(
    "normalises the capture before parsing it, for %s",
    (_operation, build) => {
      const result = build().parse(NEEDS_CLEANING, "staging", 0, false);

      // Deploy used to skip this, so a CRLF capture reached its patterns with
      // the carriage returns still attached.
      expect(result.rawOutput).not.toContain("\r");
      expect(result.rawOutput).not.toMatch(/\n{3,}/);
      expect(result.rawOutput.endsWith("\n")).toBe(false);

      // Cleaning must not cost the fields read out of the header.
      expect(result.app).toBe("my-app");
    }
  );

  it.each(parsers)(
    "treats a non-zero exit code as failure regardless of the text, for %s",
    (_operation, build) => {
      const result = build().parse(WITHOUT_PERMALINK, "staging", 1, false);

      expect(result.success).toBe(false);
    }
  );
});
