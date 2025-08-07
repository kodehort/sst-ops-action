# Contributing Guide

Welcome to the SST Operations Action project! This guide provides everything you need to know about contributing to the project, from setting up your development environment to submitting pull requests.

## Quick Navigation

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Project Structure](#project-structure)

---

## Getting Started

### Prerequisites

**Required:**
- [Bun](https://bun.sh/) - Runtime and package manager
- Node.js 20+ - For GitHub Actions compatibility
- Git - Version control
- GitHub CLI (optional) - For workflow testing

**Development Tools:**
- VS Code (recommended) with TypeScript extensions
- GitHub Desktop (optional)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/kodehort/sst-operations-action.git
cd sst-operations-action

# Install dependencies
bun install

# Verify setup
bun run validate
```

If the validation passes, you're ready to contribute!

---

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/sst-operations-action.git
cd sst-operations-action

# Add upstream remote
git remote add upstream https://github.com/kodehort/sst-operations-action.git
```

### 2. Install Dependencies

```bash
# Install all dependencies
bun install

# This also sets up git hooks via lefthook
```

### 3. Verify Setup

```bash
# Run all quality checks
bun run validate

# Expected output:
# ✅ TypeScript compilation successful
# ✅ Linting passed
# ✅ All tests passed
# ✅ Build completed successfully
```

### 4. Development Environment

**Recommended VS Code Extensions:**
```json
{
  "recommendations": [
    "biomejs.biome",
    "ms-vscode.vscode-typescript-next",
    "github.vscode-github-actions",
    "ms-vscode.vscode-json"
  ]
}
```

**Environment Variables:**
```bash
# Optional: Enable debug mode for development
export ACTIONS_STEP_DEBUG=true
export SST_DEBUG=true
```

---

## Development Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/my-new-feature

# Create bugfix branch  
git checkout -b fix/issue-description

# Create documentation branch
git checkout -b docs/update-readme
```

### Daily Workflow

```bash
# Start development
git pull upstream main
git checkout -b feature/my-feature

# Make changes, test frequently
bun test                    # Run tests
bun run typecheck          # Check types
bun run lint               # Check linting
bun run build              # Build action

# Run comprehensive validation before committing
bun run validate

# Commit with conventional commit format
git add .
git commit -m "feat: add new deployment validation"

# Push and create PR
git push origin feature/my-feature
gh pr create --title "feat: add new deployment validation"
```

### Available Commands

```bash
# Development
bun test                   # Run test suite
bun test:watch            # Run tests in watch mode  
bun test:coverage         # Run tests with coverage report
bun run typecheck         # TypeScript type checking
bun run lint              # Lint code with Biome
bun run format            # Format code with Biome
bun run build             # Build production bundle
bun run validate          # Run all quality checks

# Git hooks
bun run prepare           # Install git hooks
```

---

## Testing

### Test Strategy

The project uses **Vitest** with comprehensive test coverage requirements:

- **Unit Tests:** Test individual functions and classes
- **Integration Tests:** Test complete operation workflows  
- **End-to-End Tests:** Test action in GitHub Actions environment

### Running Tests

```bash
# Run all tests
bun test

# Run tests with coverage (90% minimum required)
bun run test:coverage

# Run specific test file
bun test __tests__/operations/deploy.test.ts

# Run tests matching pattern
bun test --grep "deployment"

# Watch mode for development
bun test:watch
```

### Writing Tests

#### Unit Test Example

```typescript
// __tests__/utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateStage } from '@/utils/validation';

describe('validateStage', () => {
  it('should accept valid stage names', () => {
    expect(validateStage('production')).toBe(true);
    expect(validateStage('staging')).toBe(true);
    expect(validateStage('pr-123')).toBe(true);
  });

  it('should reject invalid stage names', () => {
    expect(validateStage('')).toBe(false);
    expect(validateStage('_invalid')).toBe(false);
    expect(validateStage('stage with spaces')).toBe(false);
  });
});
```

#### Integration Test Example

```typescript
// __tests__/integration/deploy-operation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { executeOperation } from '@/operations/router';

describe('Deploy Operation Integration', () => {
  it('should execute deploy operation successfully', async () => {
    // Mock SST CLI execution
    vi.mocked(spawn).mockImplementation(() => 
      createMockChildProcess(DEPLOY_SUCCESS_OUTPUT)
    );

    const result = await executeOperation('deploy', {
      stage: 'test',
      token: 'fake-token',
      commentMode: 'never',
      failOnError: false,
      maxOutputSize: 50000
    });

    expect(result.success).toBe(true);
    expect(result.operation).toBe('deploy');
    expect(result.urls).toHaveLength(1);
  });
});
```

### Test Coverage Requirements

- **Minimum:** 90% line coverage
- **Branches:** 85% branch coverage  
- **Functions:** 90% function coverage
- **Critical Paths:** 100% coverage for error handling

```bash
# Generate detailed coverage report
bun run test:coverage

# View coverage report
open coverage/index.html
```

---

## Code Standards

### TypeScript Guidelines

**Configuration:** Strict mode enabled with all strict flags

```typescript
// Good: Use explicit types
interface DeployOptions {
  stage: string;
  token: string;
  commentMode: CommentMode;
}

function deploy(options: DeployOptions): Promise<DeployResult> {
  // Implementation
}

// Avoid: Any types
function deploy(options: any): any {
  // Bad - no type safety
}
```

**Type Safety Rules:**
- No `any` types (use `unknown` if needed)
- Explicit return types for public functions
- Use type guards for runtime validation
- Prefer interfaces over types for object definitions

### Code Style

**Formatting:** Automatically enforced by Biome

```typescript
// Function naming: camelCase
function parseDeploymentOutput(output: string): DeployResult {
  // Implementation
}

// Constants: SCREAMING_SNAKE_CASE  
const MAX_OUTPUT_SIZE = 1000000;

// Classes: PascalCase
class OperationFactory {
  // Methods: camelCase
  createOperation(type: string): BaseOperation {
    // Implementation
  }
}
```

**File Organization:**
```typescript
// 1. Imports (external first, then internal)
import * as core from '@actions/core';
import { spawn } from 'child_process';

import { BaseParser } from '@/parsers/base-parser';
import type { DeployResult } from '@/types/operations';

// 2. Types and interfaces
interface DeployParserOptions {
  maxSize: number;
}

// 3. Constants
const DEFAULT_TIMEOUT = 900000; // 15 minutes

// 4. Implementation
export class DeployParser extends BaseParser<DeployResult> {
  // Implementation
}
```

### Error Handling Standards

```typescript
// Good: Explicit error handling with types
async function executeSST(
  operation: string, 
  stage: string
): Promise<CLIResult> {
  try {
    const result = await spawn('sst', [operation, '--stage', stage]);
    return {
      success: true,
      output: result.stdout,
      exitCode: result.exitCode
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        output: '',
        exitCode: 1,
        error: error.message
      };
    }
    throw error; // Re-throw unknown errors
  }
}

// Avoid: Silent failures or generic catches
async function executeSST(operation: string) {
  try {
    // Implementation
  } catch (e) {
    return null; // Bad - loses error information
  }
}
```

### Documentation Standards

**JSDoc for Public APIs:**
```typescript
/**
 * Parses SST deployment output to extract URLs and resource changes
 * 
 * @param output - Raw SST CLI output
 * @param stage - Deployment stage name  
 * @param exitCode - SST CLI exit code
 * @returns Parsed deployment result with URLs and metadata
 * 
 * @throws {Error} When output format is unrecognizable
 * 
 * @example
 * ```typescript
 * const result = parser.parse(sstOutput, 'production', 0);
 * console.log(result.urls); // ['https://api.example.com']
 * ```
 */
parse(output: string, stage: string, exitCode: number): DeployResult {
  // Implementation
}
```

**README Updates:**
- Update examples when adding new features
- Document breaking changes clearly
- Include migration instructions for API changes

---

## Pull Request Process

### Before Creating PR

```bash
# 1. Ensure your branch is up to date
git checkout main
git pull upstream main
git checkout your-feature-branch
git rebase main

# 2. Run full validation
bun run validate

# 3. Ensure tests pass
bun test

# 4. Build and verify bundle
bun run build
```

### PR Creation

**Title Format:** Use [Conventional Commits](https://www.conventionalcommits.org/)

```
feat: add timeout configuration for operations
fix: resolve parsing issue with large outputs  
docs: update API documentation with examples
test: add integration tests for remove operation
chore: update dependencies to latest versions
```

**PR Description Template:**
```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass  
- [ ] Manual testing completed
- [ ] Coverage requirements met (90%+)

## Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] No new linting errors
- [ ] Bundle builds successfully
- [ ] Backward compatibility maintained (or breaking changes documented)

## Related Issues
Fixes #123
Closes #456
```

### PR Review Process

**Automated Checks:**
- ✅ TypeScript compilation
- ✅ Linting (Biome)
- ✅ Test suite (90%+ coverage)
- ✅ Bundle build verification
- ✅ Security scanning

**Manual Review:**
1. **Code Quality:** Readability, maintainability, performance
2. **Testing:** Adequate test coverage and quality
3. **Documentation:** Clear and up-to-date
4. **API Design:** Consistent with existing patterns
5. **Backward Compatibility:** No breaking changes without major version

### Addressing Review Comments

```bash
# Make requested changes
git add .
git commit -m "fix: address review comments"

# Update existing commit instead of new commit (if preferred)
git add .
git commit --amend --no-edit

# Push changes
git push origin your-feature-branch

# Force push if you amended commits
git push --force-with-lease origin your-feature-branch
```

---

## Release Process

### Release Strategy

The project uses **semantic versioning** with automated releases:

- **Major (v1.0.0 → v2.0.0):** Breaking changes
- **Minor (v1.0.0 → v1.1.0):** New features, backward compatible
- **Patch (v1.0.0 → v1.0.1):** Bug fixes, backward compatible

### Triggering Releases

Releases are triggered automatically by conventional commits:

```bash
# Patch release
git commit -m "fix: resolve timeout issue in remove operation"

# Minor release  
git commit -m "feat: add custom timeout configuration"

# Major release
git commit -m "feat!: change operation input format

BREAKING CHANGE: operation parameter now requires explicit value"
```

### Release Workflow

1. **PR Merged to Main:** Conventional commit analysis
2. **Version Calculation:** Semantic version bump determined
3. **Quality Gates:** Full test suite, linting, build verification
4. **Release Creation:** GitHub release with automated changelog
5. **Distribution:** Major version branch updates (v1, v2)
6. **Validation:** Post-release verification and rollback if needed

### Manual Release (Emergency)

```bash
# Trigger manual release via GitHub Actions
gh workflow run release.yml -f release_type=patch
gh workflow run release.yml -f release_type=minor  
gh workflow run release.yml -f release_type=major
```

---

## Project Structure

### Directory Layout

```
sst-operations-action/
├── src/                          # Source code
│   ├── main.ts                   # Action entry point
│   ├── operations/               # Operation implementations
│   │   ├── base-operation.ts     # Base operation class
│   │   ├── deploy.ts            # Deploy operation
│   │   ├── diff.ts              # Diff operation
│   │   ├── remove.ts            # Remove operation
│   │   ├── factory.ts           # Operation factory
│   │   └── router.ts            # Operation routing
│   ├── parsers/                 # Output parsers
│   │   ├── base-parser.ts       # Base parser class
│   │   ├── deploy-parser.ts     # Deploy output parser
│   │   ├── diff-parser.ts       # Diff output parser
│   │   └── remove-parser.ts     # Remove output parser
│   ├── utils/                   # Utility functions
│   │   ├── cli.ts              # CLI execution utilities
│   │   ├── validation.ts       # Input validation
│   │   ├── github-actions.ts   # GitHub Actions integration
│   │   └── error-handling.ts   # Error management
│   ├── github/                 # GitHub integration
│   │   ├── client.ts           # GitHub API client
│   │   └── formatters.ts       # Comment/summary formatters
│   ├── outputs/                # Output handling
│   │   ├── formatter.ts        # Output formatting
│   │   └── index.ts           # Output exports
│   ├── errors/                 # Error handling
│   │   ├── error-handler.ts    # Error categorization
│   │   └── categories.ts       # Error categories
│   └── types/                  # Type definitions
│       ├── operations.ts       # Operation types
│       ├── outputs.ts          # Output types
│       ├── sst.ts             # SST-specific types
│       └── index.ts           # Type exports
├── __tests__/                  # Test suites
│   ├── fixtures/               # Test data
│   ├── operations/             # Operation tests
│   ├── parsers/               # Parser tests
│   ├── utils/                 # Utility tests
│   ├── github/                # GitHub integration tests
│   ├── integration/           # Integration tests
│   └── setup.ts              # Test setup
├── scripts/                   # Build and utility scripts
│   ├── build.ts              # Production build script
│   └── verify-distribution.sh # Distribution verification
├── .github/                   # GitHub configurations
│   └── workflows/             # GitHub Actions workflows
├── dist/                      # Built distribution (generated)
├── coverage/                  # Test coverage reports (generated)
├── docs/                      # Additional documentation
└── examples/                  # Usage examples
```

### Key Files

#### Configuration Files
- `action.yml` - GitHub Action definition
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `biome.jsonc` - Linting and formatting rules
- `vitest.config.ts` - Test configuration
- `lefthook.yml` - Git hooks configuration

#### Documentation
- `README.md` - Main project documentation
- `MIGRATION.md` - Migration guide from composite actions
- `TROUBLESHOOTING.md` - Common issues and solutions
- `API.md` - Complete API reference
- `VERSIONING_POLICY.md` - Semantic versioning strategy
- `COMPATIBILITY_POLICY.md` - Backward compatibility commitments
- `UPGRADE_GUIDE.md` - Version upgrade instructions

### Architecture Overview

```
GitHub Actions Runner
├── main.ts (Entry Point)
│   ├── Input Validation
│   ├── Operation Routing
│   └── Output Formatting
├── Operations Layer
│   ├── DeployOperation
│   ├── DiffOperation  
│   └── RemoveOperation
├── Parsing Layer
│   ├── SST CLI Execution
│   ├── Output Parsing
│   └── Result Transformation
└── Integration Layer
    ├── GitHub API Client
    ├── PR/Issue Comments
    └── Artifact Management
```

### Adding New Features

#### 1. New Operation Type

```bash
# 1. Add operation type to types
echo "export type SSTOperation = 'deploy' | 'diff' | 'remove' | 'new-operation';" > src/types/operations.ts

# 2. Create operation implementation
touch src/operations/new-operation.ts

# 3. Add parser if needed
touch src/parsers/new-operation-parser.ts

# 4. Update factory and router
# Edit src/operations/factory.ts and src/operations/router.ts

# 5. Add tests
touch __tests__/operations/new-operation.test.ts

# 6. Update documentation
# Edit README.md, API.md, and examples/
```

#### 2. New Output Field

```typescript
// 1. Add to type definitions
// src/types/outputs.ts
export interface BaseOperationResult {
  // existing fields...
  newField?: string;
}

// 2. Update output formatter
// src/outputs/formatter.ts  
static formatForGitHubActions(result: OperationResult) {
  return {
    // existing outputs...
    new_field: result.newField || '',
  };
}

// 3. Update parser to populate field
// 4. Add tests for new field
// 5. Update API documentation
```

#### 3. New Validation Rule

```typescript
// 1. Add validation function
// src/utils/validation.ts
export function validateNewField(value: string): boolean {
  // validation logic
}

// 2. Update schema
export const ActionInputsSchema = z.object({
  // existing fields...
  newField: z.string().refine(validateNewField, {
    message: 'Invalid new field format'
  }),
});

// 3. Add tests
// 4. Update documentation
```

---

## Community

### Code of Conduct

We follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). Please be respectful and professional in all interactions.

### Communication Channels

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/kodehort/sst-operations-action/issues)
- 💡 **Feature Requests:** [GitHub Issues](https://github.com/kodehort/sst-operations-action/issues) with `enhancement` label
- 💬 **Questions:** [GitHub Discussions](https://github.com/kodehort/sst-operations-action/discussions)
- 📧 **Security:** security@kodehort.com

### Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation

---

## Getting Help

### Common Issues

1. **Tests Failing:** Run `bun run validate` to see all issues
2. **Type Errors:** Check TypeScript strict mode requirements
3. **Linting Errors:** Run `bun run format` to auto-fix
4. **Build Issues:** Verify all dependencies installed with `bun install`

### Support Channels

- **Documentation:** Check README.md and API.md first
- **Search Issues:** Look for existing solutions
- **Ask Questions:** Create discussion for general questions  
- **Report Bugs:** Create issue with full reproduction steps

### Mentorship

New contributors can request mentorship by:
1. Commenting on "good first issue" items
2. Asking questions in discussions
3. Attending virtual office hours (when available)

---

Thank you for contributing to the SST Operations Action! Your contributions help make deployment workflows better for the entire SST community.

**Questions?** Feel free to reach out via [GitHub Discussions](https://github.com/kodehort/sst-operations-action/discussions) or create an issue.