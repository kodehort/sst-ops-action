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
 * the providers declared in `sst.config.ts`. So those two are the cache key.
 *
 * **Restoring and saving happen either side of the operation, and they must.**
 * `sst install` and the operation populate different directories:
 *
 * - `sst install` builds `.sst/platform` (the `@pulumi/*` npm SDKs) and fetches
 *   the vendored `pulumi` and `bun` binaries into `~/.config/sst/bin`.
 * - the operation — `deploy`, `diff`, `remove`, and the `sst state list`
 *   preflight — downloads the Pulumi *provider plugin binaries* into
 *   `~/.config/sst/plugins`. Those are the `Downloaded provider ...` lines.
 *
 * How much that second half is worth is an open question, not an assumption.
 * Measured on one real app (12 providers, Blacksmith runner): the phase costs
 * ~7.3s, while restoring the 202MB the v1 entry did hold costs ~4.3s at
 * ~47MB/s. Adding the plugins to every restore therefore only pays for itself
 * while they compress to roughly 350MB or less. The timings this module logs
 * exist so that stays a measurement rather than a belief.
 *
 * v1 of this module saved immediately after `sst install`, when
 * `~/.config/sst/plugins` did not yet exist. `saveCache` skips a missing path
 * with a warning rather than failing, so every entry it wrote was missing the
 * one artifact worth caching, and every deploy re-downloaded all of them. The
 * save now runs after the operation, and `pluginsPopulated` refuses to write an
 * entry that would repeat the mistake.
 *
 * Every path through this module fails open. A cache that cannot be restored,
 * a version that cannot be resolved, an install that exits non-zero — none of
 * them are reasons to fail somebody's deployment, because SST will bootstrap
 * itself anyway. The cost of being wrong here is a slow run, not a broken one.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
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
 *
 * v1 -> v2 is exactly that case, and the bump is load-bearing rather than
 * tidiness. Actions cache entries are immutable: an existing key cannot be
 * overwritten. Every v1 key names an entry saved before the operation ran, so
 * it has no `~/.config/sst/plugins`. Left on v1, the corrected code would
 * restore such an entry, see an exact hit, return early and never save a
 * complete one — the bug would outlive its own fix, for every key already in
 * use.
 */
const CACHE_SCHEME = "sst-providers-v2";

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
 * Whether a directory exists and holds at least one entry.
 *
 * Injected for the same reason as {@link ReadFile}.
 */
export type DirHasEntries = (path: string) => boolean;

const dirHasEntriesOrFalse: DirHasEntries = (path) => {
  try {
    return readdirSync(path).length > 0;
  } catch {
    return false;
  }
};

/**
 * What a completed restore leaves for the save to act on.
 *
 * Only produced when there is something worth writing: an exact hit needs no
 * save, and every giving-up path yields null instead.
 */
export interface ProviderCachePending {
  /** The exact key this run should save under. */
  key: string;
  /** The directories to write, in the order {@link cachePaths} returns them. */
  paths: string[];
  /** Where the plugins the operation downloads must appear before saving. */
  pluginsPath: string;
}

/**
 * Restore the provider cache and warm it on a miss.
 *
 * Call before the operation. The result goes to {@link saveProviderCache}
 * afterwards — the plugins worth caching do not exist until the operation has
 * run.
 *
 * @returns What to save once the operation succeeds, or null when there is
 *   nothing to save. Never throws — see the module docblock.
 */
export async function restoreProviderCache({
  executor,
  inputs,
  readFile = readFileOrNull,
}: {
  executor: SSTCLIExecutor;
  inputs: InfrastructureInputs;
  readFile?: ReadFile;
}): Promise<ProviderCachePending | null> {
  if (!inputs.cacheProviders) {
    return null;
  }

  try {
    return await restoreAndWarm({ executor, inputs, readFile });
  } catch (error) {
    // The belt to the braces below. Each step already handles its own
    // failures; this catches anything unforeseen so a caching problem can
    // never reach the router and be reported as a failed deployment.
    core.warning(`Provider cache skipped: ${describe(error)}`);
    return null;
  }
}

/**
 * Save what the operation downloaded.
 *
 * Call only after the operation succeeded: a half-downloaded provider set from
 * a failed deploy, cached, would be restored on every later run and keep them
 * all broken — the same reasoning that stops {@link install} caching a failed
 * install, with more force.
 *
 * @returns Nothing. Never throws — see the module docblock.
 */
