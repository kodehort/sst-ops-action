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
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
    // Deterministic build settings
    generatedCode: {
      constBindings: true,
      objectShorthand: true,
    },
    // Ensure consistent output across platforms
    interop: 'default',
    systemNullSetters: false,
    // Additional deterministic output settings
    indent: '  ', // Fixed indentation
    validate: true,
    strict: false, // Avoid 'use strict' differences
  },
  // Fixed tree-shaking behavior
  treeshake: {
    preset: 'recommended',
    moduleSideEffects: false,
  },
  plugins: [
    json(),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      // Deterministic module resolution
      browser: false,
      resolveOnly: [/^(?!node:)/], // Only resolve non-node built-ins
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
        // Deterministic mangling
        toplevel: false,
      },
      compress: {
        keep_fnames: true,
        passes: 1,
        pure_getters: true,
        unsafe_comps: false,
        unsafe_math: false,
        unsafe_proto: false,
        sequences: false,
        // Additional deterministic compression settings
        drop_console: false,
        drop_debugger: false,
        toplevel: false,
      },
      format: {
        comments: false,
        beautify: false,
        // Ensure consistent formatting
        semicolons: true,
        wrap_iife: true,
      },
      sourceMap: true,
      // Deterministic output
      keep_fnames: true,
      keep_classnames: true,
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
