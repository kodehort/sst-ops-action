# Backward Compatibility Policy

This document defines the backward compatibility commitments, support lifecycle, and deprecation procedures for the SST Operations Action to ensure predictable upgrade paths and stable integration for consumers.

## Overview

The SST Operations Action is committed to maintaining backward compatibility within major versions while providing clear migration paths for breaking changes across major versions.

## Compatibility Commitments

### Within Major Versions (v1.x → v1.y)

**✅ Guaranteed Compatible:**
- All existing input parameters continue to work
- All existing output fields maintain format and behavior
- All operation types (`deploy`, `diff`, `remove`) remain functional
- Workflow integration patterns continue to work
- Error handling behavior remains consistent
- GitHub Actions environment compatibility maintained

**✅ Additive Changes Allowed:**
- New optional input parameters (with sensible defaults)
- New output fields (additional to existing ones)
- Enhanced error messages and debugging information
- Performance improvements
- New operation types (alongside existing ones)

**❌ Breaking Changes Prohibited:**
- Removing input parameters
- Changing output field formats or types
- Removing operation types
- Changing error handling behavior that breaks workflows
- Requiring new environment dependencies

### Across Major Versions (v1.x → v2.x)

**Breaking Changes Allowed:**
- Input parameter changes (rename, remove, format changes)
- Output format modifications
- Operation behavior changes
- Minimum system requirement updates
- Dependency requirement changes

**Migration Support Provided:**
- Detailed upgrade documentation
- 6-month advance deprecation notices
- Migration tools and scripts where applicable
- Community support during transition period

## Support Lifecycle

### Major Version Support Tiers

#### Current Major Version (v1.x)
- **Status:** ✅ Full Support
- **Duration:** Ongoing (no planned end-of-life)
- **Includes:**
  - New feature development
  - Bug fixes and performance improvements
  - Security vulnerability patches
  - Documentation updates
  - Full community support
  - Compatibility guarantee maintenance

#### Previous Major Version (After v2.0 is released)
- **Status:** 🔄 Maintenance Mode
- **Duration:** 12 months after next major version release
- **Includes:**
  - Critical bug fixes
  - Security vulnerability patches
  - Limited documentation updates
  - Community support (no dedicated development)
  - No new features

#### Legacy Major Version (18+ months old)
- **Status:** 🚫 Security-Only Mode
- **Duration:** 6 months after entering maintenance mode
- **Includes:**
  - Security vulnerability patches only
  - No bug fixes (unless security-related)
  - No documentation updates
  - Community support only
  - No compatibility guarantees

#### End-of-Life Major Version (24+ months old)
- **Status:** ❌ End-of-Life
- **Duration:** Permanent
- **Includes:**
  - No updates of any kind
  - No official support
  - May still work but no guarantees
  - Community support may be available

### Support Timeline Example

```
v1.0.0 Released: 2025-01-01
├── v1.x: Full Support (ongoing)
│
v2.0.0 Released: 2026-01-01 (hypothetical)
├── v2.x: Full Support (ongoing)
├── v1.x: Maintenance Mode (until 2027-01-01)
│
v3.0.0 Released: 2027-01-01 (hypothetical)
├── v3.x: Full Support (ongoing)
├── v2.x: Maintenance Mode (until 2028-01-01)
├── v1.x: Security-Only Mode (until 2027-07-01)
│
2027-07-01: v1.x End-of-Life
2028-01-01: v2.x enters Security-Only Mode
```

## Deprecation Process

### Deprecation Phases

#### Phase 1: Deprecation Notice (6 months before breaking change)
- **Actions Taken:**
  - Add deprecation warnings to action logs
  - Update documentation with deprecation notices
  - Create GitHub issues announcing deprecation timeline
  - Begin developing migration tools and documentation

- **Example Warning:**
  ```
  ::warning::The 'comment-mode' input is deprecated and will be removed in v2.0.0. Use 'comment' instead. See migration guide: https://github.com/kodehort/sst-operations-action/blob/main/UPGRADE_GUIDE.md
  ```

#### Phase 2: Enhanced Warnings (3 months before breaking change)
- **Actions Taken:**
  - Increase visibility of deprecation warnings
  - Add migration guidance to action summaries
  - Create blog posts or announcements
  - Provide migration assistance in community channels

- **Example Enhanced Warning:**
  ```
  ::warning::DEPRECATION: 'comment-mode' will be removed in v2.0.0 (planned for 2026-01-01). Migration required. Use 'comment' instead. Auto-migration available: https://github.com/kodehort/sst-operations-action/wiki/auto-migrate
  ```

