# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a unified GitHub Action for SST (Serverless Stack) operations that handles deploy, diff, and remove commands. The action is built with TypeScript and runs on Node.js 20+, using Bun as the runtime and package manager.

## Development Commands

```bash
# Install dependencies
bun install

# Build the action for distribution
bun run build

# Run all tests
bun run test

# Run tests in watch mode
bun test:watch

# Run tests with coverage (90% thresholds enforced)
bun run test:coverage

# Type checking
bun run typecheck

# Format code
bun run format

# Lint code
bun run lint

# Run all quality checks (typecheck + lint + test)
bun run validate

# Install git hooks
bun run prepare
```

## Architecture Overview

### Core Structure

- **Entry Point**: `src/main.ts` - GitHub Action entry point with basic input validation
- **Operations**: `src/operations/` - Deploy, diff, and remove operation implementations
- **Parsers**: `src/parsers/` - Input validation and parsing for each operation
- **GitHub Integration**: `src/github/` - GitHub API client and comment formatters
- **Types**: `src/types/` - TypeScript definitions for operations, outputs, and SST structures
- **Utilities**: `src/utils/` - CLI execution, error handling, validation helpers

### Operation Flow

1. Input parsing and validation via operation-specific parsers
2. SST command execution through CLI utilities
3. Output parsing and formatting
4. GitHub integration for PR comments and artifact uploads
5. Result reporting via GitHub Action outputs

### Type System

- `SSTOperation`: Union type for 'deploy' | 'diff' | 'remove'
- `OperationResult`: Discriminated union with operation-specific result types
- `BaseOperationResult`: Common fields across all operations
- Operation-specific results extend base with specialized fields (URLs, changes, etc.)

### Testing Strategy

- Comprehensive test suite with 90% coverage thresholds
- Test organization mirrors source structure in `__tests__/`
- Vitest for testing framework with global test setup
- Integration tests for end-to-end operation validation
- Path aliases: `@/` for src, `@tests/` for test files

## Key Implementation Details

### GitHub Action Configuration

- Defined in `action.yml` with inputs for operation, stage, token, comment-mode, etc.
- Outputs include success status, resource changes, URLs, completion status
- Runs on Node.js 20 with main entry at `dist/main.js`

### Build Process

- Custom build script at `scripts/build.ts` bundles for distribution
- Output to `dist/` directory with source maps and declarations
- Uses Bun bundler for efficient packaging

### Code Quality

- Biome for linting/formatting via ultracite configuration
- Strict TypeScript configuration with all strict flags enabled
- File naming convention: kebab-case, camelCase, or PascalCase
- Pre-commit hooks via Lefthook (currently commented out)

### Module System

- ES modules throughout (`"type": "module"`)
- Path aliases configured in both tsconfig.json and vitest.config.ts
- Bundler module resolution for TypeScript

## SST Integration Points

The action interfaces with SST CLI commands and expects:

- SST project in the repository root
- Valid `sst.config.ts` or `sst.json` configuration
- Proper AWS credentials configured in the GitHub Action environment
- Stage-specific configurations for different deployment environments

Operations are designed to parse SST CLI output and extract structured information about deployments, planned changes, and resource management.

