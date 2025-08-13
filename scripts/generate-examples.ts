#!/usr/bin/env bun
/**
 * Generate and test example outputs for documentation and validation
 *
 * Usage:
 *   bun run scripts/generate-examples.ts                    # Generate all examples
 *   bun run scripts/generate-examples.ts --operation diff   # Generate only diff examples
 *   bun run scripts/generate-examples.ts --validate        # Validate parsing against real outputs
 */

// @ts-nocheck

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OperationFormatter } from '../src/github/formatters.js';
import { DiffParser } from '../src/parsers/diff-parser.js';
import { DeployParser } from '../src/parsers/deploy-parser.js';
import type { DiffResult, DeployResult } from '../src/types/operations.js';

const formatter = new OperationFormatter();
const diffParser = new DiffParser();
const deployParser = new DeployParser();

// Top-level regex patterns for performance
const APP_REGEX = /➜\s+App:\s+(.+)/;
const STAGE_REGEX = /Stage:\s+(.+)/;

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
  const inputFile = join(process.cwd(), 'INPUT.md');
  if (!existsSync(inputFile)) {
    return [];
  }

  const content = readFileSync(inputFile, 'utf8');
  const outputs: Array<{ name: string; raw: string }> = [];

  // Extract code blocks from INPUT.md
  const codeBlockRegex = /```\n([\s\S]*?)\n```/g;
  let match: RegExpExecArray | null;
  let outputIndex = 1;

  match = codeBlockRegex.exec(content);
  while (match !== null) {
    const raw = match[1];
    if (raw.includes('SST') && raw.includes('App:')) {
      outputs.push({
        name: `real-output-${outputIndex}`,
        raw,
      });
      outputIndex++;
    }
    match = codeBlockRegex.exec(content);
  }
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
      // Extract stage and app from the output
      const appMatch = raw.match(APP_REGEX);
      const stageMatch = raw.match(STAGE_REGEX);

      const stage = stageMatch?.[1]?.trim() || 'unknown-stage';
      const _app = appMatch?.[1]?.trim() || 'unknown-app';

      const parsed = diffParser.parse(raw, stage, 0);
      examples.push({ name, parsed, raw });
    } catch (_error) {
      // Skip invalid outputs
    }
  }
  return examples;
}

/**
 * Generate diff examples from real outputs
 */
function generateDiffExamples() {
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
  }
}

/**
 * Generate deploy examples from existing raw outputs
 */
function generateDeployExamples() {
  ensureDir('examples/outputs/deploy');

  // Define deploy examples from existing files
  const deployOutputs = [
    {
      name: 'real-output-1',
      stage: 'production',
      app: 'e-commerce-api'
    },
    {
      name: 'real-output-2', 
      stage: 'staging',
      app: 'blog-platform'
    },
    {
      name: 'real-output-3',
      stage: 'development',
      app: 'fintech-app'
    }
  ];

  for (const { name, stage } of deployOutputs) {
    try {
      const rawFile = `examples/outputs/deploy/${name}-raw.txt`;
      const raw = readFileSync(rawFile, 'utf8');
      
      // Parse the deploy output (exit code 0 for success, 1 for errors)
      const exitCode = raw.includes('✗  Failed') ? 1 : 0;
      const parsed = deployParser.parse(raw, stage, exitCode);
      
      // Generate formatted outputs
      const comment = formatter.formatOperationComment(parsed);
      const summary = formatter.formatOperationSummary(parsed);
      
      // Save files
      const commentFile = `examples/outputs/deploy/${name}-comment.md`;
      const summaryFile = `examples/outputs/deploy/${name}-summary.md`;
      
      writeFileSync(commentFile, comment);
      writeFileSync(summaryFile, summary);
      
      // Create metadata
      const metadata = {
        name,
        app: parsed.app,
        stage: parsed.stage,
        resourceChanges: parsed.resourceChanges,
        success: parsed.success,
        completionStatus: parsed.completionStatus,
        permalink: parsed.permalink,
        resources: parsed.resources.map((r) => ({
          name: r.name,
          type: r.type,
          status: r.status,
          timing: r.timing
        })),
        urls: parsed.urls.map((u) => ({
          name: u.name,
          url: u.url,
          type: u.type
        })),
        files: {
          raw: rawFile,
          comment: commentFile,
          summary: summaryFile
        }
      };
      
      const metadataFile = `examples/outputs/deploy/${name}-metadata.json`;
      writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
      
      console.log(`✅ Generated deploy example ${name}`);
    } catch (error) {
      console.error(`❌ Failed to generate deploy example ${name}:`, error);
    }
  }
}

/**
 * Generate synthetic examples for testing
 */
function generateSyntheticExamples() {
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
  }
}

/**
 * Validate parsing against real outputs
 */
function validateParsing() {
  const examples = createParsedExamples();
  let passed = 0;
  let failed = 0;

  for (const { _name, parsed } of examples) {
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
      passed++;
    } else {
      // Increment failed count for validation failures
      failed++;
    }
  }

  // Return results for use if needed
  return { passed, failed, total: passed + failed };
}

/**
 * Main execution
 */
function main() {
  if (validate) {
    validateParsing();
    return;
  }

  if (operation === 'all' || operation === 'diff') {
    console.log('🔍 Generating diff examples...');
    generateDiffExamples();
    generateSyntheticExamples();
  }

  if (operation === 'all' || operation === 'deploy') {
    console.log('🚀 Generating deploy examples...');
    generateDeployExamples();
  }
}

main();