#### Phase 3: Final Notice (1 month before breaking change)
- **Actions Taken:**
  - Final migration reminders
  - Release candidate versions available
  - Migration validation tools provided
  - Direct outreach to known heavy users

#### Phase 4: Breaking Change Implementation
- **Actions Taken:**
  - Remove deprecated features in new major version
  - Maintain deprecated features in previous major version
  - Publish comprehensive migration guide
  - Provide migration support

### Deprecation Categories

#### Input Parameter Deprecation
```yaml
# Current: v1.5 (with deprecation warning)
inputs:
  comment-mode:  # deprecated
    description: "[DEPRECATED] Use 'comment' instead. Will be removed in v2.0"
    required: false
  comment:       # new parameter
    description: "Comment behavior (always, on-success, on-failure, never)"
    required: false
    default: "on-success"

# Future: v2.0 (deprecated parameter removed)
inputs:
  comment:
    description: "Comment behavior (always, on-success, on-failure, never)"
    required: false
    default: "on-success"
```

#### Output Field Deprecation
```yaml
# Current: v1.5 (both old and new fields provided)
outputs:
  success: "true"           # current
  operation_success: "true" # deprecated, same as 'success'
  
# Future: v2.0 (deprecated field removed)
outputs:
  success: "true"           # only this field remains
```

#### Operation Behavior Deprecation
```bash
# Current: v1.5 (with behavior change warning)
echo "::warning::The default timeout will change from 15min to 10min in v2.0. Specify 'timeout' explicitly."

# Future: v2.0 (new default behavior)
# timeout defaults to 10 minutes instead of 15
```

## Compatibility Testing

### Automated Compatibility Tests

#### Regression Test Suite
```yaml
# .github/workflows/compatibility.yml
name: Backward Compatibility Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  compatibility:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-scenario:
          - v1.0-workflows    # Test with v1.0 workflow patterns
          - v1.1-workflows    # Test with v1.1 workflow patterns
          - legacy-outputs    # Test legacy output consumption
          - deprecated-inputs # Test deprecated input handling
          
    steps:
      - uses: actions/checkout@v4
      - name: Test ${{ matrix.test-scenario }}
        run: |
          # Run compatibility test for specific scenario
          bun test __tests__/compatibility/${{ matrix.test-scenario }}.test.ts
```

#### Breaking Change Detection
```typescript
// __tests__/compatibility/breaking-change-detection.test.ts
describe('Breaking Change Detection', () => {
  test('all v1.0 inputs still work', () => {
    const v1_0_inputs = {
      operation: 'deploy',
      stage: 'test',
      token: 'fake-token',
      'comment-mode': 'always',  // v1.0 style
      'fail-on-error': 'true'
    };
    
    // Should not throw validation errors
    expect(() => validateInputs(v1_0_inputs)).not.toThrow();
  });
  
  test('all v1.0 outputs maintain format', () => {
    const result = executeOperation('deploy', options);
    
    // Verify output format hasn't changed
    expect(typeof result.success).toBe('string');
    expect(['true', 'false']).toContain(result.success);
    expect(typeof result.urls).toBe('string'); // JSON string format maintained
  });
});
```

### Manual Compatibility Validation

#### Real-World Workflow Testing
- Test with actual user workflows from different versions
- Validate in multiple GitHub Actions environments
- Test edge cases and error conditions
- Verify performance hasn't regressed

#### Community Feedback Integration
- Beta releases with compatibility testing
- Community validation programs
- User acceptance testing
- Feedback collection and issue tracking

## Compatibility Guarantees by Component

### Input Parameters

#### Strong Compatibility (Never Breaking Within Major Version)
- Parameter names and accepted values
- Default behavior when parameter not specified
- Validation rules and error messages
- Required vs optional parameter status

#### Weak Compatibility (May Change With Deprecation)
- Parameter descriptions and help text
- Internal parameter processing (if behavior unchanged)
- Validation error message details

### Output Fields

#### Strong Compatibility
- Field names and data types
- Output format (string, JSON structure)
- Field presence (existing fields always present)
- Boolean representations ("true"/"false" strings)

#### Weak Compatibility
- Output ordering (fields may be reordered)
- Additional metadata or debug information
- Internal field processing (if output unchanged)

### Operation Behavior

#### Strong Compatibility
- Core operation functionality (deploy/diff/remove)
- Error handling and recovery patterns
- GitHub integration behavior
- File and artifact creation patterns

