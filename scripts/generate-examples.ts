#!/usr/bin/env bun
/**
 * Generate and test example outputs for documentation and validation
 *
 * Usage:
 *   bun run scripts/generate-examples.ts                    # Generate all examples
 *   bun run scripts/generate-examples.ts --operation diff   # Generate only diff examples
 *   bun run scripts/generate-examples.ts --validate        # Validate parsing against real outputs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OperationFormatter } from '../src/github/formatters.js';
import { DiffParser } from '../src/parsers/diff-parser.js';
import type { DiffResult } from '../src/types/operations.js';

const formatter = new OperationFormatter();
const diffParser = new DiffParser();

// Command line argument parsing
const args = process.argv.slice(2);
const operation = args.includes('--operation')
  ? args[args.indexOf('--operation') + 1]
  : 'all';
const validate = args.includes('--validate');

// Create directories if they don't exist
const ensureDir = (dir: string) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

/**
 * Parse real SST output from INPUT.md and create examples
 */
function parseRealOutputs() {
  console.log('📖 Reading real outputs from INPUT.md...\n');

  const inputFile = join(process.cwd(), 'INPUT.md');
  if (!existsSync(inputFile)) {
    console.error('❌ INPUT.md not found');
    return [];
  }

  const content = readFileSync(inputFile, 'utf8');
  const outputs: Array<{ name: string; raw: string }> = [];

  // Extract code blocks from INPUT.md
  const codeBlockRegex = /```\n([\s\S]*?)\n```/g;
  let match;
  let outputIndex = 1;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const raw = match[1];
    if (raw.includes('SST') && raw.includes('App:')) {
      outputs.push({
        name: `real-output-${outputIndex}`,
        raw,
      });
      outputIndex++;
    }
  }

  console.log(`✅ Found ${outputs.length} real SST outputs\n`);
  return outputs;
}

/**
 * Create parsed results from real outputs
 */
function createParsedExamples() {
  const realOutputs = parseRealOutputs();
  const examples: Array<{ name: string; parsed: DiffResult; raw: string }> = [];

  for (const { name, raw } of realOutputs) {
    try {
      console.log(`🔄 Parsing ${name}...`);

      // Extract stage and app from the output
      const appMatch = raw.match(/➜\s+App:\s+(.+)/);
      const stageMatch = raw.match(/Stage:\s+(.+)/);

      const stage = stageMatch?.[1]?.trim() || 'unknown-stage';
      const app = appMatch?.[1]?.trim() || 'unknown-app';

      const parsed = diffParser.parse(raw, stage, 0);
      examples.push({ name, parsed, raw });

      console.log(`  ✅ ${parsed.plannedChanges} changes detected`);
      console.log(`  📍 App: ${parsed.app}, Stage: ${parsed.stage}`);
    } catch (error) {
      console.error(`  ❌ Failed to parse ${name}:`, error);
    }
  }

  console.log(`\n📊 Successfully parsed ${examples.length} examples\n`);
  return examples;
}

/**
 * Generate diff examples from real outputs
 */
function generateDiffExamples() {
  console.log('🎯 Generating diff examples from real outputs...\n');

  const examples = createParsedExamples();
  ensureDir('examples/outputs/diff');

  for (const { name, parsed, raw } of examples) {
    // Save raw output
    const rawFile = `examples/outputs/diff/${name}-raw.txt`;
    writeFileSync(rawFile, raw);

    // Generate and save formatted outputs
    const comment = formatter.formatOperationComment(parsed);
    const summary = formatter.formatOperationSummary(parsed);

    const commentFile = `examples/outputs/diff/${name}-comment.md`;
    const summaryFile = `examples/outputs/diff/${name}-summary.md`;

    writeFileSync(commentFile, comment);
    writeFileSync(summaryFile, summary);

    // Create metadata file
    const metadata = {
      name,
      app: parsed.app,
      stage: parsed.stage,
      plannedChanges: parsed.plannedChanges,
      changeSummary: parsed.changeSummary,
      success: parsed.success,
      changes: parsed.changes.map((c) => ({
        type: c.type,
        name: c.name,
        action: c.action,
      })),
      files: {
        raw: rawFile,
        comment: commentFile,
        summary: summaryFile,
      },
    };

    const metadataFile = `examples/outputs/diff/${name}-metadata.json`;
    writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

    console.log(`✅ Generated ${name}:`);
    console.log(`   📄 Raw: ${rawFile}`);
    console.log(`   💬 Comment: ${commentFile}`);
    console.log(`   📊 Summary: ${summaryFile}`);
    console.log(`   📋 Metadata: ${metadataFile}\n`);
  }
}

/**
 * Generate synthetic examples for testing
 */
