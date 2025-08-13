#!/usr/bin/env bun
/**
 * Generate snapshots for SST operations from input files
 *
 * Usage:
 *   bun run scripts/generate-snapshots.ts                         # Generate all snapshots
 *   bun run scripts/generate-snapshots.ts --operation diff        # Generate only diff snapshots
 *   bun run scripts/generate-snapshots.ts --name complex-changes  # Generate specific snapshot
 *   bun run scripts/generate-snapshots.ts --validate             # Validate all snapshots
 *   bun run scripts/generate-snapshots.ts --force                # Force regeneration
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateSnapshots,
  getExamplesRoot,
  listSnapshots,
  loadInput,
  snapshotExists,
  validateSnapshot,
} from '../__tests__/utils/snapshot-helpers.js';
import { DeployParser } from '../src/parsers/deploy-parser.js';
import { DiffParser } from '../src/parsers/diff-parser.js';
import { RemoveParser } from '../src/parsers/remove-parser.js';
import type { OperationResult, SSTOperation } from '../src/types/operations.js';

// Parser instances
const parsers = {
  diff: new DiffParser(),
  deploy: new DeployParser(),
  remove: new RemoveParser(),
};

// Top-level regex patterns for extracting metadata
const APP_REGEX = /➜\s+App:\s+(.+)/;
const STAGE_REGEX = /Stage:\s+(.+)/;

// Command line argument parsing
const args = process.argv.slice(2);
const operation = args.includes('--operation')
  ? (args[args.indexOf('--operation') + 1] as SSTOperation)
  : null;
const name = args.includes('--name') ? args[args.indexOf('--name') + 1] : null;
const validate = args.includes('--validate');
const force = args.includes('--force');

/**
 * Colors for console output
 */
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

/**
 * Log with color
 */
