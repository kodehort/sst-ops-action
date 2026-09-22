/**
 * Provider cache warm-up.
 *
 * Two seams are mocked: the Actions cache service, which only exists on a real
 * runner, and the CLI executor. The filesystem is a parameter rather than a
 * mock, so a test says what the working directory contains by listing it.
 *
 * The thing worth protecting here is that every failure is survivable. A cache
 * that cannot be restored, a version that cannot be resolved, an install that
 * exits non-zero — the operation still has to run. So most of these cases
 * assert on what did *not* happen.
 */

import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DirHasEntries,
  type ReadFile,
  restoreProviderCache,
  saveProviderCache,
} from "@/cache/providers";
import type { InfrastructureInputs } from "@/inputs/resolve";
import type { CLIResult, SSTCLIExecutor } from "@/utils/cli";
import { infrastructureInputs } from "../utils/resolved-inputs";

const mockedCache = vi.mocked(cache);
const mockedCore = vi.mocked(core);

/** Plugins present, as they are once an operation has actually run. */
const pluginsDownloaded: DirHasEntries = () => true;

/** Plugins absent, as they are straight after `sst install`. */
const noPlugins: DirHasEntries = () => false;

/**
 * Restore, then save as the router does once the operation has succeeded.
 *
 * The two halves exist because the plugins worth caching only appear while the
 * operation runs; `dirHasEntries` stands in for that having happened.
 */
async function warmAndSave(
  args: Parameters<typeof restoreProviderCache>[0],
  dirHasEntries: DirHasEntries = pluginsDownloaded
): Promise<void> {
  const pending = await restoreProviderCache(args);
  await saveProviderCache(pending, dirHasEntries);
}

const SST_CONFIG = 'export default { app: () => ({ name: "my-app" }) };';

/**
 * A working directory containing the given files, and nothing else.
 *
 * Keys are written relative to the repository root. The leading "./" that
 * `join(".", name)` produces is stripped so a test can spell the default
 * working directory's files as plain names.
 */
