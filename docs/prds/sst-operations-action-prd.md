# SST Operations Action - Product Requirements Document

## Executive Summary

**Solution Overview:** A standalone, reusable TypeScript GitHub Action that consolidates SST operations (deploy, diff, remove) into a single unified implementation. This action was extracted from a monorepo where these operations were previously implemented as separate composite actions, providing a more maintainable and distributable solution using modern tooling (Bun, Biome, Vitest).

**Context:** This project represents a modernization effort, moving from multiple composite actions within a monorepo to a single, standalone reusable action that can be:
- Distributed independently as a GitHub Action
- Reused across multiple repositories and projects
- Maintained with better tooling and development practices
- Released with proper semantic versioning

**Success Metrics:**
- Developer satisfaction with improved reusability and maintainability
- Reduced workflow complexity by consolidating multiple actions into one
- Zero functional errors in production usage
- Low complexity implementation that's maintainable long-term
- Successful migration from monorepo composite actions to standalone implementation

---

## Technology Stack

### Core Technologies
- **Framework:** SST v3 (Serverless Stack)
- **Runtime:** Bun v1.1.0 (development), Node.js 20 (execution)
- **Language:** TypeScript v5.9.0-beta
- **Build Tool:** Bun bundler
- **Package Manager:** Bun

### Quality & Development Tools
- **Linting:** Biome v2.1.3 + Ultracite v5.1.2
- **Testing:** Vitest v3.2.4 with @vitest/coverage-v8
- **Git Hooks:** Lefthook v1.12.2

---

## Feature Requirements

### Functional Requirements

#### FR1: Multi-Operation Support
- **Requirement:** Support three SST operations: `deploy`, `diff`, `remove`
- **Implementation:** Single `operation` input parameter with validation
- **Default Behavior:** `deploy` operation for backward compatibility
- **User Story:** As a developer, I want to specify which SST operation to run so I can use one action for all SST workflows

#### FR2: SST Deploy Operation
- **Requirement:** Execute `sst deploy` with comprehensive output parsing
- **Outputs:** Success status, resource changes, deployed URLs, app info, completion status
- **Integration:** PR comments, workflow summaries, artifact uploads
- **User Story:** As a developer, I want to deploy to staging on every PR so I can test changes

#### FR3: SST Diff Operation
- **Requirement:** Execute `sst diff` to preview infrastructure changes
- **Outputs:** Planned changes summary, resource diffs, change categories
- **Integration:** PR comments showing what will be deployed
- **User Story:** As a developer, I want to see infrastructure changes in PR comments so I can review impact before deployment

#### FR4: SST Remove Operation
- **Requirement:** Execute `sst remove` to tear down infrastructure
- **Outputs:** Removed resources, cleanup status, completion summary
- **Integration:** Comments confirming successful cleanup
- **User Story:** As a developer, I want to automatically remove staging resources when PR is closed so we don't accumulate costs

#### FR5: Unified Output Format
- **Requirement:** Consistent output structure across all operations
- **Implementation:** Common base types with operation-specific extensions
- **Validation:** Type-safe outputs using TypeScript definitions
- **User Story:** As a DevOps engineer, I want predictable action outputs so I can build reliable workflows

#### FR6: Enhanced Error Handling
- **Requirement:** Graceful handling of SST CLI failures and edge cases
- **Implementation:** Operation-specific error categorization and messaging
- **Recovery:** Partial success handling and retry recommendations
- **User Story:** As a developer, I want clear error messages when deployments fail so I can quickly resolve issues

### Non-Functional Requirements

#### NFR1: Performance
- **Bundle Size:** Optimized single-file distribution < 10MB
- **Execution Time:** No regression from current composite action performance
- **Memory Usage:** Efficient parsing and processing of large SST outputs

#### NFR2: Maintainability
- **Code Complexity:** Low cyclomatic complexity, well-documented functions
- **Test Coverage:** >90% code coverage with unit and integration tests
- **Developer Experience:** Modern tooling with fast feedback loops

#### NFR3: Reliability
- **Error Rate:** Zero functional errors in production usage
- **Robustness:** Handle malformed SST outputs and network issues gracefully
- **Consistency:** Deterministic behavior across different environments