function log(message: string, color: string = colors.reset): void {
  // biome-ignore lint/suspicious/noConsole: This is a CLI script that needs console output
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Parse SST output and create operation result
 */
function parseOutput(
  targetOperation: SSTOperation,
  rawOutput: string
): OperationResult | null {
  try {
    // Extract stage and app from the output
    const appMatch = rawOutput.match(APP_REGEX);
    const stageMatch = rawOutput.match(STAGE_REGEX);

    const stage = stageMatch?.[1]?.trim() || 'unknown-stage';
    const _app = appMatch?.[1]?.trim() || 'unknown-app';

    // Determine exit code based on success indicators
    let exitCode = 0;
    if (rawOutput.includes('✕  Failed') || rawOutput.includes('Error:')) {
      exitCode = 1;
    }

    // Parse with appropriate parser
    const parser = parsers[targetOperation as keyof typeof parsers];
    if (!parser) {
      throw new Error(`No parser available for operation: ${targetOperation}`);
    }

    return parser.parse(rawOutput, stage, exitCode);
  } catch (error) {
    log(`Error parsing ${targetOperation} output: ${error}`, colors.red);
    return null;
  }
}

/**
 * Generate snapshot for a specific input
 */
function generateSnapshot(
  targetOperation: SSTOperation,
  snapshotName: string,
  forceRegenerate = false
): boolean {
  try {
    // Check if snapshot already exists and force is not set
    if (!forceRegenerate && snapshotExists(targetOperation, snapshotName)) {
      log(
        `⏭️  Snapshot already exists for ${targetOperation}/${snapshotName} (use --force to regenerate)`,
        colors.yellow
      );
      return true;
    }

    log(
      `📝 Generating snapshot for ${targetOperation}/${snapshotName}...`,
      colors.blue
    );

    // Load input
    const rawOutput = loadInput(targetOperation, snapshotName);

    // Parse output
    const parsed = parseOutput(targetOperation, rawOutput);
    if (!parsed) {
      log(`❌ Failed to parse ${targetOperation}/${snapshotName}`, colors.red);
      return false;
    }

    // Generate snapshots
    generateSnapshots(
      targetOperation,
      snapshotName,
      parsed,
      `Generated from ${snapshotName}.txt`
    );

    log(
      `✅ Generated snapshot for ${targetOperation}/${snapshotName}`,
      colors.green
    );
    return true;
  } catch (error) {
    log(
      `❌ Error generating snapshot for ${targetOperation}/${snapshotName}: ${error}`,
      colors.red
    );
    return false;
  }
}

/**
 * Generate all snapshots for an operation
 */
function generateOperationSnapshots(targetOperation: SSTOperation): void {
  log(
    `\n${colors.bold}🔧 Generating ${targetOperation} snapshots${colors.reset}`,
    colors.blue
  );

  const snapshots = listSnapshots(targetOperation);
  if (snapshots.length === 0) {
    log(`No input files found for ${targetOperation}`, colors.yellow);
    return;
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const snapshotName of snapshots) {
    const result = generateSnapshot(targetOperation, snapshotName, force);
    if (result) {
      if (force || !snapshotExists(targetOperation, snapshotName)) {
        generated++;
      } else {
        skipped++;
      }
    } else {
      failed++;
    }
  }

  log(`\n📊 ${targetOperation} Summary:`);
  log(`   ✅ Generated: ${generated}`, colors.green);
  log(`   ⏭️  Skipped: ${skipped}`, colors.yellow);
  log(`   ❌ Failed: ${failed}`, colors.red);
}

/**
 * Validate all snapshots
 */
function validateSnapshots(): void {
  log(`\n${colors.bold}🔍 Validating snapshots${colors.reset}`, colors.blue);

  const operations: SSTOperation[] = ['diff', 'deploy', 'remove'];
  let totalValid = 0;
  let totalInvalid = 0;

  for (const op of operations) {
    const snapshots = listSnapshots(op);
    if (snapshots.length === 0) {
      continue;
    }

    log(`\n📋 Validating ${op} snapshots:`);

    for (const snapshotName of snapshots) {
      const validation = validateSnapshot(op, snapshotName);
      if (validation.valid) {
        log(`   ✅ ${snapshotName}`, colors.green);
        totalValid++;
      } else {
        log(`   ❌ ${snapshotName}:`, colors.red);
        for (const error of validation.errors) {
          log(`      • ${error}`, colors.red);
        }
        totalInvalid++;
      }
    }
  }

  log('\n📊 Validation Summary:');
  log(`   ✅ Valid: ${totalValid}`, colors.green);
  log(`   ❌ Invalid: ${totalInvalid}`, colors.red);

  if (totalInvalid > 0) {
    process.exit(1);
  }
}

/**
 * Display available snapshots
 */
function listAvailableSnapshots(): void {
  log(`\n${colors.bold}📋 Available snapshots${colors.reset}`, colors.blue);

  const operations: SSTOperation[] = ['diff', 'deploy', 'remove'];

  for (const op of operations) {
    const snapshots = listSnapshots(op);
    if (snapshots.length > 0) {
      log(`\n${op}:`);
      for (const snapshotName of snapshots) {
        const exists = snapshotExists(op, snapshotName);
        const status = exists ? '✅' : '⚠️ ';
        log(`   ${status} ${snapshotName}`);
      }
    }
  }
}

/**
 * Ensure examples directory structure exists
 */
function ensureDirectoryStructure(): void {
  const examplesRoot = getExamplesRoot();
  const operations: SSTOperation[] = ['diff', 'deploy', 'remove'];

  for (const op of operations) {
    const inputDir = join(examplesRoot, 'inputs', op);
    const snapshotDir = join(examplesRoot, 'snapshots', op);
    const metadataDir = join(examplesRoot, 'metadata', op);

    if (!existsSync(inputDir)) {
      log(`📁 Input directory missing: ${inputDir}`, colors.yellow);
    }
    if (!existsSync(snapshotDir)) {
      log(`📁 Snapshot directory missing: ${snapshotDir}`, colors.yellow);
    }
    if (!existsSync(metadataDir)) {
      log(`📁 Metadata directory missing: ${metadataDir}`, colors.yellow);
    }
  }
}

/**
 * Main execution
 */
function main(): void {
  log(`${colors.bold}🎯 SST Snapshot Generator${colors.reset}`, colors.blue);

  // Ensure directory structure
  ensureDirectoryStructure();

  if (validate) {
    validateSnapshots();
    return;
  }

  if (name && operation) {
    // Generate specific snapshot
    generateSnapshot(operation, name, force);
  } else if (operation) {
    // Generate all snapshots for specific operation
    generateOperationSnapshots(operation);
  } else {
    // Generate all snapshots
    const operations: SSTOperation[] = ['diff', 'deploy', 'remove'];
    for (const op of operations) {
      generateOperationSnapshots(op);
    }
  }

  // Show available snapshots
  listAvailableSnapshots();

  log('\n✨ Snapshot generation complete!', colors.green);
}

main();