function generateSyntheticExamples() {
  console.log('🧪 Generating synthetic test examples...\n');

  ensureDir('examples/outputs/diff');

  // Example 1: Complex diff with multiple changes
  const complexDiff: DiffResult = {
    success: true,
    operation: 'diff',
    stage: 'staging',
    app: 'complex-app',
    rawOutput: 'Complex diff with many changes',
    exitCode: 0,
    truncated: false,
    completionStatus: 'complete',
    plannedChanges: 8,
    changeSummary: '8 changes planned',
    permalink: 'https://console.sst.dev/complex-app/staging/diffs/complex123',
    changes: [
      { type: 'Function', name: 'AuthHandler', action: 'create' },
      { type: 'Function', name: 'UserProcessor', action: 'create' },
      { type: 'Api', name: 'GraphQLAPI', action: 'create' },
      { type: 'Aurora', name: 'UserDatabase', action: 'create' },
      { type: 'Function', name: 'EmailHandler', action: 'update' },
      { type: 'Api', name: 'RestAPI', action: 'update' },
      { type: 'StaticSite', name: 'LegacyWebsite', action: 'delete' },
      { type: 'Dynamo', name: 'OldUserTable', action: 'delete' },
    ],
  };

  // Example 2: Simple diff with no changes
  const noDiff: DiffResult = {
    success: true,
    operation: 'diff',
    stage: 'production',
    app: 'stable-app',
    rawOutput: 'No changes detected',
    exitCode: 0,
    truncated: false,
    completionStatus: 'complete',
    plannedChanges: 0,
    changeSummary: 'No changes',
    permalink:
      'https://console.sst.dev/stable-app/production/diffs/nochanges789',
    changes: [],
  };

  const examples = [
    { name: 'synthetic-complex', data: complexDiff },
    { name: 'synthetic-no-changes', data: noDiff },
  ];

  for (const { name, data } of examples) {
    const comment = formatter.formatOperationComment(data);
    const summary = formatter.formatOperationSummary(data);

    writeFileSync(`examples/outputs/diff/${name}-comment.md`, comment);
    writeFileSync(`examples/outputs/diff/${name}-summary.md`, summary);

    const metadata = {
      name,
      app: data.app,
      stage: data.stage,
      plannedChanges: data.plannedChanges,
      changeSummary: data.changeSummary,
      success: data.success,
      synthetic: true,
      files: {
        comment: `examples/outputs/diff/${name}-comment.md`,
        summary: `examples/outputs/diff/${name}-summary.md`,
      },
    };

    writeFileSync(
      `examples/outputs/diff/${name}-metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    console.log(`✅ Generated synthetic ${name}`);
  }

  console.log('');
}

/**
 * Validate parsing against real outputs
 */
function validateParsing() {
  console.log('🔍 Validating parser against real outputs...\n');

  const examples = createParsedExamples();
  let passed = 0;
  let failed = 0;

  for (const { name, parsed } of examples) {
    console.log(`📋 Validating ${name}:`);

    // Basic validation checks
    const checks = [
      {
        name: 'Has app name',
        pass: parsed.app && parsed.app !== 'unknown-app',
      },
      {
        name: 'Has stage name',
        pass: parsed.stage && parsed.stage !== 'unknown-stage',
      },
      {
        name: 'Change count matches',
        pass: parsed.plannedChanges === parsed.changes.length,
      },
      {
        name: 'Has valid changes',
        pass: parsed.changes.every((c) => c.type && c.name && c.action),
      },
      {
        name: 'Valid permalink format',
        pass: !parsed.permalink || parsed.permalink.startsWith('https://'),
      },
      {
        name: 'Consistent success status',
        pass: typeof parsed.success === 'boolean',
      },
    ];

    const failedChecks = checks.filter((c) => !c.pass);

    if (failedChecks.length === 0) {
      console.log('  ✅ All checks passed');
      passed++;
    } else {
      console.log('  ❌ Failed checks:');
      failedChecks.forEach((c) => console.log(`     - ${c.name}`));
      failed++;
    }

    console.log(
      `  📊 ${parsed.plannedChanges} changes: ${parsed.changeSummary}\n`
    );
  }

  console.log('📈 Validation Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total:  ${passed + failed}\n`);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 SST Operations Action - Example Generator\n');

  if (validate) {
    validateParsing();
    return;
  }

  if (operation === 'all' || operation === 'diff') {
    generateDiffExamples();
    generateSyntheticExamples();
  }

  console.log('🎉 Example generation complete!\n');
  console.log('📁 Generated files in examples/outputs/');
  console.log('💡 Use --validate to test parser accuracy against real outputs');
}

main();
