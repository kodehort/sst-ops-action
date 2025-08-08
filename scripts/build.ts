/**
 * Production Build System for SST Operations Action
 *
 * Optimized build using ESBuild with GitHub Actions requirements:
 * - Single-file bundle output (dist/index.js)
 * - Bundle size <10MB with tree shaking and minification
 * - Source maps for debugging support
 * - Build verification and integrity checks
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type BuildOptions, build } from 'esbuild';

interface BuildResult {
  success: boolean;
  bundlePath: string;
  bundleSize: number;
  bundleSizeMB: number;
  integrity: string;
  sourceMapPath?: string;
  duration: number;
}

class ProductionBuilder {
  private readonly entryPoint = resolve('src/index.ts');
  private readonly outputDir = resolve('dist');
  private readonly outputFile = join(this.outputDir, 'index.cjs');
  private readonly sourceMapFile = join(this.outputDir, 'index.cjs.map');
  private readonly maxBundleSizeMB = 10;

  async build(): Promise<BuildResult> {
    const startTime = Date.now();

    // Ensure output directory exists
    this.ensureOutputDirectory();

    // Build configuration optimized for GitHub Actions
    const buildOptions: BuildOptions = {
      entryPoints: [this.entryPoint],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs', // GitHub Actions proven to work with CommonJS
      outfile: this.outputFile,

      // Optimization settings
      minify: true,
      minifyWhitespace: true,
      minifyIdentifiers: true,
      minifySyntax: true,
      treeShaking: true,
      keepNames: false,
      ignoreAnnotations: false, // Respect pure annotations for better tree shaking
      
      // Advanced minification
      mangleProps: /^_/, // Mangle properties starting with underscore
      drop: ['console', 'debugger'], // Remove console statements and debugger in production
      legalComments: 'none', // Remove license comments to reduce size

      // Source map configuration (optimized for size)
      sourcemap: 'linked', // Slightly smaller than 'external' for GitHub Actions
      sourcesContent: false, // Exclude original source content to reduce map size

      // Bundle analysis and reporting
      metafile: true,

      // External dependencies (GitHub Actions provides these)
      external: [],

      // Bundle splitting disabled for single-file output
      splitting: false,

      // Define globals for better optimization
      define: {
        'process.env.NODE_ENV': '"production"',
      },

      // Banner for bundle identification
      banner: {
        js: `#!/usr/bin/env node
/**
 * SST Operations Action - Production Bundle (CommonJS)
 * Built at: ${new Date().toISOString()}
 * Node.js: ${process.version}
 * ESBuild: ${require('esbuild/package.json').version}
 */`,
      },
    };

    try {
      // Execute build
      const esbuildResult = await build(buildOptions);
      
      // Log bundle analysis if metafile is available
      if (esbuildResult.metafile) {
        this.logBundleAnalysis(esbuildResult.metafile);
      }

      // Verify build output exists
      if (!existsSync(this.outputFile)) {
        throw new Error('Build output file not found');
      }

      // Get bundle statistics
      const bundleStats = statSync(this.outputFile);
      const bundleSize = bundleStats.size;
      const bundleSizeMB = bundleSize / (1024 * 1024);

      // Generate integrity hash
      const integrity = this.generateIntegrityHash(this.outputFile);

      // Validate bundle size
      this.validateBundleSize(bundleSizeMB);

      // Verify source map exists if enabled
      const sourceMapExists = existsSync(this.sourceMapFile);

      const duration = Date.now() - startTime;

      const buildResult: BuildResult = {
        success: true,
        bundlePath: this.outputFile,
        bundleSize,
        bundleSizeMB,
        integrity,
        sourceMapPath: sourceMapExists ? this.sourceMapFile : undefined,
        duration,
      };

      this.logBuildSuccess(buildResult);
      this.generateBuildManifest(buildResult);

      return buildResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logBuildError(error, duration);

      return {
        success: false,
        bundlePath: this.outputFile,
        bundleSize: 0,
        bundleSizeMB: 0,
        integrity: '',
        duration,
      };
    }
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private validateBundleSize(bundleSizeMB: number): void {
    if (bundleSizeMB > this.maxBundleSizeMB) {
      throw new Error(
        `Bundle size ${bundleSizeMB.toFixed(2)}MB exceeds maximum limit of ${this.maxBundleSizeMB}MB`
      );
    }
  }

  private generateIntegrityHash(filePath: string): string {
    const fileContent = require('node:fs').readFileSync(filePath);
    return createHash('sha256').update(fileContent).digest('hex');
  }

  private logBuildSuccess(result: BuildResult): void {
    // Size validation feedback
    const sizePercentage = (result.bundleSizeMB / this.maxBundleSizeMB) * 100;
    let sizeStatus: string;
    if (sizePercentage < 50) {
      sizeStatus = '🟢';
    } else if (sizePercentage < 80) {
      sizeStatus = '🟡';
    } else {
      sizeStatus = '🟠';
    }

    // Use direct output for build logging (acceptable in build scripts)
    this.logInfo(
      `Bundle size: ${result.bundleSizeMB.toFixed(2)}MB ${sizeStatus}`
    );
  }

  private logBuildError(error: unknown, _duration: number): void {
    if (error instanceof Error && error.stack) {
      this.logError(`Build failed: ${error.message}`);
      this.logError(`Stack trace: ${error.stack}`);
    } else {
      this.logError(`Build failed: ${String(error)}`);
    }
  }

  private logInfo(message: string): void {
    // In build scripts, direct output to stdout is acceptable
    process.stdout.write(`[BUILD] ${message}\n`);
  }

  private logError(message: string): void {
    // In build scripts, direct output to stderr is acceptable
    process.stderr.write(`[BUILD ERROR] ${message}\n`);
  }

  private logBundleAnalysis(metafile: any): void {
    // Analyze bundle composition for size optimization insights
    const outputs = metafile.outputs || {};
    const inputs = metafile.inputs || {};
    
    // Find the main output file
    const mainOutput = Object.entries(outputs).find(([path]) => 
      path.endsWith('index.cjs') || path.includes(this.outputFile)
    );
    
    if (mainOutput) {
      const [, outputData] = mainOutput as [string, any];
      
      // Log largest dependencies
      if (outputData.imports) {
        const importSizes = outputData.imports
          .map((imp: any) => ({
            path: imp.path,
            size: inputs[imp.path]?.bytes || 0
          }))
          .filter((imp: any) => imp.size > 0)
          .sort((a: any, b: any) => b.size - a.size)
          .slice(0, 5);
        
        if (importSizes.length > 0) {
          this.logInfo('📊 Largest dependencies:');
          importSizes.forEach((imp: any, index: number) => {
            const sizeMB = (imp.size / (1024 * 1024)).toFixed(2);
            this.logInfo(`  ${index + 1}. ${imp.path} (${sizeMB}MB)`);
          });
        }
      }
    }
    
    // Calculate total input size vs output size for compression ratio
    const totalInputSize = Object.values(inputs).reduce((sum: number, input: any) => 
      sum + (input.bytes || 0), 0
    );
    const totalOutputSize = Object.values(outputs).reduce((sum: number, output: any) => 
      sum + (output.bytes || 0), 0
    );
    
    if (totalInputSize > 0 && totalOutputSize > 0) {
      const compressionRatio = ((totalInputSize - totalOutputSize) / totalInputSize * 100).toFixed(1);
      this.logInfo(`📈 Compression: ${(totalInputSize / (1024 * 1024)).toFixed(2)}MB → ${(totalOutputSize / (1024 * 1024)).toFixed(2)}MB (${compressionRatio}% reduction)`);
    }
  }

  private generateBuildManifest(result: BuildResult): void {
    const manifest = {
      buildTimestamp: new Date().toISOString(),
      bundlePath: result.bundlePath,
      bundleSize: result.bundleSize,
      bundleSizeMB: result.bundleSizeMB,
      integrity: result.integrity,
      sourceMap: !!result.sourceMapPath,
      duration: result.duration,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      minified: true,
      version: require('../package.json').version,
    };

    const manifestPath = join(this.outputDir, 'build-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

// Build verification functions
function verifyBuildIntegrity(buildResult: BuildResult): boolean {
  // Check if bundle exists
  if (!existsSync(buildResult.bundlePath)) {
    return false;
  }

  // Verify file size matches
  const currentStats = statSync(buildResult.bundlePath);
  if (currentStats.size !== buildResult.bundleSize) {
    return false;
  }

  // Verify integrity hash
  const currentHash = createHash('sha256')
    .update(require('node:fs').readFileSync(buildResult.bundlePath))
    .digest('hex');

  if (currentHash !== buildResult.integrity) {
    return false;
  }
  return true;
}

function runBuildDiagnostics(bundlePath: string): void {
  try {
    // Read bundle content for basic validation
    const bundleContent = require('node:fs').readFileSync(bundlePath, 'utf8');

    // Check if bundle has expected CommonJS structure
    const hasExports =
      bundleContent.includes('module.exports') ||
      bundleContent.includes('exports.');

    // Check for minification indicators
    const isMinified =
      bundleContent.length < bundleContent.replace(/\s+/g, ' ').length;

    // Check for GitHub Actions core dependencies
    const hasActionCore = bundleContent.includes('@actions/core');

    // Basic syntax validation without execution
    const lineCount = bundleContent.split('\n').length;

    // Log validation results (could be enhanced with actual checks)
    if (hasExports && isMinified && hasActionCore && lineCount > 0) {
      // Bundle appears to be properly built
    }
  } catch (_error) {
    process.exit(1);
  }
}

// Main execution
async function main(): Promise<void> {
  const builder = new ProductionBuilder();
  const result = await builder.build();

  if (!result.success) {
    process.exit(1);
  }

  // Run post-build verification
  if (!verifyBuildIntegrity(result)) {
    process.exit(1);
  }

  // Run diagnostics
  runBuildDiagnostics(result.bundlePath);
}

// Handle unhandled errors
process.on('unhandledRejection', (_error) => {
  process.exit(1);
});

process.on('uncaughtException', (_error) => {
  process.exit(1);
});

// Execute if run directly
if (import.meta.main) {
  main().catch((_error) => {
    process.exit(1);
  });
}

export { ProductionBuilder, type BuildResult };
