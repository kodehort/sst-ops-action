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

# Run tests with coverage (ratchet thresholds enforced, see vitest.config.ts)
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
- **GitHub Integration**: `src/github/` - GitHub API client and unified formatting system
- **Types**: `src/types/` - TypeScript definitions for operations, outputs, and SST structures
- **Utilities**: `src/utils/` - CLI execution, error handling, validation helpers

### Operation Flow

1. Input parsing and validation via operation-specific parsers
2. SST command execution through CLI utilities
3. Output parsing and formatting
4. GitHub integration for PR comments and artifact uploads
5. Result reporting via GitHub Action outputs

### Input Validation and Error Handling

The action implements strict input validation with fail-fast behavior for critical scenarios:

- **Operation Input**: Required and validated using Zod schema. The action throws and exits immediately if the operation is missing or invalid (not one of: deploy, diff, remove, stage). No default operation is provided to prevent dangerous failure states.

- **Stage Computation**: When deploying without an explicit stage, the action attempts to compute the stage from Git context. If stage computation fails (e.g., no valid Git ref available), this is treated as an unrecoverable scenario and the action throws and exits immediately.

- **Validation Philosophy**: Critical validation failures result in immediate termination rather than fallback behavior to ensure predictable and safe operation. This prevents scenarios like accidentally deploying to unexpected stages or using the wrong operation type.

### Type System

- `SSTOperation`: Union type for 'deploy' | 'diff' | 'remove'
- `OperationResult`: Discriminated union with operation-specific result types
- `BaseOperationResult`: Common fields across all operations
- Operation-specific results extend base with specialized fields (URLs, changes, etc.)

### Testing Strategy

- Comprehensive test suite with enforced coverage thresholds, set as a ratchet
  just under current coverage (89% statements/lines, 79% branches, 97% functions).
  Raise them in `vitest.config.ts` as coverage improves; never lower them. Keep
  the `thresholds` object flat — Vitest reads an unrecognised key such as the
  former `global` as a glob pattern, which silently enforces nothing.
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

- Rollup configuration bundles TypeScript for distribution
- Output to `dist/` directory with source maps and declarations (committed for GitHub Actions)
- Uses Rollup bundler with terser for efficient, minified packaging
- Distribution files are built during development and CI/CD, committed to repository for GitHub Actions compatibility

### Distribution Strategy

- **Development**: `dist/` folder is built locally for testing and committed for GitHub Actions compatibility
- **CI Pipeline**: Builds and verifies distribution files, commits them to repository
- **Releases**: Distribution files are committed to repository AND attached as release assets for transparency
- **Consumers**: GitHub Actions use dist files directly from the repository (as required by GitHub Actions)
- **Repository**: Distribution files are now committed because GitHub Actions require them in the repository itself

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

### GitHub Formatting Architecture

All GitHub comment and workflow summary formatting is handled by a **single source of truth**: the `OperationFormatter` class in `src/github/formatters.ts`. This ensures consistent formatting across:

- **PR Comments**: Rich, operation-specific comments with status, resource changes, and action details
- **Workflow Summaries**: Detailed summaries with infrastructure changes, resource breakdowns, and visual diff content
- **All Operations**: Deploy, diff, and remove operations each have specialized formatting

The `GitHubClient` (`src/github/client.ts`) uses the `OperationFormatter` for all content generation, eliminating formatting duplication and ensuring consistency between comments and summaries.

**Key Formatting Features:**
- Rich markdown with emojis and status badges
- Operation-specific content (diff summaries show infrastructure changes with resource counts)
- Formatted diff content in code blocks for diff operations
- Resource change breakdowns with action icons
- Console integration links
- Consistent styling across all operations

<!-- fallow:setup-hooks:start -->
## Fallow local gate

Before any `jj commit` (`ci`), `jj describe` (`desc`), `jj split`, `jj squash`, or `jj git push`, run `bun fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before retrying. Treat JSON runtime errors like `{ "error": true, ... }` as non-blocking.

A `PreToolUse` hook (`.claude/hooks/fallow-gate.sh`) enforces this automatically and exits 2 on a failing verdict. CI enforces the same audit in the `quality-gates` job (`.github/workflows/ci.yml`), which needs `fetch-depth: 0` to resolve the base ref and must run before the coverage step.

Releases gate differently. `.github/workflows/release.yml` runs `fallow check --fail-on-issues` over the whole tree, because a release builds from `main` where there is no base ref and the changed-files `audit` would pass vacuously. It stays scoped to dead code: `fallow health` reports pre-existing high-CRAP functions and would block every release until that debt is paid.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `"audit": { "gate": "all" }` in `.fallowrc.jsonc` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

**Re-installing overwrites the gate script.** `fallow hooks install --target agent --agent claude` rewrites `.claude/hooks/fallow-gate.sh` from the stock template. Re-apply both `# LOCAL EDIT` patches afterwards — the `bun fallow` runner probe and the `is_jj_write_command` tokenizer — then re-run the classification check. Without them the gate installs, looks healthy, and intercepts nothing.

Do not run the `--agent codex` target here: it appends a stock `AGENTS.md` block that contradicts this one (it says `git commit`/`git push` and points at `fallow.toml` rather than `.fallowrc.jsonc`), leaving two disagreeing instruction files. This block is maintained by hand; the `claude` target does not touch it.

## Fallow task map

| When the agent is about to... | Run |
|---|---|
| delete an "unused" export or file | `bun fallow dead-code --trace <file>:<export>` |
| prove a TypeScript symbol's exact consumers before refactoring | `bun fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>` |
| delete an "unused" dependency | `bun fallow dead-code --trace-dependency <name>` |
| commit or open a PR | `bun fallow audit --base <ref>` |
| prioritize refactoring | `bun fallow health --hotspots --targets` |
| ask who owns code | `bun fallow health --ownership` |
| check untested-but-reachable code | `bun fallow health --coverage-gaps` |
| consolidate duplication | `bun fallow dupes --trace dup:<fingerprint>` |
| find feature flags | `bun fallow flags` |
| check which architecture rules apply to a file before changing it | `bun fallow guard <files>` |
| surface security candidates | `bun fallow security` |
| understand a finding | `bun fallow explain <issue-type>` |
| scope a monorepo | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command) |
<!-- fallow:setup-hooks:end -->
