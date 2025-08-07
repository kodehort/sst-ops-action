# Semantic Versioning Policy

This document defines the versioning strategy and policy for the SST Operations Action, ensuring predictable and reliable releases for consumers.

## Overview

The SST Operations Action follows [Semantic Versioning 2.0.0](https://semver.org/) with conventional commit-based automation for version determination.

## Version Format

```
vMAJOR.MINOR.PATCH[-PRERELEASE][+BUILDMETADATA]
```

### Examples:
- `v1.0.0` - Initial stable release
- `v1.1.0` - New feature release
- `v1.1.1` - Bug fix release
- `v2.0.0` - Breaking change release
- `v2.0.0-beta.1` - Pre-release version

## Version Components

### MAJOR Version (Breaking Changes)

**Increment when:** Making incompatible API changes

**Triggers:**
- Changes to action inputs/outputs that break existing workflows
- Removal of supported operations
- Changes to output format that break downstream processing
- Minimum Node.js version requirements change
- SST CLI version requirements that break compatibility

**Conventional Commit Indicators:**
```bash
feat!: change operation input format
fix!: remove deprecated output field
chore!: upgrade to Node.js 22 minimum

# OR with footer
feat: add new operation type

BREAKING CHANGE: removed 'legacy-mode' input parameter
```

**Examples of Breaking Changes:**
- Removing an input parameter
- Changing output format from string to JSON
- Renaming operation types ('deploy' → 'stack-deploy')
- Removing backward compatibility features

### MINOR Version (New Features)

**Increment when:** Adding functionality in a backwards compatible manner

**Triggers:**
- New operation types (while maintaining existing ones)
- New input parameters with sensible defaults
- New output fields (additive only)
- Enhanced error handling that improves user experience
- Performance improvements

**Conventional Commit Indicators:**
```bash
feat: add remove operation support
feat: add detailed error reporting in outputs
feat: support custom timeout configuration
```

**Examples of New Features:**
- Adding `remove` operation alongside `deploy` and `diff`
- Adding `timeout` input parameter with default value
- Adding `error_details` output field
- Enhanced GitHub comment formatting

### PATCH Version (Bug Fixes)

**Increment when:** Making backwards compatible bug fixes

**Triggers:**
- Fixing incorrect behavior without changing interface
- Security vulnerability fixes
- Documentation corrections
- Internal refactoring without API changes
- Dependency updates that don't affect functionality

**Conventional Commit Indicators:**
```bash
fix: handle timeout errors correctly
fix: resolve parsing issue with large outputs
docs: correct usage examples in README
chore: update dependencies for security
```

**Examples of Bug Fixes:**
- Fixing output parsing for edge cases
- Correcting error handling in timeout scenarios
- Fixing GitHub comment formatting issues
- Security patches

## Branch Strategy

### Main Branch
- **Purpose:** Development and integration
- **Protection:** Requires PR reviews and passing CI
- **Releases:** Never released directly from main

### Major Version Branches
- **Format:** `v1`, `v2`, `v3`, etc.
- **Purpose:** Consumer-facing stable branches
- **Updates:** Automatically updated to latest MINOR/PATCH within major version
- **Protection:** Force-push allowed only by release automation

### Release Tags
- **Format:** `v1.0.0`, `v1.1.0`, `v2.0.0`, etc.
- **Purpose:** Specific version references
- **Immutability:** Never modified after creation
- **Distribution:** Include committed `dist/` directory

## Usage Patterns

### For End Users (Recommended)
```yaml
# Automatic updates within major version (recommended)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production

# Specific version pinning (conservative)
- uses: kodehort/sst-operations-action@v1.2.3
  with:
    operation: deploy
    stage: production
```

### For Development/Testing
```yaml
# Pre-release versions
- uses: kodehort/sst-operations-action@v2.0.0-beta.1

# Development branch (not recommended for production)
- uses: kodehort/sst-operations-action@main
```

## Release Automation

### Trigger Conditions

#### Automatic Releases (Push to Main)
- **When:** Commits with conventional format pushed to main
- **Process:** Analyze commits → Determine version → Create release
- **Version:** Based on commit messages since last release

#### Manual Releases (Workflow Dispatch)
- **When:** Manual trigger with version override
- **Process:** Manual version selection → Create release
- **Use Cases:** Emergency releases, hotfixes, custom versioning

### Release Process

1. **Version Analysis**
   - Parse conventional commits since last release
   - Determine version bump type (major/minor/patch)
   - Calculate new version number

2. **Quality Gates**
   - Full test suite execution
   - Linting and type checking
   - Bundle size validation (<10MB)
   - Build integrity verification

3. **Release Creation**
   - Update package.json version
   - Generate detailed changelog
   - Create GitHub release with notes
   - Update major version branch
   - Validate release integrity

4. **Rollback (if needed)**
   - Delete failed release
   - Remove tags
   - Restore previous state

## Backward Compatibility

### Compatibility Guarantees

**Within Major Versions:**
- All existing inputs continue to work
- All existing outputs maintain format
- All operation types remain functional
- No breaking changes to workflow integration

**Across Major Versions:**
- Breaking changes are documented in upgrade guide
- Migration assistance provided for common patterns
- Deprecation notices provided 6 months in advance

### Support Policy

**Major Version Support:**
- **Current Major (v2):** Full support with new features and bug fixes
- **Previous Major (v1):** Security fixes and critical bug fixes for 12 months
- **Older Majors:** Security fixes only for 6 months after deprecation

**End-of-Life Process:**
1. **Month 0:** New major version released
2. **Month 6:** Previous major marked as deprecated with warnings
3. **Month 12:** Previous major enters security-only mode
4. **Month 18:** End of life, no further updates

## Breaking Change Guidelines

### When Breaking Changes Are Acceptable

**Major Release Required:**
- Removing any public API (inputs, outputs, operations)
- Changing existing behavior that consumers depend on
- Requiring new dependencies or environment changes
- Changing minimum system requirements

### How to Introduce Breaking Changes

1. **Deprecation Phase (Previous Major)**
   ```yaml
   # Add warnings for deprecated features
   - name: Warn about legacy usage
     run: echo "::warning::input 'legacy-mode' is deprecated, use 'mode' instead"
   ```

2. **Transition Phase (Pre-release)**
   ```yaml
   # Provide both old and new ways
   inputs:
     mode: # new parameter
     legacy-mode: # old parameter, still works
   ```

3. **Breaking Phase (New Major)**
   ```yaml
   # Remove deprecated features
   inputs:
     mode: # only new parameter
   ```

### Breaking Change Documentation

**Required Documentation:**
- **CHANGELOG.md:** Detailed list of breaking changes
- **MIGRATION.md:** Step-by-step upgrade guide
- **README.md:** Updated examples with new syntax
- **GitHub Release:** Breaking change highlights

**Migration Guide Template:**
```markdown
## Migrating from v1 to v2

### Breaking Changes

#### Input Parameter Changes
- `legacy-mode` → `mode`
- `old-param` → `new-param`

#### Output Format Changes
- `success`: boolean → string ("true"/"false")

### Migration Steps

1. Update your workflow file:
   ```diff
   - uses: kodehort/sst-operations-action@v1
   + uses: kodehort/sst-operations-action@v2
     with:
   -   legacy-mode: advanced
   +   mode: advanced
   ```

2. Update output handling:
   ```diff
   - if: steps.sst.outputs.success == true
   + if: steps.sst.outputs.success == 'true'
   ```
```

## Pre-release Versions

### When to Use Pre-releases

**Beta Releases (v2.0.0-beta.1):**
- Major version candidates
- Breaking change testing
- Community feedback gathering
- Feature completeness validation

**Alpha Releases (v2.0.0-alpha.1):**
- Experimental features
- Internal testing
- API design validation
- Early adopter feedback

**Release Candidates (v2.0.0-rc.1):**
- Final testing before stable
- No new features, only bug fixes
- Production-ready candidates
- Final validation phase

### Pre-release Guidelines

**Beta Release Criteria:**
- All planned features implemented
- Major bugs resolved
- Documentation updated
- Migration guide available

**RC Release Criteria:**
- No known critical bugs
- Performance benchmarks met
- Security review completed
- Ready for production use

## Version Communication

### Release Notes Template

```markdown
# Release v1.2.0

**Release Date:** 2025-08-07
**Previous Version:** v1.1.0

## 🚀 What's New

### ✨ Features
- Add timeout configuration support (#123)
- Enhanced error reporting with detailed messages (#124)

### 🐛 Bug Fixes
- Fix parsing issue with large SST outputs (#125)
- Resolve timeout handling in remove operations (#126)

### 🔧 Improvements & Maintenance
- Update dependencies for security patches (#127)
- Improve bundle size optimization (#128)

## 📦 Bundle Information
- **Bundle Size:** 2.1MB (21% of 10MB limit)
- **Build Duration:** 89ms
- **Target:** Node.js 20+

## 🚀 Usage
```yaml
- uses: kodehort/sst-operations-action@v1.2.0
  # or use @v1 for automatic updates
```

## Migration Guide
No breaking changes in this release. All v1.x workflows continue to work without modification.
```

### Communication Channels

**GitHub Releases:**
- Detailed release notes
- Breaking change highlights
- Migration guidance
- Download assets

**README.md:**
- Latest version examples
- Current feature set
- Quick start guide

**CHANGELOG.md:**
- Historical version changes
- Searchable change history
- Detailed technical changes

## Validation and Testing

### Pre-release Validation

**Automated Tests:**
- Full test suite (>90% coverage)
- Integration tests with real SST projects
- Performance benchmarks
- Security vulnerability scans

**Manual Validation:**
- Real workflow testing in 2+ projects
- Breaking change impact assessment
- Documentation accuracy review
- User experience validation

### Release Validation

**Post-release Checks:**
- Major version branch correctly updated
- Action executes in GitHub Actions environment
- All outputs function as documented
- No regression in supported workflows

**Rollback Triggers:**
- Critical functionality broken
- Security vulnerability introduced
- Major performance regression
- Widespread user-reported issues

## Examples and Use Cases

### Stable Production Usage
```yaml
name: Production Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-operations-action@v1  # Latest v1.x
        with:
          operation: deploy
          stage: production
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Conservative Version Pinning
```yaml
name: Critical Infrastructure
on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-operations-action@v1.2.3  # Specific version
        with:
          operation: deploy
          stage: production
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Beta Testing
```yaml
name: Beta Testing
on:
  push:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-operations-action@v2.0.0-beta.1
        with:
          operation: diff
          stage: staging
          token: ${{ secrets.GITHUB_TOKEN }}
```

---

This versioning policy ensures predictable, reliable releases while maintaining flexibility for different consumer needs. All version changes follow these guidelines to provide a consistent experience for action consumers.