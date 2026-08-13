/**
 * Tests for the enum normalisation the parsers apply to CLI-derived values.
 *
 * These fallbacks used to be covered two modules downstream, against the
 * router's copy. They live here now because this is where the raw CLI string
 * arrives.
 */

import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeDiffAction,
  normalizeRemoveStatus,
  normalizeResourceStatus,
} from "@/parsers/normalization";

describe("Enum normalisation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeResourceStatus", () => {
    it.each(["created", "updated", "deleted"] as const)(
      "passes %s through unchanged",
      (status) => {
        const warn = vi.spyOn(core, "warning").mockImplementation(() => {
          // silence
        });

        expect(normalizeResourceStatus(status)).toBe(status);
        expect(warn).not.toHaveBeenCalled();
      }
    );

    it("falls back to created and warns on an unknown status", () => {
      const warn = vi.spyOn(core, "warning").mockImplementation(() => {
        // silence
      });

      expect(
        normalizeResourceStatus("replaced", "MyBucket", "AWS::S3::Bucket")
      ).toBe("created");
      expect(warn).toHaveBeenCalledTimes(1);

      const message = warn.mock.calls[0]?.[0] as string;
      // The warning must still name the resource and its type for debugging.
      expect(message).toContain("resource: MyBucket");
      expect(message).toContain("type: AWS::S3::Bucket");
      expect(message).toContain("'replaced'");
      expect(message).toContain("Defaulting to: 'created'");
    });

    it("omits the context when neither name nor type is known", () => {
      const warn = vi.spyOn(core, "warning").mockImplementation(() => {
        // silence
      });

      expect(normalizeResourceStatus("replaced")).toBe("created");
      expect(warn.mock.calls[0]?.[0]).not.toContain("resource:");
    });
  });

  describe("normalizeDiffAction", () => {
    it.each(["create", "update", "delete"] as const)(
      "passes %s through unchanged",
      (action) => {
        expect(normalizeDiffAction(action)).toBe(action);
      }
    );

    it("falls back to update and warns on an unknown action", () => {
      const warn = vi.spyOn(core, "warning").mockImplementation(() => {
        // silence
      });

      expect(normalizeDiffAction("replace", "Api", "sst:aws:Function")).toBe(
        "update"
      );

      const message = warn.mock.calls[0]?.[0] as string;
      expect(message).toContain("resource: Api");
      expect(message).toContain("type: sst:aws:Function");
      expect(message).toContain("Defaulting to: 'update'");
    });
  });

  describe("normalizeRemoveStatus", () => {
    it.each(["removed", "failed", "skipped"] as const)(
      "passes %s through unchanged",
      (status) => {
        expect(normalizeRemoveStatus(status)).toBe(status);
      }
    );

    it("keeps the conservative failed default for removals", () => {
      const warn = vi.spyOn(core, "warning").mockImplementation(() => {
        // silence
      });

      expect(
        normalizeRemoveStatus("orphaned", "Database", "sst:aws:Dynamo")
      ).toBe("failed");

      const message = warn.mock.calls[0]?.[0] as string;
      expect(message).toContain("resource: Database");
      expect(message).toContain("type: sst:aws:Dynamo");
      expect(message).toContain("conservative default for removals");
    });
  });
});
