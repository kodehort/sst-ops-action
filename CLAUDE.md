# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a unified GitHub Action for SST (Serverless Stack) operations that handles deploy, diff, remove, and stage commands. The action is built with TypeScript and runs on Node.js 24, using Bun as the build runtime and package manager.

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

- **Entry Point**: `src/main.ts` - GitHub Action entry point; `src/index.ts` is the bundle entry and only calls `run()`
- **Inputs**: `src/inputs/` - Reads the Actions inputs and resolves them into a validated, fully-defaulted shape; also stage computation from Git context
- **Operations**: `src/operations/` - `router.ts` dispatches by operation, `run.ts` is the single run/parse/report path
- **Parsers**: `src/parsers/` - Parsing of SST CLI **output** into structured results (not input validation — that lives in `src/inputs/` and `src/utils/validation.ts`)
- **Cache**: `src/cache/` - SST provider cache warm-up around infrastructure operations
- **GitHub Integration**: `src/github/` - GitHub API client and unified formatting system
- **Outputs**: `src/outputs/` - Formats results into GitHub Action outputs
- **Errors**: `src/errors/` - Typed errors used across the action
- **Types**: `src/types/` - TypeScript definitions for operations, outputs, and SST structures
- **Utilities**: `src/utils/` - CLI execution, input validation schemas, error handling helpers

### Operation Flow

1. Input parsing and validation via operation-specific parsers
2. SST command execution through CLI utilities
3. Output parsing and formatting
4. GitHub integration for PR comments and workflow summaries
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
  just under current coverage. `vitest.config.ts` is the source of truth; at
  the time of writing it is 93% statements, 93% lines, 85% branches, 95%
  functions.
  Keep the `thresholds` object in `vitest.config.ts` flat — Vitest reads an
  unrecognised key such as the former `global` as a glob pattern, which silently
  enforces nothing.
- Coverage ratchet rule: raise thresholds as coverage improves. **Never lower a
  threshold to accommodate new untested code.** Re-baselining downwards is
  permitted when the sole cause is deleting covered code — coverage is a ratio,
  so removing well-tested code lowers the aggregate even though the codebase
  improved. When you re-baseline, the commit body must state the before/after
  numbers and name deletion as the cause.
- `functions` was re-baselined 97 → 95 under #136 as a one-off, for granularity
  rather than deletion: ~240 functions means each is worth ~0.42 points, so a
  threshold 0.08 under the actual value broke CI after eight tested-function
  deletions. Statements, branches and lines count in the thousands and move
  smoothly, so they stay tight.
- Test organization mirrors source structure in `__tests__/`
- Vitest for testing framework with global test setup
- Integration tests for end-to-end operation validation
- Path aliases: `@/` for src, `@tests/` for test files

## Key Implementation Details

### GitHub Action Configuration

- Defined in `action.yml` with inputs for operation, stage, token, comment-mode, etc.
- Outputs include success status, resource changes, URLs, completion status
- Runs on Node.js 24 with main entry at `dist/index.js`

### Build Process

- Bun's native bundler compiles and bundles TypeScript for distribution
- Output to `dist/` directory with a linked source map (committed for GitHub Actions)
- `scripts/build.ts` injects the package version, minifies the bundle, and writes the release build manifest
- Distribution files are built during development and CI/CD, committed to repository for GitHub Actions compatibility

**The committed bundle is gated.** CI fails when `dist/index.js` or
`dist/index.js.map` differ from a fresh build, so rebuild and commit `dist/`
with any source change. Check locally with
`git diff -- dist/index.js dist/index.js.map`. `dist/build-manifest.json` is
excluded from the gate — it records build timestamp, platform, architecture
and Bun version, so it never matches.

