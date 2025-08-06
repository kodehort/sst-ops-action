import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs', // Force CommonJS format for compatibility
  outfile: 'dist/index.cjs', // Use .cjs extension to force CommonJS
  minify: true,
  sourcemap: false,
});
