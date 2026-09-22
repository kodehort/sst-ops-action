/**
 * Provider cache warm-up.
 *
 * On a clean runner the first SST command has to bootstrap the app before it
 * can do any work: generate `.sst/platform`, fetch the vendored `pulumi` and
 * `bun` binaries, and download every provider plugin the app config declares.
 * Every command pays this — `deploy`, `diff`, `remove`, and `sst state list`
 * too — and it repeats on every run.
 *
 * What gets installed is decided by exactly two things: the SST version, and
 * the providers declared in `sst.config.ts`. So those two are the cache key,
 * and `sst install` is the command that materialises the result at a point
 * where it can be saved, rather than as a side effect of a deploy.
 *
 * Every path through this module fails open. A cache that cannot be restored,
 * a version that cannot be resolved, an install that exits non-zero — none of
 * them are reasons to fail somebody's deployment, because SST will bootstrap
 * itself anyway. The cost of being wrong here is a slow run, not a broken one.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import type { InfrastructureInputs } from "../inputs/resolve";
import type { SSTCLIExecutor } from "../utils/cli";

/**
 * Bumping this invalidates every cache entry at once.
 *
 * Needed when what we store changes shape — a new path, or a different layout
 * — since the key would otherwise still match an entry restored into the wrong
 * places.
 */
const CACHE_SCHEME = "sst-providers-v1";

/** Lockfiles, in the order they are tried when SST is not in `node_modules`. */
const LOCKFILES = [
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
] as const;

/**
 * Reads a file as bytes.
 *
 * Injected because there are genuinely two adapters: the real filesystem, and
 * a fixture in tests. `node:fs` is globally mocked in the test setup, which
 * makes a partial mock of it a worse seam than an explicit parameter.
 *
 * @returns The file's contents, or null when it cannot be read for any reason
 */
export type ReadFile = (path: string) => Buffer | null;

const readFileOrNull: ReadFile = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

/**
 * Restore the provider cache, warm it on a miss, and save the result.
 *
 * @returns Nothing. Never throws — see the module docblock.
 */
export async function warmProviderCache({
  executor,
  inputs,
  readFile = readFileOrNull,
}: {
  executor: SSTCLIExecutor;
  inputs: InfrastructureInputs;
  readFile?: ReadFile;
}): Promise<void> {
  if (!inputs.cacheProviders) {
    return;
  }

  try {
    await warm({ executor, inputs, readFile });
  } catch (error) {
    // The belt to the braces below. Each step already handles its own
    // failures; this catches anything unforeseen so a caching problem can
    // never reach the router and be reported as a failed deployment.
    core.warning(`Provider cache skipped: ${describe(error)}`);
  }
}

async function warm({
  executor,
  inputs,
  readFile,
}: {
  executor: SSTCLIExecutor;
  inputs: InfrastructureInputs;
  readFile: ReadFile;
}): Promise<void> {
  // False on self-hosted runners without the cache service and under local
  // runners like `act`, where the credentials simply are not there. That is an
  // ordinary environment rather than a fault, so it is not a warning.
  if (!cache.isFeatureAvailable()) {
    core.info(
      "ℹ️ The Actions cache service is unavailable here; skipping the SST provider cache"
    );
    return;
  }

  const key = buildCacheKey({ inputs, readFile });
  if (!key) {
    return;
  }

  const paths = cachePaths(inputs.workingDirectory);
  const matched = await restore(paths, key);

  if (matched === key.primary) {
    core.info(`✅ SST providers restored from cache (${matched})`);
    return;
  }

  core.info(
    matched
      ? `♻️ Partial cache hit (${matched}); reconciling providers with \`sst install\``
      : "❄️ No provider cache for this key; running `sst install`"
  );

  const installed = await install(executor, inputs);
  if (!installed) {
    return;
  }

  await save(paths, key.primary);
}

/**
 * The three places SST puts the things worth keeping between runs.
 *
 * The plugins directory is the bulk of it; the binaries are native, which is
 * why the key carries the runner's OS and architecture.
 */
function cachePaths(workingDirectory: string): string[] {
  const sstHome = join(homedir(), ".config", "sst");

  return [
    join(workingDirectory, ".sst", "platform"),
    join(sstHome, "plugins"),
    join(sstHome, "bin"),
  ];
}

interface CacheKey {
  /** The exact key this run would save under. */
  primary: string;
  /** Prefixes accepted on restore, most specific first. */
  restore: string[];
}

/**
 * @returns The key, or null when it cannot be built — in which case the reason
 *   has already been reported and caching should be skipped
 */