export async function saveProviderCache(
  pending: ProviderCachePending | null,
  dirHasEntries: DirHasEntries = dirHasEntriesOrFalse
): Promise<void> {
  if (!pending) {
    return;
  }

  try {
    // The invariant v1 violated, now checked rather than assumed. `saveCache`
    // treats a missing path as a warning and writes the rest, so without this
    // an ordering regression would quietly resume shipping entries whose one
    // valuable directory is absent — and the exact-hit early return would make
    // each one permanent.
    if (!dirHasEntries(pending.pluginsPath)) {
      core.warning(
        `No provider plugins in ${pending.pluginsPath}; not caching, because an entry without them would be restored on every later run and save nothing.`
      );
      return;
    }

    const saveStarted = Date.now();
    await save(pending.paths, pending.key);
    core.info(`⏱️ Provider cache save took ${secondsSince(saveStarted)}`);
  } catch (error) {
    core.warning(`Provider cache not saved: ${describe(error)}`);
  }
}

async function restoreAndWarm({
  executor,
  inputs,
  readFile,
}: {
  executor: SSTCLIExecutor;
  inputs: InfrastructureInputs;
  readFile: ReadFile;
}): Promise<ProviderCachePending | null> {
  // False on self-hosted runners without the cache service and under local
  // runners like `act`, where the credentials simply are not there. That is an
  // ordinary environment rather than a fault, so it is not a warning.
  if (!cache.isFeatureAvailable()) {
    core.info(
      "ℹ️ The Actions cache service is unavailable here; skipping the SST provider cache"
    );
    return null;
  }

  const key = buildCacheKey({ inputs, readFile });
  if (!key) {
    return null;
  }

  const paths = cachePaths(inputs.workingDirectory);
  const pending: ProviderCachePending = {
    key: key.primary,
    paths,
    pluginsPath: pluginsPath(),
  };
  const restoreStarted = Date.now();
  const matched = await restore(paths, key);
  const restoreTook = secondsSince(restoreStarted);

  if (matched === key.primary) {
    // A v2 entry is only ever written after a successful operation, so an
    // exact hit already carries the plugins. Nothing to install, nothing to
    // save.
    core.info(
      `✅ SST providers restored from cache in ${restoreTook} (${matched})`
    );
    return null;
  }

  core.info(
    matched
      ? `♻️ Partial cache hit in ${restoreTook} (${matched}); reconciling providers with \`sst install\``
      : `❄️ No provider cache for this key (looked for ${restoreTook}); running \`sst install\``
  );

  const installed = await install(executor, inputs);
  if (!installed) {
    return null;
  }

  return pending;
}

/**
 * The three places SST puts the things worth keeping between runs.
 *
 * The binaries are native, which is why the key carries the runner's OS and
 * architecture.
 */
function cachePaths(workingDirectory: string): string[] {
  const sstHome = join(homedir(), ".config", "sst");

  return [
    join(workingDirectory, ".sst", "platform"),
    pluginsPath(),
    join(sstHome, "bin"),
  ];
}

/**
 * Where Pulumi puts the provider plugin binaries.
 *
 * `~/.config/sst/bin` follows Pulumi's `$PULUMI_HOME/bin` convention and the
 * `sst` binary carries a `PULUMI_HOME=` assignment, so `$PULUMI_HOME` is
 * `~/.config/sst` and plugins land beside that `bin`. One function rather than
 * a repeated `join`, so the path the guard probes cannot drift from the path
 * the cache writes.
 */
function pluginsPath(): string {
  return join(homedir(), ".config", "sst", "plugins");
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

  if (result.exitCode === 0) {
    core.info(
      `📦 \`sst install\` completed in ${(result.duration / 1000).toFixed(1)}s`
    );
  }

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
    core.info(`💾 SST providers and plugins cached (${key})`);
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

/**
 * Seconds elapsed since `started`, to one decimal place.
 *
 * Every cache message carries its own cost, because whether this feature is
 * worth enabling is an empirical question and the logs are the only place it
 * can be answered: a restore that takes longer than the work it skips is a
 * pessimisation, and without the numbers nobody can tell which they have.
 */
function secondsSince(started: number): string {
  return `${((Date.now() - started) / 1000).toFixed(1)}s`;
}

/** Hex digest of `value`, truncated to `length` characters. */
function digest(value: Buffer | string, length: number): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
