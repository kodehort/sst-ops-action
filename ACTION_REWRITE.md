# GitHub Action Modernization Plan: SST Deploy Action

## Executive Summary

Convert the existing composite SST Deploy action (`/.github/actions/sst-deploy`) into a standalone, publishable TypeScript GitHub Action using modern tooling (Bun, Biome, Vitest) instead of the traditional Node.js/Jest/ESLint stack.

## Current State Analysis

### Existing Architecture
- **Type**: Composite action (runs shell commands)
- **Runtime**: Bun with TypeScript
- **Structure**: Multiple TypeScript files executed via shell commands
- **Dependencies**: `@actions/core`, `@actions/github`, minimal dev dependencies
- **Build Process**: None (direct execution of TypeScript files)

### Current Strengths
- Modern TypeScript codebase with good type safety
- Well-structured modular design (deploy.ts, parser.ts, comment.ts, etc.)
- Comprehensive SST output parsing and GitHub integration
- Good error handling and artifact management

### Current Limitations
- Not publishable to GitHub Marketplace
- Requires local Bun installation in runner
- No bundling/optimization for distribution
- Limited testing infrastructure
- No code formatting/linting setup

## Target Architecture

### New Structure (Following GitHub's TypeScript Action Template)

```
sst-deploy-action/
├── src/
│   ├── main.ts              # Entry point (like current deploy.ts)
│   ├── parser.ts            # SST output parser (existing)
│   ├── comment.ts           # PR comment logic (existing)
│   ├── summary.ts           # GitHub summary (existing) 
│   ├── types.ts             # Type definitions (existing)
│   ├── utils.ts             # Utilities (existing)
│   └── formatter.ts         # Output formatter (existing)
├── __tests__/
│   ├── main.test.ts
│   ├── parser.test.ts
│   └── utils.test.ts
├── dist/                    # Compiled/bundled output
├── action.yml               # Action metadata
├── package.json             # Dependencies and scripts
├── biome.json              # Biome configuration
├── tsconfig.json           # TypeScript config
├── vitest.config.ts        # Test configuration
└── README.md               # Usage documentation
```

## Modernization Plan

### Phase 1: Project Setup
1. **Initialize new action repository structure**
   - Create new directory structure
   - Setup `package.json` with Bun-compatible scripts
   - Configure TypeScript with modern settings

2. **Configure Modern Tooling**
   - Setup Biome for formatting and linting (replace ESLint/Prettier)
   - Configure Vitest for testing (replace Jest)
   - Setup Bun as the primary runtime and package manager

3. **Setup Build Pipeline**
   - Configure Bun's bundler to create single-file distribution
   - Setup GitHub Actions workflow for CI/CD
   - Configure automatic releases and tagging

### Phase 2: Code Migration
1. **Migrate Existing Code**
   - Move existing TypeScript files to `src/` directory
   - Rename `deploy.ts` to `main.ts` as the entry point
   - Update imports and module resolution

2. **Enhance Entry Point**
   - Consolidate the multi-step composite logic into single main function
   - Implement proper GitHub Actions toolkit integration
   - Add comprehensive error handling with `core.setFailed()`

3. **Update Action Metadata**
   - Convert from composite to JavaScript action in `action.yml`
   - Update `runs.using` to `node20` and `runs.main` to `dist/main.js`
   - Maintain existing inputs/outputs interface

### Phase 3: Testing Infrastructure
1. **Setup Test Framework**
   - Configure Vitest with TypeScript support
   - Create test utilities for mocking GitHub Actions context
   - Setup test coverage reporting

2. **Write Comprehensive Tests**
   - Unit tests for parser logic
   - Integration tests for main workflow
   - Mock tests for external dependencies (SST CLI, GitHub API)

### Phase 4: Build and Distribution
1. **Configure Build Process**
   - Setup Bun bundling to create optimized distribution
   - Ensure all dependencies are properly bundled
   - Configure source maps for debugging

2. **Distribution Strategy**
   - Commit `dist/` to repository (GitHub Actions standard)
   - Setup automated build verification
   - Configure release workflow with automatic versioning

### Phase 5: Enhanced SST Operations Support
1. **Multi-Operation Support**
   - Add `operation` input parameter (`deploy`, `diff`, `remove`)
   - Implement operation-specific logic and output parsing
   - Add operation-specific error handling and reporting

