#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { $ } from 'bun';

const ROOT_DIR = resolve(import.meta.dir, '..');
const SRC_DIR = join(ROOT_DIR, 'src');
const DIST_DIR = join(ROOT_DIR, 'dist');
const MAIN_ENTRY = join(SRC_DIR, 'main.ts');
const MAIN_OUTPUT = join(DIST_DIR, 'main.js');

// Bundle size limit from PRD: <10MB
const MAX_BUNDLE_SIZE_MB = 10;
const MAX_BUNDLE_SIZE_BYTES = MAX_BUNDLE_SIZE_MB * 1024 * 1024;

interface BuildOptions {
  minify?: boolean;
  sourcemap?: boolean;
  target?: string;
  format?: 'esm' | 'cjs';
}

class BuildError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'BuildError';
  }
}

async function ensureDirectory(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function validateEntry(): Promise<void> {
  if (!existsSync(MAIN_ENTRY)) {
    throw new BuildError(
      `Entry file not found: ${MAIN_ENTRY}. Please create src/main.ts first.`,
      'MISSING_ENTRY'
    );
  }
}

async function buildBundle(options: BuildOptions = {}): Promise<void> {
  const {
    minify = true,
    sourcemap = true,
    target = 'node20',
    format = 'cjs',
  } = options;

  try {
    const result = await Bun.build({
      entrypoints: [MAIN_ENTRY],
      outdir: DIST_DIR,
      target: 'node',
      format,
      minify,
      sourcemap: sourcemap ? 'external' : false,
      // GitHub Actions requires CommonJS format and single file bundle
      splitting: false,
      // Bundle all dependencies to avoid runtime dependency issues
      external: [],
      // Optimize for GitHub Actions environment
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });

    if (!result.success) {
      const errors = result.logs
        .filter((log) => log.level === 'error')
        .map((log) => log.message)
        .join('\n');
      throw new BuildError(`Build failed:\n${errors}`, 'BUILD_FAILED');
    }

    // List output files
    for (const output of result.outputs) {
      const size = await stat(output.path).then((stats) => stats.size);
      const _sizeKB = (size / 1024).toFixed(2);
    }
  } catch (error) {
    if (error instanceof BuildError) {
      throw error;
    }
    throw new BuildError(
      `Unexpected build error: ${error instanceof Error ? error.message : String(error)}`,
      'UNEXPECTED_ERROR'
    );
  }
}

async function validateBundleSize(
  bundlePath: string = MAIN_OUTPUT
): Promise<void> {
  if (!existsSync(bundlePath)) {
    throw new BuildError(
      `Output bundle not found: ${bundlePath}`,
      'MISSING_BUNDLE'
    );
  }

  const stats = await stat(bundlePath);
  const bundleSizeBytes = stats.size;
  const bundleSizeMB = bundleSizeBytes / (1024 * 1024);

  if (bundleSizeBytes > MAX_BUNDLE_SIZE_BYTES) {
    throw new BuildError(
      `Bundle size ${bundleSizeMB.toFixed(2)} MB exceeds limit of ${MAX_BUNDLE_SIZE_MB} MB. ` +
        'Consider optimizing dependencies or using external modules.',
      'BUNDLE_TOO_LARGE'
    );
  }
}

async function validateBundle(bundlePath: string = MAIN_OUTPUT): Promise<void> {
  try {
    // Read and validate the bundle can be parsed
    const bundleContent = await readFile(bundlePath, 'utf-8');

    if (bundleContent.length === 0) {
      throw new BuildError('Bundle is empty', 'EMPTY_BUNDLE');
    }

    // Check for CommonJS exports (required for GitHub Actions)
    if (
      !(
        bundleContent.includes('module.exports') ||
        bundleContent.includes('exports.')
      )
    ) {
      console.warn('Bundle may not have proper CommonJS exports. GitHub Actions requires CommonJS format.');
    }

    // Test syntax by attempting to parse
    try {
      await $`node -c ${bundlePath}`.quiet();
    } catch (_syntaxError) {
      throw new BuildError(
        'Bundle has invalid JavaScript syntax',
        'INVALID_SYNTAX'
      );
    }

    await validateBundleSize(bundlePath);
  } catch (error) {
    if (error instanceof BuildError) {
      throw error;
    }
    throw new BuildError(
      `Bundle validation failed: ${error instanceof Error ? error.message : String(error)}`,
      'VALIDATION_FAILED'
    );
  }
}

async function generateBuildInfo(): Promise<void> {
  const buildInfo = {
    timestamp: new Date().toISOString(),
    target: 'node20',
    format: 'cjs',
    bundler: 'bun',
    version: process.env.npm_package_version || '1.0.0',
    commit: await $`git rev-parse --short HEAD`.text().catch(() => 'unknown'),
    size: await stat(MAIN_OUTPUT).then((stats) => stats.size),
  };

  const buildInfoPath = join(DIST_DIR, 'build-info.json');
  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2));
}

async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    // Preparation
    await ensureDirectory(DIST_DIR);
    await validateEntry();

    // Build
    await buildBundle({
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
      target: 'node20',
      format: 'cjs',
    });

    // Validation
    await validateBundle();

    // Metadata
    await generateBuildInfo();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Build completed successfully in ${duration}s`);
  } catch (error) {
    if (error instanceof BuildError) {
      console.error(`❌ Build failed: ${error.message}`);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
    } else {
      console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }

    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.main) {
  await main();
}

export { buildBundle, validateBundleSize, validateBundle, BuildError };
