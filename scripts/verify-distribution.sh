#!/bin/bash
set -e

# Distribution Integrity Verification Script
# Verifies that a distribution is ready for release and consumption

VERSION=${1:-"current"}
VERBOSE=${VERBOSE:-false}
STRICT_MODE=${STRICT_MODE:-true}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

verbose() {
  if [ "$VERBOSE" = "true" ]; then
    echo -e "${BLUE}[VERBOSE]${NC} $1"
  fi
}

# Check if we're in the right directory
if [ ! -f "action.yml" ]; then
  error "action.yml not found. Please run this script from the repository root."
  exit 1
fi

log "Starting distribution verification for version: $VERSION"

# Initialize counters
ERRORS=0
WARNINGS=0
CHECKS=0

check_passed() {
  CHECKS=$((CHECKS + 1))
  success "$1"
}

check_failed() {
  CHECKS=$((CHECKS + 1))
  ERRORS=$((ERRORS + 1))
  error "$1"
}

check_warning() {
  CHECKS=$((CHECKS + 1))
  WARNINGS=$((WARNINGS + 1))
  warn "$1"
}

# 1. Verify Required Files
log "1. Verifying required files..."

REQUIRED_FILES=(
  "action.yml"
  "dist/index.js"
  "package.json"
  "README.md"
  "CHANGELOG.md"
  "VERSIONING_POLICY.md"
  "UPGRADE_GUIDE.md"
  "COMPATIBILITY_POLICY.md"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    verbose "Found required file: $file"
    check_passed "Required file exists: $file"
  else
    check_failed "Missing required file: $file"
  fi
done

# Check optional but recommended files
OPTIONAL_FILES=(
  "LICENSE"
  "dist/index.js.map"
  "dist/build-manifest.json"
  ".github/workflows/ci.yml"
  ".github/workflows/release.yml"
)

for file in "${OPTIONAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    verbose "Found optional file: $file"
    check_passed "Optional file exists: $file"
  else
    check_warning "Missing optional file: $file"
  fi
done

# 2. Verify action.yml Structure
log "2. Verifying action.yml structure..."

# Check required fields
if grep -q "^name:" action.yml; then
  check_passed "action.yml has 'name' field"
else
  check_failed "action.yml missing 'name' field"
fi

if grep -q "^description:" action.yml; then
  check_passed "action.yml has 'description' field"
else
  check_failed "action.yml missing 'description' field"
fi

if grep -q "^runs:" action.yml; then
  check_passed "action.yml has 'runs' section"
else
  check_failed "action.yml missing 'runs' section"
fi

# Check that main points to dist/index.js
if grep -q "main.*dist/index.js" action.yml; then
  check_passed "action.yml references dist/index.js correctly"
else
  check_failed "action.yml does not reference dist/index.js correctly"
fi

# Check Node.js version requirement
if grep -q "using.*node20" action.yml; then
  check_passed "action.yml specifies Node.js 20 runtime"
else
  check_warning "action.yml should specify Node.js 20 runtime"
fi

# Verify action.yml is valid YAML
if command -v yq >/dev/null 2>&1; then
  if yq eval '.' action.yml >/dev/null 2>&1; then
    check_passed "action.yml is valid YAML"
  else
    check_failed "action.yml is not valid YAML"
  fi
else
  check_warning "yq not available, skipping YAML validation"
fi

# 3. Verify Bundle Integrity
log "3. Verifying bundle integrity..."

if [ -f "dist/index.js" ]; then
  # Check bundle size
  BUNDLE_SIZE=$(stat -c%s dist/index.js 2>/dev/null || stat -f%z dist/index.js)
  BUNDLE_SIZE_MB=$(echo "scale=2; $BUNDLE_SIZE / 1024 / 1024" | bc 2>/dev/null || echo "0")
  
  verbose "Bundle size: ${BUNDLE_SIZE} bytes (${BUNDLE_SIZE_MB}MB)"
  
  if (( $(echo "$BUNDLE_SIZE_MB <= 10" | bc -l 2>/dev/null || echo "1") )); then
    check_passed "Bundle size (${BUNDLE_SIZE_MB}MB) is within 10MB limit"
  else
    check_failed "Bundle size (${BUNDLE_SIZE_MB}MB) exceeds 10MB limit"
  fi
  
  # Check bundle syntax
  if node -c dist/index.js >/dev/null 2>&1; then
    check_passed "Bundle syntax is valid"
  else
    check_failed "Bundle syntax validation failed"
  fi
  
  # Check for CommonJS format (GitHub Actions requirement)
  if grep -q "module\.exports\|exports\[" dist/index.js; then
    check_passed "Bundle appears to be in CommonJS format"
  else
    check_warning "Bundle may not be in CommonJS format"
  fi
  
  # Check for minification (should have short lines)
  AVERAGE_LINE_LENGTH=$(awk '{ total += length($0); count++ } END { print int(total/count) }' dist/index.js)
  if [ "$AVERAGE_LINE_LENGTH" -gt 200 ]; then
    check_passed "Bundle appears to be minified (avg line length: $AVERAGE_LINE_LENGTH)"
  else
    check_warning "Bundle may not be minified (avg line length: $AVERAGE_LINE_LENGTH)"
  fi
  
  # Calculate integrity hash
  if command -v sha256sum >/dev/null 2>&1; then
    BUNDLE_HASH=$(sha256sum dist/index.js | cut -d' ' -f1)
    verbose "Bundle SHA256: $BUNDLE_HASH"
    check_passed "Bundle integrity hash calculated: ${BUNDLE_HASH:0:16}..."
  else
    check_warning "sha256sum not available, skipping hash calculation"
  fi
  
else
  check_failed "Bundle file dist/index.js not found"
fi

# 4. Verify Source Maps
log "4. Verifying source maps..."

if [ -f "dist/index.js.map" ]; then
  # Check if source map is valid JSON
  if jq empty dist/index.js.map >/dev/null 2>&1; then
    check_passed "Source map is valid JSON"
    
    # Check source map structure
    if jq -e '.sources' dist/index.js.map >/dev/null 2>&1; then
      check_passed "Source map has sources field"
    else
      check_warning "Source map missing sources field"
    fi
    
    if jq -e '.mappings' dist/index.js.map >/dev/null 2>&1; then
      check_passed "Source map has mappings field"
    else
      check_warning "Source map missing mappings field"
    fi
    
  else
    check_failed "Source map is not valid JSON"
  fi
else
  check_warning "Source map not found (dist/index.js.map)"
fi

# 5. Verify Build Manifest
log "5. Verifying build manifest..."

if [ -f "dist/build-manifest.json" ]; then
  if jq empty dist/build-manifest.json >/dev/null 2>&1; then
    check_passed "Build manifest is valid JSON"
    
    # Check required fields
    MANIFEST_FIELDS=("buildTimestamp" "bundleSize" "bundlePath" "version")
    for field in "${MANIFEST_FIELDS[@]}"; do
      if jq -e ".$field" dist/build-manifest.json >/dev/null 2>&1; then
        check_passed "Build manifest has $field field"
      else
        check_warning "Build manifest missing $field field"
      fi
    done
    
  else
    check_failed "Build manifest is not valid JSON"
  fi
else
  check_warning "Build manifest not found (dist/build-manifest.json)"
fi

# 6. Verify Package.json
log "6. Verifying package.json..."

if [ -f "package.json" ]; then
  if jq empty package.json >/dev/null 2>&1; then
    check_passed "package.json is valid JSON"
    
    # Check required fields
    PKG_FIELDS=("name" "version" "description" "main")
    for field in "${PKG_FIELDS[@]}"; do
      if jq -e ".$field" package.json >/dev/null 2>&1; then
        check_passed "package.json has $field field"
      else
        check_failed "package.json missing $field field"
      fi
    done
    
    # Check main field points to correct file
    MAIN_FILE=$(jq -r '.main' package.json)
    if [ "$MAIN_FILE" = "dist/index.js" ]; then
      check_passed "package.json main field points to dist/index.js"
    else
      check_warning "package.json main field is '$MAIN_FILE', should be 'dist/index.js'"
    fi
    
  else
    check_failed "package.json is not valid JSON"
  fi
else
  check_failed "package.json not found"
fi

# 7. Security Checks
log "7. Running security checks..."

if [ -f "dist/index.js" ]; then
  # Check for dangerous patterns
  DANGEROUS_PATTERNS=(
    "eval("
    "Function("
    "document\.write"
    "innerHTML"
  )
  
  SECURITY_ISSUES=0
  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if grep -q "$pattern" dist/index.js; then
      check_failed "Found potentially dangerous pattern: $pattern"
      SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
    fi
  done
  
  if [ $SECURITY_ISSUES -eq 0 ]; then
    check_passed "No dangerous patterns found in bundle"
  fi
  
  # Check for potential hardcoded secrets
  if grep -qE "(password|secret|key|token).*['\"][a-zA-Z0-9]{20,}" dist/index.js; then
    check_failed "Potential hardcoded secrets found in bundle"
  else
    check_passed "No hardcoded secrets detected in bundle"
  fi
fi

# 8. Documentation Checks
log "8. Verifying documentation..."

if [ -f "README.md" ]; then
  # Check for required sections
  README_SECTIONS=("Usage" "Inputs" "Outputs")
  for section in "${README_SECTIONS[@]}"; do
    if grep -qi "## $section\|# $section" README.md; then
      check_passed "README.md has $section section"
    else
      check_warning "README.md missing $section section"
    fi
  done
  
  # Check for usage examples
  if grep -q "uses:" README.md; then
    check_passed "README.md contains usage examples"
  else
    check_warning "README.md missing usage examples"
  fi
else
  check_failed "README.md not found"
fi

if [ -f "CHANGELOG.md" ]; then
  # Check if changelog has recent entries
  if grep -q "$(date +%Y)" CHANGELOG.md; then
    check_passed "CHANGELOG.md has recent entries"
  else
    check_warning "CHANGELOG.md may not have recent entries"
  fi
else
  check_failed "CHANGELOG.md not found"
fi

# 9. Workflow Verification
log "9. Verifying GitHub workflows..."

WORKFLOW_DIR=".github/workflows"
if [ -d "$WORKFLOW_DIR" ]; then
  WORKFLOW_COUNT=$(find "$WORKFLOW_DIR" -name "*.yml" -o -name "*.yaml" | wc -l)
  if [ "$WORKFLOW_COUNT" -gt 0 ]; then
    check_passed "Found $WORKFLOW_COUNT workflow file(s)"
    
    # Check for essential workflows
    ESSENTIAL_WORKFLOWS=("ci" "release")
    for workflow in "${ESSENTIAL_WORKFLOWS[@]}"; do
      if find "$WORKFLOW_DIR" -name "*$workflow*" -type f | grep -q .; then
        check_passed "Found $workflow workflow"
      else
        check_warning "Missing $workflow workflow"
      fi
    done
    
  else
    check_warning "No workflow files found"
  fi
else
  check_warning ".github/workflows directory not found"
fi

# 10. Final Validation
log "10. Running final validation..."

# Try to load the bundle (basic execution test)
if [ -f "dist/index.js" ]; then
  # Test bundle can be loaded (will fail due to GitHub Actions env, but should not have syntax errors)
  if timeout 5s node -e "
    try {
      require('./dist/index.js');
    } catch (error) {
      if (error.message.includes('Input does not meet YAML') || 
          error.message.includes('GITHUB_STEP_SUMMARY') ||
          error.message.includes('INPUT_')) {
        console.log('Bundle loads correctly (expected GitHub Actions validation errors)');
        process.exit(0);
      } else {
        console.error('Unexpected bundle error:', error.message);
        process.exit(1);
      }
    }
  " >/dev/null 2>&1; then
    check_passed "Bundle execution test passed"
  else
    check_failed "Bundle execution test failed"
  fi
fi

# Generate summary
log "Generating verification summary..."

echo
echo "========================================="
echo "    DISTRIBUTION VERIFICATION SUMMARY"
echo "========================================="
echo
echo "Version: $VERSION"
echo "Checks Run: $CHECKS"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ -f "dist/index.js" ]; then
  echo "Bundle Size: ${BUNDLE_SIZE_MB}MB"
  if [ -n "$BUNDLE_HASH" ]; then
    echo "Bundle Hash: ${BUNDLE_HASH:0:32}..."
  fi
fi

echo

if [ $ERRORS -eq 0 ]; then
  success "✅ VERIFICATION PASSED"
  if [ $WARNINGS -gt 0 ]; then
    warn "⚠️  $WARNINGS warning(s) found - review recommended"
  fi
  echo
  echo "This distribution is ready for release and consumption."
  exit 0
else
  error "❌ VERIFICATION FAILED"
  echo
  echo "$ERRORS error(s) must be fixed before release."
  if [ "$STRICT_MODE" = "true" ]; then
    echo "Running in strict mode - all errors must be resolved."
    exit 1
  else
    warn "Running in non-strict mode - continuing despite errors"
    exit 0
  fi
fi