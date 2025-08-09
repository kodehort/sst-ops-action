import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
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
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    },
  };
}

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    json(),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
    }),
    terser({
      mangle: {
        keep_fnames: true,
        reserved: [],
      },
      compress: {
        keep_fnames: true,
        passes: 1,
        pure_getters: true,
        unsafe_comps: false,
        unsafe_math: false,
        unsafe_proto: false,
        sequences: false,
      },
      format: {
        comments: false,
        beautify: false,
      },
      sourceMap: true,
    }),
    generateBuildManifest(),
  ],
  external: [
    // Node.js built-ins with node: prefix for ES module compatibility
    'node:fs',
    'node:path',
    'node:os',
    'node:crypto',
    'node:events',
    'node:stream',
    'node:util',
    'node:buffer',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:url',
    'node:querystring',
    'node:timers',
    'node:assert',
    'node:zlib',
    // Keep @actions packages bundled for GitHub Actions compatibility
  ],
};
