import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

// Plugin to generate enhanced build manifest with useful details for changelog and releases
function generateBuildManifest() {
  return {
    name: 'generate-build-manifest',
    writeBundle(_options, bundle) {
      // Get main bundle file
      const bundleFile = bundle['index.js'];
      if (!bundleFile) {
        throw new Error('Main bundle file not found');
      }

      // Calculate bundle size
      const bundleCode = bundleFile.code;
      const bundleSize = Buffer.byteLength(bundleCode, 'utf8');
      const bundleSizeMB = (bundleSize / (1024 * 1024)).toFixed(2);

      // Generate integrity hash
      const hash = createHash('sha256');
      hash.update(bundleCode);
      const integrity = hash.digest('hex');

      // Read package.json for version info
      let packageInfo = { version: 'unknown' };
      try {
        const packageJson = readFileSync('package.json', 'utf8');
        packageInfo = JSON.parse(packageJson);
      } catch {
        packageInfo = { version: 'unknown' };
      }

      // Create enhanced build manifest with useful details for releases
      const manifest = {
        // Core bundle information
        bundleSize,
        bundleSizeMB,
        integrity,

        // Build metadata
        buildTimestamp: new Date().toISOString(),
        version: packageInfo.version || 'unknown',
        nodeVersion: process.version,

        // Build configuration
        sourcemap: true, // We always generate sourcemaps
        minified: false, // Currently not using terser/minification
        format: 'es',
        target: 'node20',

        // Environment information
        platform: process.platform,
        arch: process.arch,
      };

      // Write manifest to dist folder
      const manifestPath = 'dist/build-manifest.json';
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    },
  };
}

export default {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    typescript(),
    json(),
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    generateBuildManifest(),
  ],
};
