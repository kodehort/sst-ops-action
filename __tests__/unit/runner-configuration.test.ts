/**
 * Tests for configurable runner functionality
 */

import { describe, expect, it } from "vitest";
import type { InfrastructureInputs } from "../../src/inputs/resolve";
import {
  SST_RUNNERS,
  SSTCLIExecutor,
  type SSTRunner,
} from "../../src/utils/cli";

describe("Configurable Runner", () => {
  describe("CLI Command Building", () => {
    it("should build bun command correctly", async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<InfrastructureInputs> = {
        runner: "bun",
        stage: "test",
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand("deploy", "test", options);

      expect(result).toContain("bun");
      expect(result).toContain("sst");
      expect(result).toContain("deploy");
      expect(result).toContain("--stage");
      expect(result).toContain("test");
    });

    it("should build npm command correctly", async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<InfrastructureInputs> = {
        runner: "npm",
        stage: "test",
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand("deploy", "test", options);

      expect(result).toContain("npm");
      expect(result).toContain("run");
      expect(result).toContain("sst");
      expect(result).toContain("--");
      expect(result).toContain("deploy");
    });

    it("should build pnpm command correctly", async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<InfrastructureInputs> = {
        runner: "pnpm",
        stage: "test",
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand("deploy", "test", options);

      expect(result).toContain("pnpm");
      expect(result).toContain("sst");
      expect(result).toContain("deploy");
    });

    it("should build yarn command correctly", async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<InfrastructureInputs> = {
        runner: "yarn",
        stage: "test",
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand("deploy", "test", options);

      expect(result).toContain("yarn");
      expect(result).toContain("sst");
      expect(result).toContain("deploy");
    });

    it("should build direct SST command correctly", async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<InfrastructureInputs> = {
        runner: "sst",
        stage: "test",
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand("deploy", "test", options);

      expect(result[0]).toBe("sst");
      expect(result).toContain("deploy");
      expect(result).not.toContain("bun");
      expect(result).not.toContain("npm");
    });

    it("should default to bun when runner is not specified", async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<InfrastructureInputs> = {
        stage: "test",
        // runner not specified
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand("deploy", "test", options);

      expect(result).toContain("bun");
      expect(result).toContain("sst");
      expect(result).toContain("deploy");
    });
  });

  describe("Runner Validation", () => {
    it("should validate supported runners", () => {
      const supportedRunners = SST_RUNNERS;

      for (const runner of supportedRunners) {
        expect(SST_RUNNERS).toContain(runner);
      }
    });

    it("should throw error for unsupported runner", () => {
      const executor = new SSTCLIExecutor();
      const buildRunnerCommand = (executor as any).buildRunnerCommand.bind(
        executor
      );

      expect(() => {
        buildRunnerCommand("invalid-runner" as SSTRunner, "deploy");
      }).toThrow("Unsupported runner: invalid-runner");
    });
  });
});