#### Weak Compatibility  
- Performance characteristics
- Internal implementation details
- Logging and debugging output
- Timeout and retry behavior (with advance notice)

## Migration Support Tools

### Automated Migration Detection

```bash
#!/bin/bash
# scripts/detect-compatibility-issues.sh

echo "Scanning workflows for compatibility issues..."

# Check for deprecated input parameters
grep -r "comment-mode" .github/workflows/ && {
  echo "❌ Found deprecated 'comment-mode' parameter"
  echo "   Use 'comment' instead"
}

# Check for old output handling patterns
grep -r "outputs\.success == true" .github/workflows/ && {
  echo "❌ Found boolean comparison with outputs.success"
  echo "   Use outputs.success == 'true' instead"
}

# Check for version pinning patterns
grep -r "@main" .github/workflows/ && {
  echo "⚠️  Found @main version reference"
  echo "   Consider using @v1 for stability"
}

echo "Compatibility scan complete"
```

### Migration Assistance Scripts

```bash
#!/bin/bash
# scripts/auto-migrate-v1-to-v2.sh

echo "Auto-migrating workflows from v1 to v2..."

# Replace deprecated parameter names
find .github/workflows/ -name "*.yml" -exec sed -i 's/comment-mode:/comment:/g' {} \;

# Update version references
find .github/workflows/ -name "*.yml" -exec sed -i 's/@v1/@v2/g' {} \;

# Update boolean output comparisons
find .github/workflows/ -name "*.yml" -exec sed -i "s/== true/== 'true'/g" {} \;

echo "Migration complete. Please review changes and test thoroughly."
```

### Validation Tools

```javascript
// scripts/validate-migration.js
const { execSync } = require('child_process');
const fs = require('fs');

async function validateMigration() {
  console.log('Validating migration...');
  
  // Check workflow syntax
  const workflows = fs.readdirSync('.github/workflows/')
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    
  for (const workflow of workflows) {
    try {
      execSync(`gh workflow view ${workflow}`, { stdio: 'pipe' });
      console.log(`✅ ${workflow} syntax valid`);
    } catch (error) {
      console.log(`❌ ${workflow} syntax invalid:`, error.message);
    }
  }
  
  // Test workflow execution
  console.log('Running test workflow...');
  try {
    execSync('gh workflow run test-migration.yml', { stdio: 'pipe' });
    console.log('✅ Test workflow triggered successfully');
  } catch (error) {
    console.log('❌ Test workflow failed:', error.message);
  }
}

validateMigration();
```

## Exception Handling

### Emergency Breaking Changes

In rare cases, emergency breaking changes may be required:

#### Security Vulnerabilities
- Immediate patch may require breaking changes
- Advance notice may be shortened to protect users
- Migration assistance prioritized
- Clear security advisory published

#### Critical Bug Fixes
- Breaking change may be necessary to fix critical issues
- Shortened deprecation period with extra migration support
- Rollback plan provided
- Incident post-mortem with policy updates

#### External Dependency Changes
- SST CLI breaking changes may force compatibility breaks
- Node.js version requirement changes
- GitHub Actions platform changes

### Exception Process
1. **Assessment:** Determine if breaking change is absolutely necessary
2. **Approval:** Require maintainer consensus for emergency breaks
3. **Communication:** Immediate notification to users
4. **Support:** Extra migration assistance and support
5. **Review:** Post-incident review and policy updates

## Monitoring and Metrics

### Compatibility Metrics

#### Usage Tracking
- Version distribution across user base
- Deprecation warning frequency
- Migration completion rates
- Support request categorization

#### Quality Metrics  
- Regression bug reports
- Compatibility test pass rates
- User satisfaction scores
- Migration success rates

### Feedback Channels

#### Proactive Monitoring
- Automated compatibility test results
- User workflow success/failure rates
- Performance regression detection
- Error rate monitoring by version

#### Reactive Feedback
- GitHub Issues for compatibility problems
- Community discussions about breaking changes
- Support channel feedback
- User survey responses

## Policy Updates

This compatibility policy may be updated to reflect:
- Changes in the GitHub Actions ecosystem
- Community feedback and requirements
- Experience with version management
- External dependency requirements

**Policy Version:** 1.0  
**Last Updated:** 2025-08-07  
**Next Review:** 2025-11-07 (quarterly review)

All policy changes will be:
- Announced in GitHub Releases
- Discussed in GitHub Discussions
- Documented in CHANGELOG.md
- Applied with advance notice

---

This backward compatibility policy ensures reliable, predictable upgrade paths while maintaining the flexibility to evolve the action with changing requirements and technologies.