function buildCacheKey({
  inputs,
  readFile,
}: {
  inputs: InfrastructureInputs;
  readFile: ReadFile;
}): CacheKey | null {
  const config = readFile(join(inputs.workingDirectory, "sst.config.ts"));
  if (!config) {
    core.warning(
      `No sst.config.ts in "${inputs.workingDirectory}"; skipping the provider cache. Set \`working-directory\` if the SST app lives elsewhere.`
    );
    return null;
  }

  const version = resolveSstVersion({ inputs, readFile });
  if (!version) {
    core.warning(
      "Could not determine the installed SST version; skipping the provider cache. Install dependencies before this step."
    );
    return null;
  }

  // Architecture as well as OS: `~/.config/sst/bin` holds native binaries, and
  // ARM runners are no longer unusual.
  const platform = `${process.env.RUNNER_OS ?? process.platform}-${process.env.RUNNER_ARCH ?? process.arch}`;
  // Scoped by directory so two apps in one monorepo cannot share an entry even
  // if their configs happen to be byte-identical.
  const scope = digest(inputs.workingDirectory, 8);
  const prefix = `${CACHE_SCHEME}-${platform}-${scope}-${version}-`;

  return {
    primary: `${prefix}${digest(config, 16)}`,
    // Falling back to the version prefix reuses the plugin downloads — the
    // expensive part, and pinned by the SST version — when only the app config
    // changed. `sst install` then reconciles whatever the providers list gained
    // or lost, and the result saves under the exact key.
    restore: [prefix],
  };
}

/**
 * The SST version that decides which providers get installed.
 *
 * Read from `node_modules`, because that is the version that will actually
 * run — a lockfile says what should be installed, which is not the same claim,
 * and parsing four lockfile formats to find out is a lot of surface for a
 * weaker answer.
 *
 * @returns A version string, a lockfile-derived stand-in, or null
 */
function resolveSstVersion({
  inputs,
  readFile,
}: {
  inputs: InfrastructureInputs;
  readFile: ReadFile;
}): string | null {
  const manifest = readFile(
    join(inputs.workingDirectory, "node_modules", "sst", "package.json")
  );

  if (manifest) {
    const version = parseVersion(manifest);
    if (version) {
      return version;
    }
  }

  // SST is not a local dependency, which is the normal shape for
  // `runner: sst` against a globally installed binary. The lockfile still
  // pins the rest of the dependency graph, so its hash is a serviceable
  // stand-in: too eager to invalidate, never wrong.
  for (const lockfile of LOCKFILES) {
    const contents = readFile(join(inputs.workingDirectory, lockfile));
    if (contents) {
      return `lock-${digest(contents, 8)}`;
    }
  }

  return null;
}

/** @returns The `version` field, or null if the manifest is unreadable */
function parseVersion(manifest: Buffer): string | null {
  try {
    const { version } = JSON.parse(manifest.toString()) as {
      version?: unknown;
    };
    return typeof version === "string" && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

/** @returns The matched key, or undefined on a miss or any failure */
async function restore(
  paths: string[],
  key: CacheKey
): Promise<string | undefined> {
  try {
    return await cache.restoreCache(paths, key.primary, key.restore);
  } catch (error) {
    core.warning(
      `Could not restore the SST provider cache: ${describe(error)}`
    );
    return undefined;
  }
}

/** @returns Whether the install succeeded and its result is worth saving */
async function install(
  executor: SSTCLIExecutor,
  inputs: InfrastructureInputs
): Promise<boolean> {
  const result = await executor.installProviders({
    cwd: inputs.workingDirectory,
    maxOutputSize: inputs.maxOutputSize,
    runner: inputs.runner,
  });

  if (result.exitCode !== 0) {
    // A half-installed provider set is worse than none: cached, it would be
    // restored on every later run and keep them all broken.
    core.warning(
      `\`sst install\` exited with code ${result.exitCode}; not caching. The operation will bootstrap SST itself.`
    );
    return false;
  }

  return true;
}

async function save(paths: string[], key: string): Promise<void> {
  try {
    await cache.saveCache(paths, key);
    core.info(`💾 SST providers cached (${key})`);
  } catch (error) {
    // A concurrent job reserving the same key first is the cache working, not
    // failing: its entry is the one everyone wants.
    if (error instanceof cache.ReserveCacheError) {
      core.info(`ℹ️ Another job is already caching this key (${key})`);
      return;
    }
    core.warning(`Could not save the SST provider cache: ${describe(error)}`);
  }
}

/** Hex digest of `value`, truncated to `length` characters. */
function digest(value: Buffer | string, length: number): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
