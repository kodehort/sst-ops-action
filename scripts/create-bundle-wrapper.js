#!/usr/bin/env node
/**
 * Creates a CommonJS wrapper for the bundle to work with ES module package.json
 * This avoids the "require is not defined" error when Node.js treats .js files as ES modules
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const wrapperContent = `#!/usr/bin/env node
// CommonJS wrapper for bundle execution in ES module projects
// This file ensures the bundle can be executed regardless of package.json "type" setting

const { execSync } = require('child_process');
const { join } = require('path');

// Execute the actual bundle with --input-type=commonjs flag to force CommonJS interpretation
try {
  execSync(
    \`node --input-type=commonjs "\${join(__dirname, 'index.js')}"\`,
    {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    }
  );
} catch (error) {
  process.exit(error.status || 1);
}
`;

const wrapperPath = join(process.cwd(), 'dist', 'bundle-wrapper.cjs');
writeFileSync(wrapperPath, wrapperContent, 'utf8');
