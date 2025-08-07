# Migration Guide

This guide provides step-by-step instructions for migrating from monorepo composite actions to the standalone SST Operations Action, including automated migration tools and validation procedures.

## Quick Navigation

- [Migration Overview](#migration-overview)
- [Before You Start](#before-you-start)
- [Automated Migration](#automated-migration)
- [Manual Migration](#manual-migration)
- [Validation and Testing](#validation-and-testing)
- [Rollback Procedures](#rollback-procedures)
- [Common Migration Patterns](#common-migration-patterns)
- [Troubleshooting](#troubleshooting)

---

## Migration Overview

### What's Changing

**From:** Multiple composite actions in monorepo (`.github/actions/sst-*`)  
**To:** Single standalone action with operation parameter

**Benefits of Migration:**
- ✅ **Unified Interface** - One action for all SST operations
- ✅ **Better Maintenance** - Centralized updates and bug fixes
- ✅ **Improved Performance** - Optimized bundle and faster loading
- ✅ **Enhanced Features** - Better error handling and GitHub integration
- ✅ **Semantic Versioning** - Reliable upgrades with @v1, @v2 branches

### Compatibility Promise

- ✅ All existing functionality preserved
- ✅ Same outputs and behavior
- ✅ Compatible with existing workflows
- ✅ No breaking changes in core functionality

---

## Before You Start

### Prerequisites Checklist

- [ ] **Backup**: Create a backup branch of your current workflows
- [ ] **Inventory**: Document all workflows using SST composite actions
- [ ] **Testing**: Ensure you have a staging environment for testing
- [ ] **Access**: Confirm you have write access to `.github/workflows/`
- [ ] **SST Version**: Verify SST CLI version compatibility

### Inventory Your Current Setup

Run this command to find all workflows using SST composite actions:

```bash
# Find all SST composite action usage
grep -r "\.github/actions/sst-" .github/workflows/ || echo "No SST composite actions found"

# More comprehensive search
find .github/workflows/ -name "*.yml" -exec grep -l "sst-" {} \;
```

**Example Output:**
```
.github/workflows/deploy.yml
.github/workflows/pr-preview.yml
.github/workflows/cleanup.yml
```

### Document Current Configuration

Create an inventory of your current setup:

```bash
# Create migration inventory
cat > migration-inventory.md << EOF
# Migration Inventory

## Current Composite Actions Usage

$(find .github/workflows/ -name "*.yml" -exec sh -c 'echo "### $1"; grep -A 10 -B 2 "\.github/actions/sst-" "$1" || echo "No SST actions found"' _ {} \;)

## Generated: $(date)
EOF
```

---

## Automated Migration

### Migration Script

We provide an automated migration script to handle most common patterns:

```bash
#!/bin/bash
# scripts/migrate-workflows.sh

echo "🚀 Starting automated migration to SST Operations Action..."

# Backup current workflows
echo "📦 Creating backup..."
cp -r .github/workflows .github/workflows.backup.$(date +%Y%m%d-%H%M%S)

# Create migration report
echo "📋 Analyzing workflows..."
WORKFLOWS=$(find .github/workflows -name "*.yml" -o -name "*.yaml")
MIGRATED=0
SKIPPED=0

for workflow in $WORKFLOWS; do
  echo "Processing: $workflow"
  
  # Check if workflow uses SST composite actions
  if grep -q "\.github/actions/sst-" "$workflow"; then
    echo "  Found SST composite actions, migrating..."
    
    # Backup original
    cp "$workflow" "$workflow.backup"
    
    # Apply migrations
    sed -i.bak \
      -e 's|uses: \.\/\.github\/actions\/sst-deploy|uses: kodehort/sst-operations-action@v1|g' \
      -e 's|uses: \.\/\.github\/actions\/sst-diff|uses: kodehort/sst-operations-action@v1|g' \
      -e 's|uses: \.\/\.github\/actions\/sst-remove|uses: kodehort/sst-operations-action@v1|g' \
      "$workflow"
    
    # Add operation parameter based on action type
    if grep -q "sst-deploy" "$workflow.bak"; then
      sed -i '/uses: kodehort\/sst-operations-action@v1/a\        with:\n          operation: deploy' "$workflow"
    elif grep -q "sst-diff" "$workflow.bak"; then
      sed -i '/uses: kodehort\/sst-operations-action@v1/a\        with:\n          operation: diff' "$workflow"
    elif grep -q "sst-remove" "$workflow.bak"; then
      sed -i '/uses: kodehort\/sst-operations-action@v1/a\        with:\n          operation: remove' "$workflow"
    fi
    
    # Clean up
    rm "$workflow.bak"
    MIGRATED=$((MIGRATED + 1))
    echo "  ✅ Migrated successfully"
  else
    echo "  ⏭️  No SST actions found, skipping"
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "🎉 Migration completed!"
echo "   Migrated: $MIGRATED workflows"
echo "   Skipped: $SKIPPED workflows"
echo ""
echo "📋 Next steps:"
echo "   1. Review the changes: git diff"
echo "   2. Test in a staging environment"
echo "   3. Commit when satisfied: git add . && git commit -m 'feat: migrate to SST Operations Action'"
```

### Run Automated Migration

```bash
# Download and run migration script
curl -sSL https://raw.githubusercontent.com/kodehort/sst-operations-action/main/scripts/migrate-workflows.sh | bash

# Or create the script locally and run
chmod +x scripts/migrate-workflows.sh
./scripts/migrate-workflows.sh
```

---

## Manual Migration

### Step-by-Step Manual Process

#### Step 1: Identify Composite Action Usage

```bash
# Find sst-deploy usage
grep -n "sst-deploy" .github/workflows/*.yml

# Find sst-diff usage  
grep -n "sst-diff" .github/workflows/*.yml

# Find sst-remove usage
grep -n "sst-remove" .github/workflows/*.yml
```

#### Step 2: Update Action References

**Before (sst-deploy composite action):**
```yaml
- name: Deploy to staging
  uses: ./.github/actions/sst-deploy
  with:
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success
```

**After (standalone action):**
```yaml
- name: Deploy to staging
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy  # New required parameter
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success
```

#### Step 3: Update All Operation Types

**Deploy Operations:**
```yaml
# Before
- uses: ./.github/actions/sst-deploy

# After  
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
```

**Diff Operations:**
```yaml
# Before
- uses: ./.github/actions/sst-diff

# After
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
```

**Remove Operations:**
```yaml
# Before
- uses: ./.github/actions/sst-remove

# After
- uses: kodehort/sst-operations-action@v1
  with:
    operation: remove
```

#### Step 4: Verify Input Parameters

All existing input parameters remain the same:

- ✅ `stage` - No change
- ✅ `token` - No change  
- ✅ `comment-mode` - No change
- ✅ `fail-on-error` - No change
- ✅ `max-output-size` - No change

Only addition is the new `operation` parameter.

---

## Validation and Testing

### Migration Validation Script

```bash
#!/bin/bash
# scripts/validate-migration.sh

echo "🔍 Validating migration..."

# Check for old composite action references
echo "Checking for remaining composite actions..."
OLD_ACTIONS=$(grep -r "\.github/actions/sst-" .github/workflows/ || echo "")

if [ -n "$OLD_ACTIONS" ]; then
  echo "❌ Found remaining composite action references:"
  echo "$OLD_ACTIONS"
  exit 1
else
  echo "✅ No old composite actions found"
fi

# Check for new action usage without operation parameter
echo "Checking for missing operation parameters..."
MISSING_OPERATIONS=$(grep -A 5 "kodehort/sst-operations-action" .github/workflows/*.yml | grep -B 5 -A 5 "with:" | grep -v "operation:" || echo "")

if [ -n "$MISSING_OPERATIONS" ]; then
  echo "⚠️  Found usage without operation parameter:"
  echo "$MISSING_OPERATIONS"
  echo "Please add 'operation: deploy|diff|remove' parameter"
fi

# Check YAML syntax
echo "Validating YAML syntax..."
for workflow in .github/workflows/*.yml; do
  if ! yamllint "$workflow" 2>/dev/null; then
    echo "⚠️  YAML syntax issues in $workflow"
  fi
done

# Test with GitHub CLI if available
if command -v gh >/dev/null; then
  echo "Testing workflow syntax with GitHub CLI..."
  for workflow in .github/workflows/*.yml; do
    if gh workflow view "$(basename "$workflow" .yml)" >/dev/null 2>&1; then
      echo "✅ $workflow syntax valid"
    else
      echo "❌ $workflow has syntax issues"
    fi
  done
fi

echo "🎉 Migration validation completed"
```

### Testing Strategy

#### 1. Test in Feature Branch

```bash
# Create feature branch for testing
git checkout -b migrate-to-sst-operations-action

# Apply migration
./scripts/migrate-workflows.sh

# Commit changes
git add .
git commit -m "feat: migrate to SST Operations Action"

# Push for testing
git push origin migrate-to-sst-operations-action
```

#### 2. Test with Staging Environment

Create a test workflow to validate migration:

```yaml
# .github/workflows/test-migration.yml
name: Test Migration
on:
  workflow_dispatch:
    inputs:
      operation:
        description: 'Operation to test'
        required: true
        default: 'diff'
        type: choice
        options:
          - deploy
          - diff
          - remove

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Test SST Operations Action
        uses: kodehort/sst-operations-action@v1
        with:
          operation: ${{ github.event.inputs.operation }}
          stage: test-migration
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: never
          fail-on-error: false
```

#### 3. Validate Outputs

Compare outputs before and after migration:

```yaml
# Test output compatibility
- name: Validate Outputs
  run: |
    echo "Operation: ${{ steps.sst.outputs.operation }}"
    echo "Success: ${{ steps.sst.outputs.success }}"
    echo "Stage: ${{ steps.sst.outputs.stage }}"
    
    # Verify output format hasn't changed
    if [ "${{ steps.sst.outputs.success }}" != "true" ] && [ "${{ steps.sst.outputs.success }}" != "false" ]; then
      echo "❌ Unexpected success output format"
      exit 1
    fi
```

---

## Rollback Procedures

### Quick Rollback

If you need to quickly rollback the migration:

```bash
# Restore from backup
rm -rf .github/workflows
mv .github/workflows.backup.* .github/workflows

# Or restore individual files
cp .github/workflows/*.yml.backup .github/workflows/

# Remove .backup extensions
for file in .github/workflows/*.backup; do
  mv "$file" "${file%.backup}"
done
```

### Selective Rollback

Rollback specific workflows:

```bash
# Rollback specific workflow
git checkout HEAD~1 -- .github/workflows/deploy.yml

# Or restore from backup
cp .github/workflows/deploy.yml.backup .github/workflows/deploy.yml
```

### Emergency Rollback

If workflows are failing in production:

```yaml
# Temporary fix: pin to old working version
- uses: kodehort/sst-operations-action@v1.0.0  # Known working version
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Common Migration Patterns

### Pattern 1: Simple Deployment Workflow

**Before:**
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/sst-deploy
        with:
          stage: production
          token: ${{ secrets.GITHUB_TOKEN }}
```

**After:**
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-operations-action@v1
        with:
          operation: deploy
          stage: production
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Pattern 2: PR Preview with Diff

**Before:**
```yaml
name: PR Preview
on:
  pull_request:

jobs:
  diff:
    steps:
      - uses: ./.github/actions/sst-diff
        with:
          stage: staging
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: always
          
  deploy:
    needs: diff
    steps:
      - uses: ./.github/actions/sst-deploy
        with:
          stage: pr-${{ github.event.number }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

**After:**
```yaml
name: PR Preview
on:
  pull_request:

jobs:
  diff:
    steps:
      - uses: kodehort/sst-operations-action@v1
        with:
          operation: diff
          stage: staging
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: always
          
  deploy:
    needs: diff
    steps:
      - uses: kodehort/sst-operations-action@v1
        with:
          operation: deploy
          stage: pr-${{ github.event.number }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Pattern 3: Cleanup on PR Close

**Before:**
```yaml
name: Cleanup
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    steps:
      - uses: ./.github/actions/sst-remove
        with:
          stage: pr-${{ github.event.number }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

**After:**
```yaml
name: Cleanup
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    steps:
      - uses: kodehort/sst-operations-action@v1
        with:
          operation: remove
          stage: pr-${{ github.event.number }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Pattern 4: Matrix Deployments

**Before:**
```yaml
strategy:
  matrix:
    stage: [staging, production]
    
steps:
  - uses: ./.github/actions/sst-deploy
    with:
      stage: ${{ matrix.stage }}
      token: ${{ secrets.GITHUB_TOKEN }}
```

**After:**
```yaml
strategy:
  matrix:
    stage: [staging, production]
    
steps:
  - uses: kodehort/sst-operations-action@v1
    with:
      operation: deploy
      stage: ${{ matrix.stage }}
      token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Troubleshooting

### Common Migration Issues

#### Issue: "Required input 'operation' not provided"

**Cause:** Forgot to add the operation parameter  
**Solution:** Add operation parameter to all action uses

```yaml
# Fix this
- uses: kodehort/sst-operations-action@v1
  with:
    stage: production

# To this  
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy  # Add this line
    stage: production
```

#### Issue: "Unknown operation type"

**Cause:** Typo in operation parameter  
**Solution:** Use valid operation values: `deploy`, `diff`, or `remove`

```yaml
# Fix this
with:
  operation: deployment  # Invalid

# To this
with:
  operation: deploy     # Valid
```

#### Issue: Workflow syntax errors after migration

**Cause:** YAML indentation issues from automated migration  
**Solution:** Fix YAML formatting

```bash
# Check YAML syntax
yamllint .github/workflows/*.yml

# Or use yq to reformat
yq eval '.' .github/workflows/deploy.yml > temp.yml
mv temp.yml .github/workflows/deploy.yml
```

#### Issue: Outputs not working after migration

**Cause:** Output names unchanged, should work identically  
**Solution:** Verify output usage syntax

```yaml
# This should still work
- if: steps.deploy.outputs.success == 'true'
  run: echo "Deployment successful"

# Check output names are correct
- run: |
    echo "Available outputs:"
    echo "Success: ${{ steps.deploy.outputs.success }}"
    echo "Operation: ${{ steps.deploy.outputs.operation }}"
```

### Migration Validation Errors

#### Error: "Composite action path not found"

**Cause:** Old composite action references still exist  
**Solution:** Complete the migration

```bash
# Find remaining references
grep -r "\.github/actions/sst-" .github/workflows/

# Replace with new action
sed -i 's|\.\/\.github\/actions\/sst-deploy|kodehort/sst-operations-action@v1|g' .github/workflows/*.yml
```

#### Error: Workflows not triggering

**Cause:** YAML syntax errors  
**Solution:** Validate and fix YAML

```bash
# Validate all workflow files
for file in .github/workflows/*.yml; do
  echo "Checking $file..."
  yamllint "$file" || echo "❌ Issues found in $file"
done
```

### Performance Issues

#### Issue: Slower workflow execution

**Cause:** Network latency downloading new action  
**Solution:** Normal on first run, subsequent runs use cached action

```yaml
# Workflows will cache the action after first use
# No action needed, performance improves after first execution
```

### Getting Help

#### Self-Service Troubleshooting

1. **Check Migration Script Output**: Review any errors during automated migration
2. **Validate YAML Syntax**: Use yamllint or GitHub CLI to validate workflows
3. **Test in Feature Branch**: Always test migration in a separate branch first
4. **Compare Outputs**: Ensure outputs match expected format

#### Community Support

- 🐛 **Report Issues**: [GitHub Issues](https://github.com/kodehort/sst-operations-action/issues)
- 💬 **Ask Questions**: [GitHub Discussions](https://github.com/kodehort/sst-operations-action/discussions)
- 📚 **Documentation**: [Full Documentation](README.md)

#### Creating Migration Issues

When reporting migration issues, include:

- Original composite action configuration
- Attempted migration changes
- Error messages and logs
- Workflow files (before and after)

**Issue Template:**
```markdown
## Migration Issue

**Original Action:** ./.github/actions/sst-deploy
**Target Action:** kodehort/sst-operations-action@v1

### Before (Working)
```yaml
# Your original workflow here
```

### After (Not Working)
```yaml
# Your migrated workflow here
```

### Error Message
```
# Error output here
```
```

---

## Migration Checklist

Use this checklist to ensure complete migration:

### Pre-Migration
- [ ] Created backup of current workflows
- [ ] Documented all current SST composite action usage
- [ ] Tested current workflows to establish baseline
- [ ] Set up staging environment for testing

### During Migration  
- [ ] Updated all `.github/actions/sst-deploy` references
- [ ] Updated all `.github/actions/sst-diff` references  
- [ ] Updated all `.github/actions/sst-remove` references
- [ ] Added `operation` parameter to all new action uses
- [ ] Preserved all existing input parameters
- [ ] Validated YAML syntax of all modified workflows

### Post-Migration
- [ ] Ran migration validation script
- [ ] Tested all operations in staging environment
- [ ] Verified outputs match expected format
- [ ] Confirmed PR comments work correctly
- [ ] Tested error handling scenarios
- [ ] Updated documentation references
- [ ] Trained team on new action usage

### Production Deployment
- [ ] Merged migration changes to main branch
- [ ] Monitored first production deployments
- [ ] Verified all expected functionality works
- [ ] Cleaned up backup files after successful migration
- [ ] Updated team documentation and runbooks

---

This migration guide ensures a smooth transition from composite actions to the standalone SST Operations Action with minimal disruption to your existing workflows.