2. **Extended Parser Logic**
   - Support parsing `sst diff` output format
   - Support parsing `sst remove` output format
   - Unified result structure across all operations

### Phase 6: Documentation and Distribution
1. **Create Documentation**
   - Comprehensive README with usage examples for all operations
   - Migration guide from composite to JavaScript action
   - Contributing guidelines

2. **Internal Distribution**
   - Setup for easy consumption across internal projects
   - Version tagging for stability
   - Clear usage patterns and examples

## Enhanced Action Interface

### Updated action.yml
```yaml
name: "SST Operations"
description: "Deploy, diff, or remove SST applications with TypeScript + Bun runtime"
author: "Kodehort"
branding:
  icon: "upload-cloud"
  color: "green"

inputs:
  operation:
    description: "SST operation to perform (deploy, diff, remove)"
    required: false
    default: "deploy"
  token:
    description: "GitHub token for authentication"
    required: true
  stage:
    description: "SST stage to operate on"
    required: true
  comment-mode:
    description: "When to post PR comments (always, on-success, on-failure, never)"
    required: false
    default: "on-success"
  fail-on-error:
    description: "Whether to fail the action when SST operation fails"
    required: false
    default: "true"
  max-output-size:
    description: "Maximum output size before truncation (bytes)"
    required: false
    default: "50000"

outputs:
  success:
    description: "Whether SST operation completed successfully"
  operation:
    description: "The operation that was performed"
  stage:
    description: "The stage that was operated on"
  resource_changes:
    description: "Number of resource changes made (deploy/remove only)"
  urls:
    description: "JSON array of deployed URLs (deploy only)"
  app:
    description: "The SST app name"
  completion_status:
    description: "Operation completion status (complete, partial, failed)"
  permalink:
    description: "SST Console permalink for operation details"
  truncated:
    description: "Whether the operation output was truncated"
  diff_summary:
    description: "Summary of planned changes (diff only)"

runs:
  using: "node20"
  main: "dist/main.js"
```

## Key Configuration Files

### package.json (Bun-optimized)
```json
{
  "name": "sst-deploy-action",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "bun build src/main.ts --outdir dist --target node",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "format": "bunx @biomejs/biome format --write .",
    "lint": "bunx @biomejs/biome check .",
    "typecheck": "tsc --noEmit",
    "all": "bun run format && bun run lint && bun run typecheck && bun run test && bun run build"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.8.3",
    "@types/bun": "latest",
    "typescript": "^5.9.0",
    "vitest": "^2.0.0"
  }
}
```

### biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/1.8.3/schema.json",
  "files": {
    "include": ["src/**/*", "__tests__/**/*"],
    "ignore": ["dist/**/*", "node_modules/**/*"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingComma": "es5"
    }
  }
}
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '__tests__/']
    }
  }
});
```

## Migration Benefits

1. **Publishability**: Can be published to GitHub Marketplace
2. **Performance**: Single bundled file loads faster than composite action
3. **Portability**: No runtime dependencies on Bun in CI environment
4. **Developer Experience**: Modern tooling with better IDE integration
5. **Testing**: Comprehensive test coverage with modern test runner
6. **Maintenance**: Automated formatting and linting with Biome
7. **Distribution**: Optimized bundling with Bun's fast bundler

## Risks and Mitigation

1. **Bundle Size**: Monitor distribution size, optimize imports
2. **Compatibility**: Test across different Node.js versions in Actions
3. **Migration Complexity**: Maintain backward compatibility during transition
4. **Testing Coverage**: Ensure comprehensive test coverage before migration

## Success Criteria

- [ ] Action successfully builds and bundles with Bun
- [ ] All existing functionality preserved
- [ ] Comprehensive test coverage (>90%)
- [ ] Action runs successfully in GitHub Actions environment
- [ ] Performance equal or better than current composite action
- [ ] Ready for GitHub Marketplace publication

## Stakeholder Requirements

Based on feedback:

1. **Backward Compatibility**: Not required - clean migration approach
2. **Marketplace Publication**: Low priority - focus on internal usage across projects first
3. **Additional SST Features**: Support `sst deploy`, `sst diff`, `sst remove` operations in single action
4. **Versioning Strategy**: None specified for now
5. **Output Formats**: Current implementation sufficient