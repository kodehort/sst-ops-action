# Troubleshooting Guide

This guide provides solutions for common issues when using the SST Operations Action, including debugging steps, error resolution, and performance optimization.

## Quick Navigation

- [Getting Started](#getting-started)
- [Common Issues](#common-issues)
- [Error Categories](#error-categories)
- [Debugging Techniques](#debugging-techniques)
- [Performance Issues](#performance-issues)
- [Environment-Specific Issues](#environment-specific-issues)
- [Recovery Procedures](#recovery-procedures)
- [Getting Help](#getting-help)

---

## Getting Started

### Prerequisites Check

Before troubleshooting, verify these prerequisites:

```yaml
# Minimal working example
- name: Test SST Operations Action
  uses: kodehort/sst-operations-action@v1
  with:
    operation: diff  # Safest operation for testing
    stage: test
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: never
    fail-on-error: false
```

**Required:**
- ✅ SST project with valid configuration
- ✅ AWS credentials configured
- ✅ GitHub token with appropriate permissions
- ✅ Node.js 20+ environment (handled automatically)

### Quick Diagnostic

Run this diagnostic workflow to identify common issues:

```yaml
name: SST Action Diagnostic
on:
  workflow_dispatch:

jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Environment Check
        run: |
          echo "Node version: $(node --version)"
          echo "NPM version: $(npm --version)"
          echo "Working directory: $(pwd)"
          echo "SST config exists: $([ -f sst.config.ts ] && echo 'Yes' || echo 'No')"

      - name: AWS Credentials Check
        run: |
          if [ -n "$AWS_ACCESS_KEY_ID" ]; then
            echo "✅ AWS_ACCESS_KEY_ID is set"
          else
            echo "❌ AWS_ACCESS_KEY_ID not set"
          fi

          if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
            echo "✅ AWS_SECRET_ACCESS_KEY is set"
          else
            echo "❌ AWS_SECRET_ACCESS_KEY not set"
          fi
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Test Action
        id: test
        uses: kodehort/sst-operations-action@v1
        with:
          operation: diff
          stage: diagnostic
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: never
          fail-on-error: false

      - name: Results
        run: |
          echo "Action completed: ${{ steps.test.outputs.success }}"
          echo "Operation: ${{ steps.test.outputs.operation }}"
          echo "Stage: ${{ steps.test.outputs.stage }}"
```

---

## Common Issues

### 1. SST CLI Issues

#### Issue: "sst: command not found"

**Symptoms:**
```
/bin/sh: 1: sst: not found
Error: Process completed with exit code 127
```

**Root Cause:** SST CLI not installed or not in PATH

**Solutions:**

**Option A: Install SST CLI in workflow**
```yaml
steps:
  - uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '20'
      cache: 'npm'

  - name: Install Dependencies
    run: npm ci  # This installs SST CLI from package.json

  - name: SST Operations
    uses: kodehort/sst-operations-action@v1
    with:
      operation: deploy
      stage: staging
      token: ${{ secrets.GITHUB_TOKEN }}
```

**Option B: Global SST CLI installation**
```yaml
- name: Install SST CLI
  run: npm install -g @serverless-stack/cli

- name: Verify Installation
  run: sst --version
```

**Option C: Use npx (recommended for consistency)**
```yaml
- name: Deploy with npx
  run: npx sst deploy --stage staging
```

#### Issue: "SST is not initialized"

**Symptoms:**
```
Error: This directory does not appear to be an SST project
```

**Root Cause:** Missing SST configuration file

**Solutions:**

```bash
# Check for SST config
ls -la sst.config.*

# Expected files:
# sst.config.ts (TypeScript)
# sst.config.js (JavaScript)
# sst.json (Legacy)
```

**Fix:** Ensure SST config exists in repository root:

```typescript
// sst.config.ts
import { SSTConfig } from "sst";

export default {
  config(_input) {
    return {
      name: "my-sst-app",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      // Your stack definition
    });
  },
} satisfies SSTConfig;
```

### 2. AWS Credentials Issues

#### Issue: "Unable to locate credentials"

**Symptoms:**
```
Error: Unable to locate credentials. You can configure credentials by running "aws configure"
```

**Root Cause:** Missing or incorrect AWS credentials

**Solutions:**

**Option A: Repository Secrets (Recommended)**
```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_REGION: us-east-1  # Optional, defaults to us-east-1
```

**Option B: OIDC/IAM Roles (Most Secure)**
```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS Credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
      aws-region: us-east-1
```

**Debugging AWS Credentials:**
```yaml
- name: Debug AWS Credentials
  run: |
    aws sts get-caller-identity || echo "AWS credentials not working"
    echo "AWS_REGION: $AWS_REGION"
    echo "AWS_DEFAULT_REGION: $AWS_DEFAULT_REGION"
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

#### Issue: "Access Denied" or insufficient permissions

**Symptoms:**
```
Error: User: arn:aws:iam::123456789:user/github-actions is not authorized to perform: cloudformation:CreateStack
```

**Root Cause:** AWS user/role lacks required permissions

**Solution:** Grant required IAM permissions

**Minimal IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "apigateway:*",
        "iam:*",
        "route53:*",
        "cloudfront:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. GitHub Token Issues

#### Issue: "Bad credentials" or token authentication failed

**Symptoms:**
```
Error: Bad credentials
```

**Root Cause:** Invalid or expired GitHub token

**Solutions:**

**Option A: Use built-in GITHUB_TOKEN (Recommended)**
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}  # Automatically provided
```

**Option B: Personal Access Token**
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}  # Custom PAT
```

**Required Token Permissions:**
```yaml
permissions:
  contents: read          # Read repository
  issues: write          # Comment on issues
  pull-requests: write   # Comment on PRs
  actions: write         # Upload artifacts
```

### 4. Stage and Environment Issues

#### Issue: "Stage 'xyz' not found"

**Symptoms:**
```
Error: Stage "staging" was not found
```

**Root Cause:** Stage doesn't exist in SST configuration

**Solutions:**

**Check existing stages:**
```yaml
- name: List Available Stages
  run: |
    npx sst list-stages || echo "No stages found"
    ls .sst/ || echo "No .sst directory"
```

**Create stage if needed:**
```yaml
- name: Deploy (creates stage if needed)
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: ${{ github.event.inputs.stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### Issue: Stage name with special characters

**Symptoms:**
```
Error: Invalid stage name: "feature/new-api"
```

**Root Cause:** Stage names must be alphanumeric with hyphens

**Solution:** Sanitize stage names
```yaml
- name: Sanitize Stage Name
  id: stage
  run: |
    # Convert branch name to valid stage name
    STAGE=$(echo "${{ github.head_ref }}" | sed 's/[^a-zA-Z0-9-]/-/g' | tr '[:upper:]' '[:lower:]')
    echo "stage=$STAGE" >> $GITHUB_OUTPUT

- name: Deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: ${{ steps.stage.outputs.stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

### 5. Output and Parsing Issues

#### Issue: "Failed to parse SST output"

**Symptoms:**
```
Warning: Failed to parse deployment URLs
Warning: Resource changes could not be determined
```

**Root Cause:** SST CLI output format changed or unexpected content

**Solutions:**

**Debug output parsing:**
```yaml
- name: Deploy with Debug
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    max-output-size: 100000  # Increase limit for debugging

- name: Debug Outputs
  run: |
    echo "Success: '${{ steps.deploy.outputs.success }}'"
    echo "Operation: '${{ steps.deploy.outputs.operation }}'"
    echo "URLs: '${{ steps.deploy.outputs.urls }}'"
    echo "Resource Changes: '${{ steps.deploy.outputs.resource_changes }}'"
```

**Common parsing issues:**
- Very large output (increase `max-output-size`)
- Non-standard SST output format
- Mixed output from other tools

### 6. Performance Issues

#### Issue: Action takes too long to complete

**Symptoms:**
```
The job running on runner GitHub Actions 2 has exceeded the maximum execution time of 360 minutes.
```

**Root Cause:** Long-running deployment or infinite loops

**Solutions:**

**Set reasonable timeouts:**
```yaml
- name: Deploy with Timeout
  timeout-minutes: 30  # Prevent infinite runs
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Monitor deployment progress:**
```yaml
- name: Deploy with Progress Monitoring
  run: |
    # Run deployment with timeout and progress
    timeout 1800 npx sst deploy --stage staging || {
      echo "Deployment timed out after 30 minutes"
      exit 1
    }
```

---

## Error Categories

### Runtime Errors

#### CLI Execution Errors
```
Error: Command failed: sst deploy --stage staging
```

**Debug Steps:**
1. Check SST CLI installation
2. Verify working directory
3. Test manual CLI command
4. Check environment variables

#### Timeout Errors
```
Error: Operation timed out after 900000ms
```

**Solutions:**
- Increase timeout in workflow
- Optimize deployment (remove unused resources)
- Check AWS service limits

### Configuration Errors

#### Invalid Input Parameters
```
Error: Invalid operation: "deployment"
```

**Valid Parameters:**
- `operation`: `deploy`, `diff`, `remove`
- `comment-mode`: `always`, `on-success`, `on-failure`, `never`
- `fail-on-error`: `true`, `false`

#### Missing Required Inputs
```
Error: Input required and not supplied: stage
```

**Fix:** Always provide required inputs
```yaml
with:
  operation: deploy
  stage: production    # Required
  token: ${{ secrets.GITHUB_TOKEN }}  # Required
```

### Infrastructure Errors

#### CloudFormation Errors
```
Error: Stack mystack failed to deploy: UPDATE_ROLLBACK_COMPLETE
```

**Debug Steps:**
1. Check AWS CloudFormation console
2. Review CloudFormation events
3. Check resource limits
4. Verify IAM permissions

#### Resource Conflicts
```
Error: Resource with identifier [xyz] already exists
```

**Solutions:**
- Use unique resource names
- Check for resource name conflicts
- Clean up existing resources

---

## Debugging Techniques

### 1. Enable Debug Logging

```yaml
- name: Deploy with Debug
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    max-output-size: 200000  # Capture more output
  env:
    ACTIONS_STEP_DEBUG: true    # Enable debug logging
    SST_DEBUG: true            # Enable SST debug mode
```

### 2. Capture and Analyze Artifacts

```yaml
- name: Deploy
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Upload Debug Artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: debug-logs
    path: |
      ~/.sst/
      .sst/
      /tmp/sst-*
    retention-days: 7
```

### 3. Step-by-Step Debugging

```yaml
- name: Manual SST Steps
  run: |
    echo "1. Checking SST installation..."
    which sst || echo "SST not in PATH"

    echo "2. Checking SST version..."
    sst --version || echo "SST version check failed"

    echo "3. Checking SST config..."
    cat sst.config.ts || cat sst.config.js || echo "No SST config found"

    echo "4. Testing SST diff..."
    sst diff --stage staging || echo "SST diff failed"

    echo "5. Checking AWS credentials..."
    aws sts get-caller-identity || echo "AWS credentials invalid"
```

### 4. Output Analysis

```yaml
- name: Analyze Action Outputs
  run: |
    # Check all outputs
    echo "=== Action Outputs ==="
    echo "Success: '${{ steps.deploy.outputs.success }}'"
    echo "Operation: '${{ steps.deploy.outputs.operation }}'"
    echo "Stage: '${{ steps.deploy.outputs.stage }}'"
    echo "App: '${{ steps.deploy.outputs.app }}'"
    echo "Completion Status: '${{ steps.deploy.outputs.completion_status }}'"
    echo "Resource Changes: '${{ steps.deploy.outputs.resource_changes }}'"
    echo "URLs: '${{ steps.deploy.outputs.urls }}'"
    echo "Permalink: '${{ steps.deploy.outputs.permalink }}'"
    echo "Truncated: '${{ steps.deploy.outputs.truncated }}'"

    # Validate output format
    if [ "${{ steps.deploy.outputs.success }}" != "true" ] && [ "${{ steps.deploy.outputs.success }}" != "false" ]; then
      echo "❌ Invalid success output format"
    fi

    # Check for truncated output
    if [ "${{ steps.deploy.outputs.truncated }}" = "true" ]; then
      echo "⚠️ Output was truncated, increase max-output-size"
    fi
```

---

## Performance Issues

### 1. Slow Action Loading

**Symptoms:** Long delay before action starts executing

**Causes:**
- First-time action download
- Network connectivity issues
- GitHub Actions runner issues

**Solutions:**
```yaml
# Use specific version for consistent performance
- uses: kodehort/sst-operations-action@v1.0.0

# Or cache the action
- uses: actions/cache@v4
  with:
    path: ~/.cache/act
    key: sst-action-cache
```

### 2. Slow SST Operations

**Symptoms:** SST deploy/diff/remove takes very long

**Solutions:**

**Optimize SST Configuration:**
```typescript
// sst.config.ts
export default {
  config(_input) {
    return {
      name: "my-app",
      region: "us-east-1", // Use consistent region
    };
  },
  stacks(app) {
    // Optimize stack dependencies
    app.addDefaultFunctionProps({
      timeout: "10 seconds", // Reduce timeout
      memorySize: 256,       // Optimize memory
    });
  },
} satisfies SSTConfig;
```

**Parallel Processing:**
```yaml
# Deploy multiple stages in parallel
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

### 3. Bundle Size Issues

**Symptoms:** Action fails with bundle size errors

**This should not occur** as the action is pre-built and optimized, but if you see bundle-related errors:

```yaml
# Increase output limits if needed
- uses: kodehort/sst-operations-action@v1
  with:
    max-output-size: 500000  # Increase from default 50KB
```

---

## Environment-Specific Issues

### 1. GitHub Actions Runner Issues

#### Ubuntu Runner Issues
```yaml
# Ensure proper Node.js version
- uses: actions/setup-node@v4
  with:
    node-version: '20'  # Action requires Node.js 20+
```

#### Windows Runner Issues
```yaml
runs-on: windows-latest
steps:
  # Windows-specific path issues
  - name: Set Git Config
    run: git config --global core.autocrlf false

  - uses: kodehort/sst-operations-action@v1
    with:
      operation: deploy
      stage: staging
      token: ${{ secrets.GITHUB_TOKEN }}
```

#### macOS Runner Issues
```yaml
runs-on: macos-latest
steps:
  # macOS-specific setup if needed
  - name: Install Dependencies
    run: npm ci

  - uses: kodehort/sst-operations-action@v1
    with:
      operation: deploy
      stage: staging
      token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Network and Connectivity Issues

#### GitHub API Rate Limiting
```
Error: API rate limit exceeded
```

**Solutions:**
```yaml
# Use authenticated requests
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# Or implement retry logic
- name: Deploy with Retry
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: |
      # Your deployment command here
```

#### AWS Service Limits
```
Error: Limit exceeded for resource type
```

**Solutions:**
- Request service limit increases
- Use different regions
- Clean up unused resources

---

## Recovery Procedures

### 1. Failed Deployment Recovery

```yaml
name: Emergency Rollback
on:
  workflow_dispatch:
    inputs:
      stage:
        description: 'Stage to rollback'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.previous_commit }}  # Rollback to previous version

      - name: Emergency Deploy
        uses: kodehort/sst-operations-action@v1
        with:
          operation: deploy
          stage: ${{ github.event.inputs.stage }}
          token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-error: false
```

### 2. Stuck Deployment Recovery

```yaml
- name: Force Remove Stuck Resources
  run: |
    # Manual cleanup if normal remove fails
    aws cloudformation delete-stack --stack-name mystack-staging --region us-east-1

    # Wait for deletion
    aws cloudformation wait stack-delete-complete --stack-name mystack-staging --region us-east-1
```

### 3. State Corruption Recovery

```bash
# Clean local SST state
rm -rf .sst/
rm -rf ~/.sst/

# Reimport existing infrastructure
sst diff --stage staging  # This will detect existing resources
```

---

## Getting Help

### Self-Service Resources

1. **Check Action Logs**: Review GitHub Actions workflow logs
2. **Validate Configuration**: Use diagnostic workflow above
3. **Search Documentation**: Check README.md and other guides
4. **Review Examples**: Look at examples/ directory

### Community Support

- 🐛 **Report Bugs**: [GitHub Issues](https://github.com/kodehort/sst-operations-action/issues)
- 💬 **Ask Questions**: [GitHub Discussions](https://github.com/kodehort/sst-operations-action/discussions)
- 📖 **Documentation**: [Full Documentation](README.md)
- 🔄 **Migration Help**: [Migration Guide](MIGRATION.md)

### Creating Support Issues

**Include this information:**
- Action version used
- Complete workflow YAML
- Full error messages and logs
- SST configuration (sanitized)
- Environment details (OS, Node.js version)

**Issue Template:**
```markdown
## Bug Report

**Action Version:** v1.0.0
**Operation:** deploy
**Runner:** ubuntu-latest

### Workflow Configuration
```yaml
# Your workflow here
```

### Error Message
```
# Full error message here
```

### SST Configuration
```typescript
// Your sst.config.ts (remove sensitive data)
```

### Environment
- Node.js version:
- SST version:
- AWS region:
```

### Professional Support

For enterprise customers requiring dedicated support:
- 📧 **Contact**: maintainers@kodehort.com
- 🏢 **Enterprise Support**: Available for custom SLA requirements
- 🛠️ **Professional Services**: Migration assistance and custom development

---

## Troubleshooting Checklist

Use this checklist when encountering issues:

### Basic Checks
- [ ] Action version is valid (e.g., @v1, @v1.0.0)
- [ ] All required inputs provided (operation, stage, token)
- [ ] GitHub token has proper permissions
- [ ] AWS credentials configured correctly
- [ ] SST configuration file exists and is valid
- [ ] Working directory is repository root

### Advanced Checks
- [ ] SST CLI is installed or available
- [ ] Node.js version is 20 or higher
- [ ] No conflicting environment variables
- [ ] AWS service limits not exceeded
- [ ] Stage name follows naming conventions
- [ ] Network connectivity to AWS and GitHub
- [ ] No resource naming conflicts

### Debug Steps
- [ ] Run diagnostic workflow
- [ ] Enable debug logging
- [ ] Capture artifacts for analysis
- [ ] Test with minimal configuration
- [ ] Compare with working examples
- [ ] Check for recent AWS/SST changes

### Recovery Options
- [ ] Rollback to previous working version
- [ ] Clean up corrupted state
- [ ] Manual resource cleanup if needed
- [ ] Contact support if issue persists

---

This troubleshooting guide covers the most common issues and provides systematic approaches to resolution. For issues not covered here, please refer to the community support channels.