#### NFR4: Distribution & Migration
- **Reusability:** Single source of truth for all SST operations, replacing multiple composite actions
- **Versioning:** Semantic versioning with clear upgrade paths from composite action implementations
- **Documentation:** Comprehensive README with usage examples and migration guide from monorepo composite actions
- **Backward Compatibility:** Maintain functional compatibility with existing workflows using composite actions

### API Requirements

#### Action Inputs
```yaml
inputs:
  operation:
    description: "SST operation to perform (deploy, diff, remove)"
    required: false
    default: "deploy"
    # Validation: Must be one of ['deploy', 'diff', 'remove']

  token:
    description: "GitHub token for authentication"
    required: true
    # Used for PR comments and artifact uploads

  stage:
    description: "SST stage to operate on"
    required: true
    # Passed directly to SST CLI commands

  comment-mode:
    description: "When to post PR comments (always, on-success, on-failure, never)"
    required: false
    default: "on-success"
    # Controls PR comment behavior across all operations

  fail-on-error:
    description: "Whether to fail the action when SST operation fails"
    required: false
    default: "true"
    # Allows workflows to continue on operation failure

  max-output-size:
    description: "Maximum output size before truncation (bytes)"
    required: false
    default: "50000"
    # Prevents excessive log output, saves full output as artifact
```

#### Action Outputs
```yaml
outputs:
  success:
    description: "Whether SST operation completed successfully"
    # Boolean: true/false

  operation:
    description: "The operation that was performed"
    # String: deploy/diff/remove

  stage:
    description: "The stage that was operated on"
    # String: matches input stage

  resource_changes:
    description: "Number of resource changes made (deploy/remove only)"
    # Integer: count of modified resources

  urls:
    description: "JSON array of deployed URLs (deploy only)"
    # JSON: [{"name": "api", "url": "https://...", "type": "api"}]

  app:
    description: "The SST app name"
    # String: extracted from SST output

  completion_status:
    description: "Operation completion status (complete, partial, failed)"
    # String: categorical status

  permalink:
    description: "SST Console permalink for operation details"
    # String: URL to SST Console

  truncated:
    description: "Whether the operation output was truncated"
    # Boolean: indicates if full output saved as artifact

  diff_summary:
    description: "Summary of planned changes (diff only)"
    # String: human-readable change summary
```

### Infrastructure Requirements

#### Development Infrastructure
- **GitHub Repository:** New standalone repository for the action
- **CI/CD Pipeline:** GitHub Actions workflow for testing and releases
- **Distribution:** Committed `dist/` directory for action distribution
- **Documentation:** GitHub Pages for comprehensive documentation

#### Runtime Requirements
- **Execution Environment:** GitHub Actions runners (ubuntu-latest)
- **Node.js Version:** Node.js 20.x for action execution
- **Dependencies:** Bundled with action, no external runtime dependencies
- **Permissions:** Standard GitHub token permissions for comments and artifacts

---

## Implementation Guidelines

### Code Conventions

#### Project Structure
```typescript
// src/main.ts - Entry point following GitHub Actions patterns
import * as core from '@actions/core';
import * as github from '@actions/github';
import { executeOperation } from './operations';

async function run(): Promise<void> {
  try {
    const operation = core.getInput('operation') || 'deploy';
    const result = await executeOperation(operation, {
      stage: core.getInput('stage'),
      token: core.getInput('token'),
      commentMode: core.getInput('comment-mode'),
      failOnError: core.getInput('fail-on-error') === 'true',
      maxOutputSize: parseInt(core.getInput('max-output-size'))
    });

    // Set outputs using GitHub Actions toolkit
    core.setOutput('success', result.success);
    core.setOutput('operation', result.operation);
    // ... additional outputs

    if (!result.success && result.failOnError) {
      core.setFailed(`SST ${operation} failed: ${result.error}`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

if (require.main === module) {
  run();
}
```

#### Type Safety Patterns
```typescript
// src/types/operations.ts
export type SSTOperation = 'deploy' | 'diff' | 'remove';

export interface OperationResult {
  success: boolean;
  operation: SSTOperation;
  stage: string;
  outputs: Record<string, string>;
  artifacts?: string[];
  error?: string;
}

// src/operations/base.ts
export abstract class BaseOperation {
  abstract execute(options: OperationOptions): Promise<OperationResult>;

  protected async runSST(command: string[]): Promise<{output: string, exitCode: number}> {
    // Common SST CLI execution logic
  }
}
```

