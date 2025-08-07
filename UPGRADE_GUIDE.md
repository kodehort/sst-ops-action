# Upgrade Guide

This guide provides step-by-step instructions for upgrading between major versions of the SST Operations Action, including breaking changes, migration steps, and compatibility considerations.

## Quick Navigation

- [Current Version: v1.x](#current-version-v1x)
- [Upcoming: v2.0 (Preview)](#upcoming-v20-preview)
- [General Upgrade Process](#general-upgrade-process)
- [Common Patterns](#common-migration-patterns)
- [Troubleshooting](#troubleshooting)
- [Support and Resources](#support-and-resources)

---

## Current Version: v1.x

**Latest Stable:** v1.0.0  
**Support Status:** ✅ Full support with new features and bug fixes  
**End-of-Life:** No planned EOL (current major version)

### v1.x Feature Set
- ✅ Deploy operation (`sst deploy`)
- ✅ Diff operation (`sst diff`) 
- ✅ Remove operation (`sst remove`)
- ✅ GitHub PR comments and workflow summaries
- ✅ Comprehensive error handling and artifacts
- ✅ Production-optimized build system
- ✅ Automated release pipeline

### Staying on v1.x

**Recommended Usage:**
```yaml
# Automatic updates within v1.x (recommended)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}

# Pin to specific v1.x version (conservative)
- uses: kodehort/sst-operations-action@v1.0.0
```

**Update Strategy for v1.x:**
- Minor and patch updates are automatic when using `@v1`
- No breaking changes within v1.x versions
- All existing workflows continue to work
- Regular security updates and bug fixes

---

## Upcoming: v2.0 (Preview)

> **⚠️ Note:** v2.0 is not yet released. This section provides advance notice of planned changes.

**Planned Release:** TBD (when sufficient breaking changes justify major version)  
**Breaking Changes:** TBD (will be documented here when planned)  
**Beta Timeline:** 6-month advance notice before breaking changes

### Potential v2.0 Changes (Under Consideration)

**These are potential changes being considered for v2.0. None are confirmed:**

#### Input/Output Format Changes
```yaml
# v1.x (current)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    comment-mode: on-success
    fail-on-error: true

# v2.0 (potential)  
- uses: kodehort/sst-operations-action@v2
  with:
    operation: deploy
    comment: on-success      # renamed
    fail-on-error: true      # unchanged
```

#### Output Format Enhancements
```yaml
# v1.x outputs (current)
- success: "true" | "false"
- urls: '["url1", "url2"]'  # JSON string

# v2.0 outputs (potential)
- success: "true" | "false"  # unchanged
- urls: '{"web": "url1", "api": "url2"}'  # enhanced format
```

**Migration Timeline (When v2.0 is Planned):**
1. **6 months before v2.0:** Deprecation warnings added to v1.x
2. **3 months before v2.0:** Beta releases available for testing
3. **1 month before v2.0:** Release candidate with final API
4. **v2.0 Release:** Stable version available
5. **12 months after v2.0:** v1.x enters security-only mode
6. **18 months after v2.0:** v1.x end-of-life

---

## General Upgrade Process

### 1. Check Current Version
```bash
# In your workflow, check which version you're using
grep -r "sst-operations-action@" .github/workflows/
```

### 2. Review Breaking Changes
- Read the [CHANGELOG.md](CHANGELOG.md) for your target version
- Check this guide for migration steps
- Review the [VERSIONING_POLICY.md](VERSIONING_POLICY.md) for compatibility guarantees

### 3. Test in Non-Production
```yaml
# Create a test workflow to validate changes
name: Test New Version
on:
  workflow_dispatch:

jobs:
  test-upgrade:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-operations-action@v2  # New version
        with:
          operation: diff  # Use diff to test without deploying
          stage: test
          token: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Update Production Workflows
```yaml
# Update your production workflows
- uses: kodehort/sst-operations-action@v1
+ uses: kodehort/sst-operations-action@v2
```

### 5. Monitor and Rollback if Needed
```yaml
# Keep rollback option available
- uses: kodehort/sst-operations-action@v1.2.3  # Previous working version
```

---

## Common Migration Patterns

### Pattern 1: Version Pinning Strategy

**Conservative (Pin to Specific Versions):**
```yaml
# Pin to exact version for maximum stability
- uses: kodehort/sst-operations-action@v1.0.0
  with:
    operation: deploy
    stage: production
```

**Balanced (Major Version Branch):**
```yaml
# Get updates within major version automatically
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
```

**Aggressive (Always Latest):**
```yaml
# Always use latest (not recommended for production)
- uses: kodehort/sst-operations-action@main
  with:
    operation: deploy
    stage: production
```

### Pattern 2: Gradual Migration

**Step 1: Parallel Testing**
```yaml
jobs:
  test-current:
    name: Test Current Version
    runs-on: ubuntu-latest
    steps:
      - uses: kodehort/sst-operations-action@v1
        with:
          operation: diff
          stage: test-v1
          
  test-new:
    name: Test New Version
    runs-on: ubuntu-latest
    steps:
      - uses: kodehort/sst-operations-action@v2
        with:
          operation: diff
          stage: test-v2
```

**Step 2: Feature-by-Feature Migration**
```yaml
# Migrate operations one by one
deploy:
  steps:
    - uses: kodehort/sst-operations-action@v1  # Keep stable
      with:
        operation: deploy
        
diff:
  steps:
    - uses: kodehort/sst-operations-action@v2  # Test new version
      with:
        operation: diff
```

### Pattern 3: Environment-Based Rollout

**Different Versions by Environment:**
```yaml
deploy-staging:
  if: github.ref == 'refs/heads/develop'
  steps:
    - uses: kodehort/sst-operations-action@v2  # Test new version in staging
      with:
        operation: deploy
        stage: staging

deploy-production:
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: kodehort/sst-operations-action@v1  # Keep stable in production
      with:
        operation: deploy
        stage: production
```

---

## Breaking Change Examples

> **Note:** These are examples of the types of breaking changes that would require major version bumps.

### Example 1: Input Parameter Changes

**Breaking Change:** Rename `comment-mode` to `comment`

**v1.x (Before):**
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    comment-mode: on-success
```

**v2.0 (After):**
```yaml
- uses: kodehort/sst-operations-action@v2
  with:
    comment: on-success  # renamed parameter
```

**Migration Steps:**
1. Update all workflow files
2. Search and replace `comment-mode` with `comment`
3. Test in non-production environment
4. Deploy to production

### Example 2: Output Format Changes

**Breaking Change:** Change boolean outputs from boolean to string

**v1.x Workflow (Before):**
```yaml
steps:
  - id: sst
    uses: kodehort/sst-operations-action@v1
  - if: steps.sst.outputs.success == true
    run: echo "Success!"
```

**v2.0 Workflow (After):**
```yaml
steps:
  - id: sst
    uses: kodehort/sst-operations-action@v2
  - if: steps.sst.outputs.success == 'true'  # Now string comparison
    run: echo "Success!"
```

**Migration Steps:**
1. Find all output comparisons: `grep -r "outputs\.success" .github/`
2. Update boolean comparisons to string comparisons
3. Test conditional logic
4. Validate workflow behavior

### Example 3: Operation Behavior Changes

**Breaking Change:** Diff operation now requires explicit stage confirmation

**v1.x (Before):**
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    stage: production  # Works automatically
```

**v2.0 (After):**
```yaml
- uses: kodehort/sst-operations-action@v2
  with:
    operation: diff
    stage: production
    confirm-stage: true  # New required parameter for production
```

**Migration Steps:**
1. Add `confirm-stage: true` for production diffs
2. Review stage naming conventions
3. Update documentation and team procedures

---

## Version-Specific Upgrade Guides

### From v0.x (Beta) to v1.0

> **Historical Reference:** For users who were on early beta versions

**Major Changes:**
- Stable API introduced
- All operations (deploy/diff/remove) finalized
- Production-ready error handling
- Comprehensive GitHub integration

**Migration Required:**
- Update to stable input/output format
- Review error handling patterns
- Update documentation references

---

## Troubleshooting

### Common Upgrade Issues

#### Issue: "Unknown input" errors after upgrade
**Cause:** Using old input parameter names  
**Solution:** Check changelog for renamed parameters  
```yaml
# Error
- uses: kodehort/sst-operations-action@v2
  with:
    comment-mode: always  # Old parameter name

# Fix
- uses: kodehort/sst-operations-action@v2
  with:
    comment: always  # New parameter name
```

#### Issue: Workflow step conditions not working
**Cause:** Output format changes  
**Solution:** Update condition syntax  
```yaml
# Old (might break)
- if: steps.sst.outputs.success == true

# New (safe)
- if: steps.sst.outputs.success == 'true'
```

#### Issue: Action not found or import errors
**Cause:** Version doesn't exist or network issues  
**Solution:** Verify version exists and check network  
```bash
# Check available versions
gh release list --repo kodehort/sst-operations-action

# Verify specific version exists
gh release view v2.0.0 --repo kodehort/sst-operations-action
```

### Rollback Procedures

#### Quick Rollback
```yaml
# Change version back to previous working version
- uses: kodehort/sst-operations-action@v1.2.3  # Last known good
  with:
    operation: deploy
    stage: production
```

#### Systematic Rollback
1. Identify last working version from git history
2. Create rollback PR with version change
3. Test rollback in staging environment
4. Deploy rollback to production
5. Document issues encountered for future reference

### Getting Help

#### Self-Service Resources
- 📖 [README.md](README.md) - Usage examples and API reference
- 📋 [CHANGELOG.md](CHANGELOG.md) - Detailed version history
- 🐛 [GitHub Issues](https://github.com/kodehort/sst-operations-action/issues) - Known issues and solutions
- 💬 [GitHub Discussions](https://github.com/kodehort/sst-operations-action/discussions) - Community support

#### Creating Support Issues
When creating issues, include:
- Current version and target version
- Complete workflow YAML
- Error messages and logs
- Steps to reproduce
- Environment details (OS, Node.js version, etc.)

**Issue Template:**
```markdown
## Upgrade Issue

**Current Version:** v1.2.3
**Target Version:** v2.0.0
**Environment:** ubuntu-latest, Node.js 20

### Problem Description
Brief description of what's not working

### Workflow YAML
```yaml
# Your workflow here
```

### Error Messages
```
# Error output here
```

### Steps to Reproduce
1. Step one
2. Step two
3. Step three
```

---

## Support and Resources

### Version Support Matrix

| Version | Status | Support Level | End-of-Life |
|---------|--------|---------------|-------------|
| v1.x | ✅ Current | Full support | No planned EOL |
| v0.x | 🚫 Deprecated | None | Ended |

### Support Levels

**Full Support:**
- ✅ New features and enhancements
- ✅ Bug fixes and security patches
- ✅ Documentation updates
- ✅ Community support

**Security-Only Support:**
- ✅ Security vulnerability fixes
- ❌ No new features
- ❌ No bug fixes (unless security-related)
- ⚠️ Limited documentation updates

**End-of-Life:**
- ❌ No updates of any kind
- ❌ No official support
- ⚠️ Community support may still be available

### Migration Assistance

**Professional Services:**
For teams requiring dedicated migration assistance, consider:
- Architecture review for upgrade planning
- Custom migration tooling development
- Training and knowledge transfer
- Post-migration monitoring and support

**Community Resources:**
- GitHub Discussions for peer support
- Example repositories with migration patterns
- Community-contributed migration scripts

---

This upgrade guide will be updated with each major version release to provide the most current migration information and support resources.