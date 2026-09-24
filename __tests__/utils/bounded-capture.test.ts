/**
 * Over budget, the capture used to keep the first N bytes. SST prints the
 * error, the outputs block and the permalink last, so a noisy deploy lost the
 * very part that explained it. It now keeps a short head and a rolling tail.
 */

import { describe, expect, it } from "vitest";
import { DeployParser } from "@/parsers/deploy-parser";
import { BoundedCapture, TRUNCATION_MARKER } from "@/utils/bounded-capture";

const noise = (lines: number): string =>
  Array.from({ length: lines }, (_, i) => `|  Creating  Resource${i}\n`).join(
    ""
  );

describe("BoundedCapture", () => {
  it("returns everything untouched when it fits", () => {
    const capture = new BoundedCapture(1000);
    capture.push("first\n", "stdout");
    capture.push("second\n", "stderr");

    expect(capture.finish()).toEqual({
      output: "first\nsecond\n",
      stderr: "second\n",
      stdout: "first\n",
      truncated: false,
    });
  });

  it("keeps no cap at all for a budget of 0", () => {
    const capture = new BoundedCapture(0);
    capture.push(noise(20_000), "stdout");

    const result = capture.finish();

    expect(result.truncated).toBe(false);
    expect(result.output).toBe(noise(20_000));
  });

  it("keeps the end, not the start, when over budget", () => {
    const capture = new BoundedCapture(2000);
    capture.push("➜  App:  my-app\n   Stage: production\n", "stdout");
    capture.push(noise(1000), "stdout");
    capture.push("✕  Failed\n   Error: bucket already exists\n", "stderr");

    const result = capture.finish();

    expect(result.truncated).toBe(true);
    expect(result.output.length).toBeLessThanOrEqual(2000);
    expect(result.output.startsWith("➜  App:  my-app\n")).toBe(true);
    expect(result.output).toContain(TRUNCATION_MARKER);
    expect(result.output.endsWith("Error: bucket already exists\n")).toBe(true);
  });

  it("cuts on line boundaries either side of the marker", () => {
    const capture = new BoundedCapture(2000);
    capture.push(noise(1000), "stdout");

    const [head, tail] = capture.finish().output.split(TRUNCATION_MARKER);

    expect(head?.endsWith("\n")).toBe(true);
    for (const line of `${head}${tail}`.split("\n").filter(Boolean)) {
      expect(line).toMatch(/^\| {2}Creating {2}Resource\d+$/);
    }
  });

  it("stays within budget whatever the chunking", () => {
    const capture = new BoundedCapture(1500);
    for (const char of noise(500)) {
      capture.push(char, "stdout");
    }

    const result = capture.finish();

    expect(result.truncated).toBe(true);
    expect(result.output.length).toBeLessThanOrEqual(1500);
    expect(result.output.endsWith("Resource499\n")).toBe(true);
  });

  it("splits what it kept by stream, in the same order", () => {
    const capture = new BoundedCapture(2000);
    capture.push(noise(1000), "stdout");
    capture.push("stderr tail\n", "stderr");
    capture.push("stdout tail\n", "stdout");

    const result = capture.finish();

    expect(result.stderr).toBe("stderr tail\n");
    expect(result.stdout.endsWith("stdout tail\n")).toBe(true);
    expect(result.stdout.length + result.stderr.length).toBe(
      result.output.length - TRUNCATION_MARKER.length
    );
  });

  it("keeps only the tail when the budget cannot hold a marker", () => {
    const capture = new BoundedCapture(50);
    capture.push("x".repeat(100), "stdout");
    capture.push("y".repeat(10), "stdout");

    const result = capture.finish();

    expect(result.output).toBe(`${"x".repeat(40)}${"y".repeat(10)}`);
    expect(result.truncated).toBe(true);
  });

  it("still lets the parser read the header and the error", () => {
    const capture = new BoundedCapture(3000);
    capture.push(
      "SST 3.9.0  ready!\n\n➜  App:        my-app\n   Stage:      production\n\n~  Deploy\n\n",
      "stdout"
    );
    capture.push(noise(2000), "stdout");
    capture.push(
      "\n✕  Failed\n   Error: Resource 'MyBucket' does not exist\n",
      "stdout"
    );

    const { output, truncated } = capture.finish();
    const result = new DeployParser().parse(output, "production", 1, truncated);

    expect(result.app).toBe("my-app");
    expect(result.truncated).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toContain("MyBucket");
  });
});