#### Parser Implementation
```typescript
// src/parsers/base-parser.ts
export abstract class BaseParser {
  protected readonly patterns = {
    // Common regex patterns for SST output
    APP_INFO: /^App:\s+(.+)$/,
    STAGE_INFO: /^Stage:\s+(.+)$/,
    // ... shared patterns
  };

  abstract parse(output: string): ParsedResult;
}

// src/parsers/deploy-parser.ts
export class DeployParser extends BaseParser {
  parse(output: string): DeployResult {
    // Migrate existing logic from .github/actions/sst-deploy/src/parser.ts
    // Enhanced with better error handling and type safety
  }
}
```

### Testing Requirements

#### Unit Tests Structure
```typescript
// __tests__/operations/deploy.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DeployOperation } from '../../src/operations/deploy';

describe('DeployOperation', () => {
  it('should parse successful deployment output', async () => {
    const mockOutput = `
      App: my-app
      Stage: staging
      | Created   Function     my-function
      ✓ Complete
    `;

    const operation = new DeployOperation();
    vi.spyOn(operation, 'runSST').mockResolvedValue({
      output: mockOutput,
      exitCode: 0
    });

    const result = await operation.execute({
      stage: 'staging',
      // ... other options
    });

    expect(result.success).toBe(true);
    expect(result.outputs.app).toBe('my-app');
  });
});
```

#### Integration Tests
```typescript
// __tests__/integration/action.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Action Integration', () => {
  it('should execute deploy operation via CLI', () => {
    // Test the bundled action with real inputs
    const result = execSync('node dist/main.js', {
      env: {
        ...process.env,
        'INPUT_OPERATION': 'deploy',
        'INPUT_STAGE': 'test',
        'INPUT_TOKEN': 'fake-token'
      }
    });

    expect(result.toString()).toContain('SST deploy completed');
  });
});
```

#### Mock Utilities
```typescript
// __tests__/fixtures/sst-outputs.ts
export const DEPLOY_SUCCESS_OUTPUT = `
App: scratch
Stage: staging
| Created   Function     SSTAppApiHandler
| Created   Route        ApiRoute
✓ Complete
↗ Permalink https://console.sst.dev/...
`;

export const DIFF_OUTPUT = `
App: scratch
Stage: staging
| Created   Function     NewFunction
| Updated   Route        ApiRoute
| Deleted   Function     OldFunction
`;
```

### Quality Checklist

#### Pre-Development
- [ ] Repository structure follows GitHub Action standards
- [ ] TypeScript configuration matches project standards
- [ ] Biome configuration for consistent formatting
- [ ] Vitest setup with coverage reporting
- [ ] CI pipeline for automated testing

#### Development Phase
- [ ] Code passes `bun run typecheck`
- [ ] Code passes `bunx @biomejs/biome check`
- [ ] All tests pass (`bun test`)
- [ ] Coverage above 90% (`bun run test:coverage`)
- [ ] Bundle size within limits (`bun run build`)

#### Pre-Release
- [ ] Integration tests pass with real SST projects
- [ ] Documentation complete and accurate
- [ ] Migration guide from composite action
- [ ] Semantic versioning strategy defined
- [ ] Release automation configured

---

## Success Criteria

### Definition of Done

#### Functional Completeness
- [ ] All three operations (deploy, diff, remove) implemented and tested
- [ ] Output parsing maintains compatibility with existing workflows
- [ ] PR comment and summary generation works across all operations
- [ ] Error handling provides actionable feedback
- [ ] Artifact upload preserves debugging information

#### Quality Standards
- [ ] >90% test coverage with comprehensive edge case handling
- [ ] Zero linting/formatting violations using Biome
- [ ] All TypeScript errors resolved with strict configuration
- [ ] Performance equal or better than current composite actions
- [ ] Bundle size optimized for fast action startup

#### Developer Experience
- [ ] Clear documentation with usage examples for all operations
- [ ] Migration guide from existing composite actions
- [ ] Local development setup with fast feedback loops
- [ ] Automated release process with semantic versioning