function directory(files: Record<string, string>): ReadFile {
  return (path: string) => {
    const key = path.replace(/^\.\//, "");
    return key in files ? Buffer.from(files[key] as string) : null;
  };
}

/** The layout of a normal SST app: a config and an installed SST. */
function normalApp(version = "3.17.10"): ReadFile {
  return directory({
    "node_modules/sst/package.json": JSON.stringify({ name: "sst", version }),
    "sst.config.ts": SST_CONFIG,
  });
}

function cliResult(exitCode: number): CLIResult {
  return {
    command: "bun sst install",
    duration: 10,
    exitCode,
    output: "",
    stderr: "",
    stdout: "",
    truncated: false,
  };
}

function executorWith(installExitCode = 0): {
  executor: SSTCLIExecutor;
  installProviders: ReturnType<typeof vi.fn>;
} {
  const installProviders = vi
    .fn()
    .mockResolvedValue(cliResult(installExitCode));
  return {
    executor: { installProviders } as unknown as SSTCLIExecutor,
    installProviders,
  };
}

function inputs(
  overrides: Partial<InfrastructureInputs> = {}
): InfrastructureInputs {
  return infrastructureInputs("deploy", {
    cacheProviders: true,
    ...overrides,
  });
}

/** The single key `restoreCache` was asked for. */
function restoredKey(): string {
  return mockedCache.restoreCache.mock.calls[0]?.[1] as string;
}

describe("warming the SST provider cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCache.isFeatureAvailable.mockReturnValue(true);
    mockedCache.restoreCache.mockResolvedValue(undefined);
    mockedCache.saveCache.mockResolvedValue(0);
    // Fixed so the key assertions below describe one platform, not whichever
    // machine happens to run the suite.
    vi.stubEnv("RUNNER_OS", "Linux");
    vi.stubEnv("RUNNER_ARCH", "X64");
  });

  describe("when it is switched off", () => {
    it("does nothing at all, which is the default", async () => {
      const { executor, installProviders } = executorWith();

      await warmAndSave({
        executor,
        inputs: infrastructureInputs("deploy"),
        readFile: normalApp(),
      });

      expect(mockedCache.isFeatureAvailable).not.toHaveBeenCalled();
      expect(mockedCache.restoreCache).not.toHaveBeenCalled();
      expect(installProviders).not.toHaveBeenCalled();
    });
  });

  describe("the cache key", () => {
    it("carries the runner platform, the SST version and the config hash", async () => {
      const { executor } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp("3.17.10"),
      });

      expect(restoredKey()).toMatch(
        /^sst-providers-v2-Linux-X64-[0-9a-f]{8}-3\.17\.10-[0-9a-f]{16}$/
      );
    });

    it("changes when sst.config.ts changes", async () => {
      const { executor } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });
      const before = restoredKey();

      vi.clearAllMocks();
      mockedCache.isFeatureAvailable.mockReturnValue(true);
      mockedCache.restoreCache.mockResolvedValue(undefined);
      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: directory({
          "node_modules/sst/package.json": JSON.stringify({
            version: "3.17.10",
          }),
          "sst.config.ts": `${SST_CONFIG}\n// added a provider`,
        }),
      });

      expect(restoredKey()).not.toBe(before);
    });

    it("changes when the SST version changes", async () => {
      const { executor } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp("3.17.10"),
      });
      const before = restoredKey();

      vi.clearAllMocks();
      mockedCache.isFeatureAvailable.mockReturnValue(true);
      mockedCache.restoreCache.mockResolvedValue(undefined);
      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp("3.18.0"),
      });

      expect(restoredKey()).not.toBe(before);
    });

    it("separates two apps in the same monorepo that share a config", async () => {
      const { executor } = executorWith();
      const shared = {
        "packages/api/node_modules/sst/package.json": '{"version":"3.17.10"}',
        "packages/api/sst.config.ts": SST_CONFIG,
        "packages/web/node_modules/sst/package.json": '{"version":"3.17.10"}',
        "packages/web/sst.config.ts": SST_CONFIG,
      };

      await warmAndSave({
        executor,
        inputs: inputs({ workingDirectory: "packages/api" }),
        readFile: directory(shared),
      });
      const api = restoredKey();

      vi.clearAllMocks();
      mockedCache.isFeatureAvailable.mockReturnValue(true);
      mockedCache.restoreCache.mockResolvedValue(undefined);
      await warmAndSave({
        executor,
        inputs: inputs({ workingDirectory: "packages/web" }),
        readFile: directory(shared),
      });

      expect(restoredKey()).not.toBe(api);
    });

    it("falls back to a lockfile hash when SST is not a local dependency", async () => {
      const { executor } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs({ runner: "sst" }),
        readFile: directory({
          "bun.lock": '{"lockfileVersion":1}',
          "sst.config.ts": SST_CONFIG,
        }),
      });

      expect(restoredKey()).toContain("-lock-");
    });
  });

  describe("restoring", () => {
    it("caches the platform directory and both SST home directories", async () => {
      const { executor } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs({ workingDirectory: "packages/infra" }),
        readFile: directory({
          "packages/infra/node_modules/sst/package.json":
            '{"version":"3.17.10"}',
          "packages/infra/sst.config.ts": SST_CONFIG,
        }),
      });

      const paths = mockedCache.restoreCache.mock.calls[0]?.[0] as string[];
      expect(paths[0]).toBe("packages/infra/.sst/platform");
      expect(paths[1]).toMatch(/\.config\/sst\/plugins$/);
      expect(paths[2]).toMatch(/\.config\/sst\/bin$/);
    });

    it("skips the install and the save on an exact hit", async () => {
      const { executor, installProviders } = executorWith();
      mockedCache.restoreCache.mockImplementation((_paths, key) =>
        Promise.resolve(key)
      );

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      expect(installProviders).not.toHaveBeenCalled();
      expect(mockedCache.saveCache).not.toHaveBeenCalled();
    });

    it("reconciles and re-saves under the exact key on a partial hit", async () => {
      const { executor, installProviders } = executorWith();
      mockedCache.restoreCache.mockResolvedValue(
        "sst-providers-v2-Linux-X64-deadbeef-3.17.10-anolderconfighash"
      );

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      expect(installProviders).toHaveBeenCalledTimes(1);
      expect(mockedCache.saveCache).toHaveBeenCalledWith(
        expect.any(Array),
        restoredKey()
      );
    });

    it("installs and saves on a complete miss", async () => {
      const { executor, installProviders } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs({ runner: "pnpm", workingDirectory: "apps/infra" }),
        readFile: directory({
          "apps/infra/node_modules/sst/package.json": '{"version":"3.17.10"}',
          "apps/infra/sst.config.ts": SST_CONFIG,
        }),
      });

      expect(installProviders).toHaveBeenCalledWith({
        cwd: "apps/infra",
        maxOutputSize: 50_000,
        runner: "pnpm",
      });
      expect(mockedCache.saveCache).toHaveBeenCalledTimes(1);
    });
  });

  describe("saving only what is worth restoring", () => {
    it("saves after the operation, once the plugins it downloads exist", async () => {
      const { executor } = executorWith();

      const pending = await restoreProviderCache({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      // Nothing is written by the restore half: `sst install` leaves
      // ~/.config/sst/plugins empty, and the operation has not run yet.
      expect(mockedCache.saveCache).not.toHaveBeenCalled();
      expect(pending).not.toBeNull();

      await saveProviderCache(pending, pluginsDownloaded);

      expect(mockedCache.saveCache).toHaveBeenCalledTimes(1);
    });

    it("refuses to cache an entry with no provider plugins", async () => {
      const { executor } = executorWith();

      // The v1 bug exactly: saved straight after `sst install`, when the one
      // directory worth caching does not exist yet. Such an entry would be
      // restored as an exact hit forever and save nothing.
      await warmAndSave(
        { executor, inputs: inputs(), readFile: normalApp() },
        noPlugins
      );

      expect(mockedCache.saveCache).not.toHaveBeenCalled();
      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("No provider plugins in")
      );
    });

    it("includes the plugins directory in the paths it caches", async () => {
      const { executor } = executorWith();

      await warmAndSave({ executor, inputs: inputs(), readFile: normalApp() });

      const paths = mockedCache.saveCache.mock.calls[0]?.[0] as string[];
      expect(paths.some((path) => path.endsWith("/.config/sst/plugins"))).toBe(
        true
      );
    });

    it("probes the same plugins directory it caches", async () => {
      const { executor } = executorWith();
      const probed: string[] = [];

      await warmAndSave(
        { executor, inputs: inputs(), readFile: normalApp() },
        (path) => {
          probed.push(path);
          return true;
        }
      );

      const paths = mockedCache.saveCache.mock.calls[0]?.[0] as string[];
      expect(paths).toContain(probed[0]);
    });

    it("probes the real filesystem when no directory reader is injected", async () => {
      const { executor } = executorWith();

      const pending = await restoreProviderCache({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      // No `dirHasEntries`: the production adapter runs, and a plugins
      // directory that does not exist on this machine must read as "nothing to
      // cache" rather than throw.
      await expect(saveProviderCache(pending)).resolves.toBeUndefined();

      expect(mockedCache.saveCache).not.toHaveBeenCalled();
      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("No provider plugins in")
      );
    });

    it("warns rather than throwing when the save itself fails", async () => {
      const { executor } = executorWith();
      mockedCache.saveCache.mockRejectedValue(new Error("disk full"));

      await expect(
        warmAndSave({ executor, inputs: inputs(), readFile: normalApp() })
      ).resolves.toBeUndefined();

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("Could not save")
      );
    });

    it("saves nothing at all on an exact hit", async () => {
      const { executor, installProviders } = executorWith();
      mockedCache.restoreCache.mockImplementation((_paths, key) =>
        Promise.resolve(key)
      );

      const pending = await restoreProviderCache({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      // A v2 entry is only ever written post-operation, so an exact hit
      // already carries the plugins.
      expect(pending).toBeNull();
      expect(installProviders).not.toHaveBeenCalled();

      await saveProviderCache(pending, pluginsDownloaded);
      expect(mockedCache.saveCache).not.toHaveBeenCalled();
    });
  });

  describe("reporting what it cost", () => {
    // Whether this feature is worth enabling is an empirical question: a
    // restore slower than the work it skips is a pessimisation. The logs are
    // the only place that can be answered, so the timings are behaviour.
    it("reports how long an exact-hit restore took", async () => {
      const { executor } = executorWith();
      mockedCache.restoreCache.mockImplementation((_paths, key) =>
        Promise.resolve(key)
      );

      await warmAndSave({ executor, inputs: inputs(), readFile: normalApp() });

      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringMatching(/restored from cache in \d+\.\d+s/)
      );
    });

    it("reports how long a miss spent looking, and what the install cost", async () => {
      const { executor } = executorWith();

      await warmAndSave({ executor, inputs: inputs(), readFile: normalApp() });

      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringMatching(/looked for \d+\.\d+s/)
      );
      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringMatching(/`sst install` completed in \d+\.\d+s/)
      );
    });

    it("reports how long the save took", async () => {
      const { executor } = executorWith();

      await warmAndSave({ executor, inputs: inputs(), readFile: normalApp() });

      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringMatching(/save took \d+\.\d+s/)
      );
    });
  });

  describe("failing open", () => {
    it("skips quietly where the cache service is unavailable", async () => {
      const { executor, installProviders } = executorWith();
      mockedCache.isFeatureAvailable.mockReturnValue(false);

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      expect(mockedCache.restoreCache).not.toHaveBeenCalled();
      expect(installProviders).not.toHaveBeenCalled();
      // An ordinary environment, not a fault.
      expect(mockedCore.warning).not.toHaveBeenCalled();
    });

    it("warns and skips when there is no sst.config.ts", async () => {
      const { executor, installProviders } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: directory({}),
      });

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("No sst.config.ts")
      );
      expect(mockedCache.restoreCache).not.toHaveBeenCalled();
      expect(installProviders).not.toHaveBeenCalled();
    });

    it("warns and skips when the SST version cannot be determined", async () => {
      const { executor, installProviders } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: directory({ "sst.config.ts": SST_CONFIG }),
      });

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("Could not determine the installed SST version")
      );
      expect(installProviders).not.toHaveBeenCalled();
    });

    it("falls through to the lockfile when the SST manifest is corrupt", async () => {
      const { executor } = executorWith();

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: directory({
          "node_modules/sst/package.json": "{ not json",
          "sst.config.ts": SST_CONFIG,
          "yarn.lock": "# yarn lockfile v1",
        }),
      });

      expect(restoredKey()).toContain("-lock-");
    });

    it("installs anyway when the restore itself fails", async () => {
      const { executor, installProviders } = executorWith();
      mockedCache.restoreCache.mockRejectedValue(new Error("503 from cache"));

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("Could not restore")
      );
      expect(installProviders).toHaveBeenCalledTimes(1);
    });

    it("does not cache a half-installed provider set", async () => {
      const { executor, installProviders } = executorWith(1);

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      expect(installProviders).toHaveBeenCalledTimes(1);
      expect(mockedCache.saveCache).not.toHaveBeenCalled();
      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("exited with code 1")
      );
    });

    it("treats a key another job already reserved as normal", async () => {
      const { executor } = executorWith();
      mockedCache.saveCache.mockRejectedValue(
        new cache.ReserveCacheError("already reserved")
      );

      await warmAndSave({
        executor,
        inputs: inputs(),
        readFile: normalApp(),
      });

      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringContaining("Another job is already caching")
      );
      expect(mockedCore.warning).not.toHaveBeenCalled();
    });

    it("warns but does not throw when the save fails outright", async () => {
      const { executor } = executorWith();
      mockedCache.saveCache.mockRejectedValue(new Error("disk full"));

      await expect(
        warmAndSave({
          executor,
          inputs: inputs(),
          readFile: normalApp(),
        })
      ).resolves.toBeUndefined();

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("Could not save")
      );
    });

    it("survives an unforeseen throw from anywhere in the warm-up", async () => {
      const { executor } = executorWith();
      mockedCache.isFeatureAvailable.mockImplementation(() => {
        throw new Error("toolkit blew up");
      });

      await expect(
        warmAndSave({
          executor,
          inputs: inputs(),
          readFile: normalApp(),
        })
      ).resolves.toBeUndefined();

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("toolkit blew up")
      );
    });

    it("reads the real filesystem when no reader is injected", async () => {
      const { executor, installProviders } = executorWith();

      // No `readFile`: this exercises the production adapter, whose whole job
      // is to answer "no" for an unreadable file instead of throwing.
      await expect(
        warmAndSave({
          executor,
          inputs: inputs({ workingDirectory: "no/such/directory" }),
        })
      ).resolves.toBeUndefined();

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("No sst.config.ts")
      );
      expect(installProviders).not.toHaveBeenCalled();
    });

    it("survives an install that throws rather than exiting non-zero", async () => {
      const installProviders = vi
        .fn()
        .mockRejectedValue(new Error("spawn sst ENOENT"));
      const executor = { installProviders } as unknown as SSTCLIExecutor;

      await expect(
        warmAndSave({
          executor,
          inputs: inputs(),
          readFile: normalApp(),
        })
      ).resolves.toBeUndefined();

      expect(mockedCache.saveCache).not.toHaveBeenCalled();
      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining("spawn sst ENOENT")
      );
    });
  });
});
