import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

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
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
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