#### Production Readiness
- [ ] Successfully tested in 2 existing projects
- [ ] No functional errors in production workflows
- [ ] Rollback plan documented and tested
- [ ] Community distribution preparation complete

### Acceptance Criteria

#### AC1: Multi-Operation Functionality
**Given** a workflow using the new action
**When** I specify `operation: 'diff'`
**Then** the action executes `sst diff` and provides diff-specific outputs
**And** PR comments show planned infrastructure changes
**And** no deployment occurs

#### AC2: Migration Compatibility
**Given** an existing workflow using composite actions from the monorepo (sst-deploy, sst-diff, etc.)
**When** I replace them with the new unified action using appropriate operation parameters
**Then** all functionality works identically to the original composite actions
**And** outputs are compatible with downstream steps
**And** PR comments maintain the same format and content
**And** no workflow changes are required beyond switching the action reference and adding operation parameter

#### AC3: Error Handling
**Given** an SST operation fails
**When** the action executes with `fail-on-error: false`
**Then** the workflow continues without failing
**And** error details are captured in outputs
**And** artifacts contain full debugging information

#### AC4: Developer Satisfaction
**Given** developers using the action across multiple projects
**When** they provide feedback after 2 weeks of usage
**Then** >80% report improved developer experience
**And** Zero reports of functional errors
**And** Reduced workflow complexity cited as benefit

### Rollback Plan

#### Immediate Rollback (< 24 hours)
1. **Revert Workflow Changes:** Update workflows to reference original composite actions in the monorepo
2. **Preserve Artifacts:** Ensure any generated artifacts remain accessible
3. **Communication:** Notify all users via internal channels about reverting to composite action implementations
4. **Analysis:** Document issues for future iteration and improvement of the standalone action

#### Long-term Recovery (> 24 hours)
1. **Issue Triage:** Categorize problems (functional vs. performance vs. usability)
2. **Hotfix Release:** Address critical functional issues
3. **Gradual Re-rollout:** Test fixes in staging environments
4. **Post-mortem:** Conduct review to improve future releases

---

## References

### Critical Files for Migration
- **Source Composite Actions (from monorepo):**
  - `.github/actions/sst-deploy/` - Primary deployment functionality to replicate and enhance
  - `.github/actions/sst-diff/` - Diff functionality to integrate into unified action
  - `.github/actions/sst-remove/` - Remove functionality (if exists) or implement from scratch
- **Monorepo Standards to Maintain:**
  - Development guidelines and tooling preferences from original composite actions
  - Code formatting and quality standards
  - Testing patterns and coverage requirements
- **Standalone Action Standards:**
  - `CLAUDE.md` - Development guidelines specific to this standalone action
  - `biome.jsonc` - Code formatting standards adapted for standalone distribution
  - `package.json` - Independent package configuration for GitHub Action distribution

### External Documentation
- **GitHub Actions:**
  - [Creating TypeScript Actions](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action)
  - [Action Toolkit](https://github.com/actions/toolkit)
- **Build Tools:**
  - [Bun Bundler](https://bun.sh/docs/bundler)
  - [Biome Configuration](https://biomejs.dev/reference/configuration/)
  - [Vitest Testing](https://vitest.dev/guide/)
- **SST Framework:**
  - [SST CLI Reference](https://docs.sst.dev/reference/cli/)
  - [SST Deploy Output Format](https://docs.sst.dev/concepts/deployment/)

### Implementation Patterns
- **Action Structure:** Follow GitHub's [TypeScript Action Template](https://github.com/actions/typescript-action) for standalone distribution
- **Code Organization:** Extract and consolidate patterns from existing monorepo composite actions while improving maintainability
- **Testing Strategy:** Maintain testing quality standards from the original monorepo while adapting to standalone structure
- **Distribution:** Standard GitHub Actions distribution with committed `dist/` for independent consumption
- **Migration Strategy:** Preserve functional behavior while improving implementation quality and reusability

---

*This PRD defines the complete requirements for extracting and modernizing SST operations from a monorepo's composite actions into a single, standalone, reusable TypeScript GitHub Action. This transformation from monorepo composite actions to a distributed standalone action improves maintainability, reusability, and developer experience while preserving all existing functionality and maintaining the high quality standards established in the original implementations.*
