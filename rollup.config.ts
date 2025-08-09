import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

// Plugin to generate build manifest
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

      // Create build manifest with only essential, deterministic fields
      const manifest = {
        bundleSize,
        bundleSizeMB,
        integrity,
      };

      // Write manifest to dist folder
      const manifestPath = 'dist/build-manifest.json';
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
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
    json(),
    typescript(),
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    generateBuildManifest(),
  ],
};