The build is expected to be byte-reproducible across platforms, but only from a clean
`bun install --frozen-lockfile` **and the pinned Bun version**. An
incrementally-updated `node_modules` can hold a tree the lockfile never
described (nested duplicate copies rather than hoisted ones), which changes the
bundle. If a rebuild drifts unexpectedly,
`/bin/rm -rf node_modules && bun install --frozen-lockfile` first.

**`mise.toml` is the single source of truth for the Bun version.** Do not
hardcode it anywhere else — not in workflows, not in this file.
`.github/actions/setup-node-env` reads the `[tools]` pins out of `mise.toml` and
feeds them to `setup-bun`/`setup-node`, so `mise install` locally gives you
exactly what CI runs. Both its `bun-version` and `node-version` inputs exist
only as deliberate per-job overrides and default to the `mise.toml` pins; a
missing or unreadable pin fails the job rather than silently installing
whatever is newest.

This matters because **the bundle is not byte-stable across Bun versions**, and
`dist/` is committed and gated on a byte-exact rebuild. The difference is not
subtle: measured at v0.8.7, the same source bundled to 865,216 bytes under Bun
1.4.0 and 663,502 bytes under 1.4.2. Each version is reproducible on its own —
repeated clean builds agree — so a hash mismatch between them is a version
difference, not flakiness. When the two pins disagreed, a contributor following
`mise.toml` built a bundle CI rejected, and the gate's message
("Committed bundle is stale. Run 'bun run build' and commit dist/.") pointed at
the wrong cause — rebuilding was what produced the mismatch. The gate now
compares the Bun version in the committed `dist/build-manifest.json` against the
one doing the rebuild and names a version mismatch explicitly when it finds one.

A consequence worth knowing: when Renovate bumps the Bun pin in `mise.toml`,
that bump changes the expected bundle bytes, so Build & Verify will fail on the
Renovate PR until `dist/` is rebuilt with the new version and committed into it.
That failure is correct and is the intended signal — previously such a bump went
green and left the trap for whoever pushed next.

The build targets Node, bundles all package dependencies (including `undici`),
rejects unresolved imports, and emits one linked ESM source map. GitHub Actions
executes the committed result with Node 24; Bun is not required in repositories
that consume the action.

Adding `@actions/cache` for provider caching grew the bundle by roughly 760 KB:
663,806 bytes before, a little over 1.42 MB after. The dependency pulls in
`@azure/storage-blob` and `@azure/core-rest-pipeline`, and `packages: "bundle"`
inlines them whether or not `cache-providers` is ever set — `splitting: false`
means a dynamic `import()` would not defer it either. Most of those SDKs
tree-shake away, which is why the cost is ~760 KB rather than the several MB
the dependency list suggests.

Do not expect an exact byte count to stay put. `scripts/build.ts` injects the
package version into the bundle, so a release that changes the version's length
changes the size: identical source built 1,423,822 bytes at v0.9.1 and
1,423,823 at v0.10.0. `dist/build-manifest.json` records the real number for
whatever is committed — read it rather than trusting a figure quoted here.

**The unresolved-import gate reads the emitted bundle, not the module graph.**
The graph over-reports badly: a barrel file such as
`@azure/core-rest-pipeline/index.js` re-exports thirty siblings, and when none
of those symbols are used Bun drops the edge without resolving it and the
metafile marks it `external` — although nothing about it reaches the output.
`debug`'s `require("supports-color")` is the same story: an explicitly optional
dependency inside a try/catch, which Bun compiles to a throwing stub the catch
swallows. Neither can fail on a consumer's runner, because neither is in the
file. So `scripts/build.ts` takes the graph's externals as *candidates* and
keeps only those the emitted text actually references in import, dynamic-import
or require position. Matching on the bare name would not do: `@actions/cache`
ships its own name as a user-agent string. Do not use `metafile.outputs[].imports`
for this — measured at Bun 1.4.2 it is `[]` even when real dependencies are
marked external, so it catches nothing.

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

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `kodehort/sst-ops-action`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — each canonical role's label equals its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.

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
