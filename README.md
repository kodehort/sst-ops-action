# SST Operations Action

[![CI](https://github.com/kodehort/sst-ops-action/actions/workflows/ci.yml/badge.svg)](https://github.com/kodehort/sst-ops-action/actions/workflows/ci.yml)
[![Release](https://github.com/kodehort/sst-ops-action/actions/workflows/release.yml/badge.svg)](https://github.com/kodehort/sst-ops-action/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/release/kodehort/sst-ops-action.svg)](https://github.com/kodehort/sst-ops-action/releases/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified, production-ready GitHub Action for **SST (Serverless Stack)** operations: deploy, diff, remove, and stage. This action consolidates functionality from multiple composite actions into a single, maintainable, and distributable solution.

## ✨ Features

- 🚀 **Multi-Operation Support** - Deploy, diff, remove, and stage operations in one action
- 🤖 **Automatic Stage Inference** - Automatically compute stage names from Git context (branches, PRs)
- 📝 **Automated PR Comments** - Rich markdown comments with deployment status and changes
- 🔍 **Infrastructure Diff** - See planned changes before deployment
- 🧹 **Resource Cleanup** - Automated removal of staging environments
- 🎯 **Stage Calculation** - Manual stage name computation from Git branches (when needed)
- ⚙️ **Configurable Runtime** - Support for Bun, npm, pnpm, Yarn, or direct SST CLI
- 📊 **GitHub Integration** - Workflow summaries, artifacts, and status reporting

## 🚀 Quick Start

### Basic Deploy (Automatic Stage)

```yaml
name: Deploy
on:
  push:
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          # Stage automatically computed from branch/PR name
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Basic Deploy (Explicit Stage)

```yaml
name: Deploy to Staging
on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          stage: staging
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Infrastructure Diff on PRs

```yaml
name: Infrastructure Diff
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-ops-action@v1
        with:
          operation: diff
          # Stage automatically computed from PR branch name
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: always
```

### Cleanup on PR Close

```yaml
name: Cleanup Resources
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kodehort/sst-ops-action@v1
        with:
          operation: remove
          stage: pr-${{ github.event.number }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Automatic Stage Inference

```yaml
name: Auto-Deploy
on:
  push:
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Stage is automatically computed from Git context
      - name: Deploy
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          # No stage input - automatically computed from branch/PR
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Dynamic Stage Calculation (Legacy)

```yaml
name: Smart Deploy
on:
  push:
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Calculate stage name from current branch/PR (alternative approach)
      - name: Calculate Stage
        id: stage
        uses: kodehort/sst-ops-action@v1
        with:
          operation: stage
          token: ${{ secrets.GITHUB_TOKEN }}
      
      # Use calculated stage for deployment
      - name: Deploy
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          stage: ${{ steps.stage.outputs.computed_stage }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

## 🎯 Operation-Specific Examples

Each operation type has different input requirements and behavior patterns. Choose the right operation for your use case:

### 🚀 Deploy Operation
**Purpose**: Deploy infrastructure to AWS  
**Stage**: Optional - auto-computed from Git context if not provided  
**Token**: Required for infrastructure access and PR comments

```yaml
# Auto-compute stage from branch/PR name
- name: Deploy (Auto Stage)
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    token: ${{ secrets.GITHUB_TOKEN }}

# Explicit stage name
- name: Deploy to Production
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
    runner: npm
```

### 🔍 Diff Operation
**Purpose**: Preview infrastructure changes without deploying  
**Stage**: Required - need target stage to compare against  
**Token**: Required for PR comments

```yaml
# Compare against existing stage
- name: Preview Infrastructure Changes
  uses: kodehort/sst-ops-action@v1
  with:
    operation: diff
    stage: production  # Required - what to compare against
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always

# Compare branch changes against main
- name: PR Infrastructure Diff
  uses: kodehort/sst-ops-action@v1
  with:
    operation: diff
    stage: ${{ github.base_ref || 'main' }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

### 🗑️ Remove Operation
**Purpose**: Delete deployed resources for cleanup  
**Stage**: Required - explicit stage name for safety  
**Token**: Required for authentication and confirmation

```yaml
# Clean up PR resources
- name: Remove PR Resources
  uses: kodehort/sst-ops-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}  # Required for safety
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success

# Production removal (requires extra confirmation)
- name: Remove Production (Dangerous!)
  uses: kodehort/sst-ops-action@v1
  with:
    operation: remove
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
  env:
    CONFIRM_PRODUCTION_REMOVE: true
```

### 🎯 Stage Operation
**Purpose**: Compute stage names from Git context (utility only)  
**Stage**: Not applicable - computes stage as output  
**Token**: Not required - no infrastructure access

```yaml
# Basic stage computation
- name: Compute Stage Name
  id: stage
  uses: kodehort/sst-ops-action@v1
  with:
    operation: stage

# Custom stage name parameters
- name: Compute Stage with Custom Rules
  id: stage
  uses: kodehort/sst-ops-action@v1
  with:
    operation: stage
    truncation-length: 20
    prefix: feat-

# Use computed stage in later step
- name: Deploy with Computed Stage
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: ${{ steps.stage.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

## 📖 Usage

### Inputs

| Input | Description | Required | Default | Example |
|-------|-------------|----------|---------|---------|
| `operation` | SST operation to perform | No | `deploy` | `deploy`, `diff`, `remove`, `stage` |
| `stage` | SST stage to operate on (auto-computed from Git context if not provided) | No | - | `production`, `staging`, `pr-123` |
| `token` | GitHub token for authentication | Yes | - | `${{ secrets.GITHUB_TOKEN }}` |
| `runner` | Package manager/runtime for SST commands | No | `bun` | `bun`, `npm`, `pnpm`, `yarn`, `sst` |
| `comment-mode` | When to create PR comments | No | `on-success` | `always`, `on-success`, `on-failure`, `never` |
| `fail-on-error` | Whether to fail the workflow on errors | No | `true` | `true`, `false` |
| `max-output-size` | Maximum output size in bytes | No | `50000` | `100000` |
| `truncation-length` | Maximum length for computed stage names (stage operation only) | No | `26` | `15`, `50` |
| `prefix` | Prefix for stage names starting with numbers (stage operation only) | No | `pr-` | `fix-`, `issue-` |

### Outputs

| Output | Description | Type | Example |
|--------|-------------|------|---------|
| `success` | Whether the operation completed successfully | String | `"true"`, `"false"` |
| `operation` | The operation that was performed | String | `"deploy"`, `"diff"`, `"remove"`, `"stage"` |
| `stage` | The stage that was operated on | String | `"production"`, `"staging"` |
| `app` | The SST app name | String | `"my-app"` |
| `resource_changes` | Number of resource changes | String | `"5"` |
| `urls` | Deployed URLs (deploy only) | JSON String | `["https://api.example.com"]` |
| `diff_summary` | Diff summary (diff only) | String | `"3 resources to create, 1 to update"` |
| `computed_stage` | Computed stage name (stage only) | String | `"feature-branch"` |
| `ref` | Git reference (stage only) | String | `"refs/heads/main"` |
| `event_name` | GitHub event type (stage only) | String | `"push"`, `"pull_request"` |
| `is_pull_request` | Whether from pull request (stage only) | String | `"true"`, `"false"` |
| `completion_status` | Final operation status | String | `"success"`, `"failed"`, `"partial"` |
| `permalink` | SST Console permalink | String | `"https://console.sst.dev/..."` |
| `truncated` | Whether output was truncated | String | `"false"` |

## 🎯 Operations

### Deploy Operation

Deploys your SST application to the specified stage.

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success
```

**Features:**
- ✅ Deploys all stack resources
- ✅ Extracts and reports deployed URLs
- ✅ Tracks resource changes (created, updated, unchanged)
- ✅ Creates PR comments with deployment status
- ✅ Generates workflow summaries
- ✅ Uploads deployment artifacts

**Use Cases:**
- Production deployments on main branch
- Staging deployments on develop branch
- Preview environments for pull requests
- Scheduled deployments

### Diff Operation

Shows planned infrastructure changes without deploying.

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
```

**Features:**
- ✅ Shows planned resource changes
- ✅ Categorizes changes by impact
- ✅ Generates human-readable diff summary
- ✅ Creates detailed PR comments
- ✅ No actual infrastructure changes

**Use Cases:**
- Pull request reviews
- Pre-deployment validation
- Change impact assessment
- Infrastructure planning

#### Example PR Comment Output

When changes are detected, the action creates a structured PR comment showing the infrastructure diff:

<details>
<summary>📋 Example: Diff with Changes</summary>

### 🔍 DIFF SUCCESS

**Stage:** `staging`  
**App:** `my-sst-app`  
**Status:** `complete`

### 🔍 Infrastructure Changes Preview

| Property | Value |
|----------|-------|
| App | `my-sst-app` |
| Stage | `staging` |
| Total Changes | 5 |
| Summary | 5 changes planned |
| Console Link | [View Diff](https://console.sst.dev/my-sst-app/staging/diffs/abc123) |

### 📋 Resource Changes

```diff
+ AuthHandler (Function)
+ UserApi (Api)
* ProcessorFunction (Function)
* Database (Aurora)
- LegacyWebsite (StaticSite)
```

### 🖥️ SST Console

[View in SST Console](https://console.sst.dev/my-sst-app/staging/diffs/abc123) to see detailed resource information and logs.

</details>

<details>
<summary>✅ Example: No Changes Detected</summary>

### 🔍 DIFF SUCCESS

**Stage:** `production`  
**App:** `my-sst-app`  
**Status:** `complete`

### 🔍 Infrastructure Changes Preview

| Property | Value |
|----------|-------|
| App | `my-sst-app` |
| Stage | `production` |
| Total Changes | 0 |
| Summary | No changes |
| Console Link | [View Diff](https://console.sst.dev/my-sst-app/production/diffs/nochanges456) |

### ✅ No Changes

No infrastructure changes detected for this operation.

### 🖥️ SST Console

[View in SST Console](https://console.sst.dev/my-sst-app/production/diffs/nochanges456) to see detailed resource information and logs.

</details>

#### Example Action Summary Output

The GitHub Actions summary provides a concise overview of the diff operation:

<details>
<summary>📋 Example: Action Summary with Changes</summary>

### 🔍 Infrastructure Diff Summary

| Property | Value |
|----------|-------|
| App | `my-sst-app` |
| Stage | `staging` |
| Total Changes | 5 |
| Added Resources | 2 |
| Modified Resources | 2 |
| Removed Resources | 1 |
| Status | ![Success](https://img.shields.io/badge/Status-Success-green) |
| Console Link | [View Diff](https://console.sst.dev/my-sst-app/staging/diffs/abc123) |

### 📋 Resource Changes

```diff
+ AuthHandler (Function)
+ UserApi (Api)
* ProcessorFunction (Function)
* Database (Aurora)
- LegacyWebsite (StaticSite)
```

</details>

<details>
<summary>✅ Example: Action Summary with No Changes</summary>

### 🔍 Infrastructure Diff Summary

| Property | Value |
|----------|-------|
| App | `my-sst-app` |
| Stage | `production` |
| Total Changes | 0 |
| Added Resources | 0 |
| Modified Resources | 0 |
| Removed Resources | 0 |
| Status | ![Success](https://img.shields.io/badge/Status-Success-green) |
| Console Link | [View Diff](https://console.sst.dev/my-sst-app/production/diffs/nochanges456) |

### ✅ No Changes

No infrastructure changes detected for this operation.

</details>

### Remove Operation

Removes all resources for the specified stage.

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Features:**
- ✅ Removes all stack resources
- ✅ Tracks cleanup status
- ✅ Handles partial cleanup scenarios
- ✅ Auto-confirms removal in CI

**Use Cases:**
- PR environment cleanup
- Staging environment reset
- Cost optimization
- Resource cleanup

### Stage Operation

Calculates SST stage name from Git branch or pull request information.

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}

# With custom configuration
- uses: kodehort/sst-ops-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    truncation-length: 15
    prefix: fix-
```

**Features:**
- ✅ Automatic stage name computation from Git references
- ✅ Configurable truncation length (default: 26 characters)
- ✅ Configurable prefix (default: `pr-`)
- ✅ Branch name sanitization and normalization
- ✅ Pull request and push event support
- ✅ Fallback stage handling for edge cases
- ✅ No SST CLI dependency required

**Use Cases:**
- Dynamic stage name generation
- Consistent branch-to-stage mapping
- Multi-environment workflows
- Pull request preview environments
- Branch-based deployments

**Automatic Stage Inference:**
- When `stage` input is not provided, the action automatically computes it from Git context
- Works with both push events (branch names) and pull request events (PR branch names)
- Uses the same computation rules as the manual stage operation
- Fallback to 'main' if no usable Git context is available

**Stage Computation Rules:**
- Removes path prefixes (`refs/heads/`, `feature/`)
- Converts to lowercase
- Replaces non-alphanumeric characters with hyphens
- Truncates to configurable length (default: 26 characters)
- Prefixes numeric branches with configurable prefix (default: `pr-`)
- Applies truncation including the prefix
- Removes leading/trailing hyphens after truncation

**Examples:**
| Branch | Event | Computed Stage | Auto/Manual | Notes |
|--------|-------|----------------|-------------|--------|
| `main` | push | `main` | Auto | Automatic inference |
| `feature/user-auth` | push | `user-auth` | Auto | Prefix removed |
| `feature/new-api` | pull_request | `new-api` | Auto | Same for PR events |
| `123-hotfix` | push | `pr-123-hotfix` | Auto | Default prefix `pr-` |
| `123-hotfix` | push | `fix-123-hotfix` | Manual | Custom prefix `fix-` |
| `refs/heads/develop` | push | `develop` | Auto | Git prefix stripped |
| `very-long-branch-name` | push | `very-long-branch-name-that` | Auto | Default truncation (26) |
| `very-long-branch-name` | push | `very-long-branc` | Manual | Custom truncation (15) |
| N/A | N/A | `production` | Manual | Explicit stage override |

## 🔧 Configuration Examples

### Complete Production Workflow

```yaml
name: Production Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Tests
        run: npm test

      - name: Deploy to Production
        id: deploy
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          stage: production  # Explicit stage for production
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: never
          fail-on-error: true

      - name: Notify Slack
        if: steps.deploy.outputs.success == 'true'
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: 'Production deployment successful! 🚀'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Pull Request Review Workflow

```yaml
name: PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      # Show infrastructure changes (stage auto-computed from PR branch)
      - name: Show Infrastructure Changes
        id: diff
        uses: kodehort/sst-ops-action@v1
        with:
          operation: diff
          # Stage automatically computed from PR branch name
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: always
          fail-on-error: false

      # Deploy preview environment (stage auto-computed from PR branch)
      - name: Deploy Preview Environment
        if: contains(github.event.pull_request.labels.*.name, 'deploy-preview')
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          # Stage automatically computed from PR branch name
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: on-success
```

### Multi-Environment Pipeline

```yaml
name: Multi-Environment Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        id: staging
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          stage: staging
          token: ${{ secrets.GITHUB_TOKEN }}

  deploy-production:
    needs: deploy-staging
    if: needs.deploy-staging.outputs.success == 'true'
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          stage: production
          token: ${{ secrets.GITHUB_TOKEN }}
```

## 🛠️ Advanced Configuration

### Package Manager/Runtime Configuration

Choose your preferred package manager or runtime for executing SST commands:

```yaml
# Use Bun (default)
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    runner: bun  # Executes: bun sst deploy --stage production

# Use npm with package scripts
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    runner: npm  # Executes: npm run sst -- deploy --stage production

# Use pnpm
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    runner: pnpm  # Executes: pnpm sst deploy --stage production

# Use Yarn
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    runner: yarn  # Executes: yarn sst deploy --stage production

# Use SST CLI directly (requires global installation)
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    runner: sst   # Executes: sst deploy --stage production
```

**Runner Selection Guide:**

| Runner | Best For | Command Format | Requirements |
|--------|----------|----------------|--------------|
| `bun` | Modern projects, fastest execution | `bun sst <operation>` | SST installed as dependency |
| `npm` | Traditional npm projects | `npm run sst -- <operation>` | SST script in package.json |
| `pnpm` | Efficient package management | `pnpm sst <operation>` | SST installed as dependency |
| `yarn` | Yarn-based projects | `yarn sst <operation>` | SST installed as dependency |
| `sst` | Direct CLI usage | `sst <operation>` | SST CLI globally installed |

### Error Handling

```yaml
- name: Deploy with Custom Error Handling
  id: deploy
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false  # Don't fail workflow
    max-output-size: 100000  # Increased output limit

- name: Handle Deployment Failure
  if: steps.deploy.outputs.success == 'false'
  run: |
    echo "Deployment failed with status: ${{ steps.deploy.outputs.completion_status }}"
    echo "Check the workflow summary for detailed error information"
    # Custom failure handling logic here
```

### Conditional Operations

```yaml
- name: Conditional Remove
  uses: kodehort/sst-ops-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}
    token: ${{ secrets.GITHUB_TOKEN }}
  # Only run on PR close, and only for certain file changes
  if: |
    github.event_name == 'pull_request' &&
    github.event.action == 'closed' &&
    contains(github.event.pull_request.head.ref, 'feature/')
```

### Output Processing

```yaml
- name: Process Deploy Outputs
  id: deploy
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Extract URLs
  run: |
    URLS='${{ steps.deploy.outputs.urls }}'
    echo "Deployed URLs: $URLS"

    # Parse JSON output
    echo "API_URL=$(echo '$URLS' | jq -r '.[0]')" >> $GITHUB_ENV
    echo "WEB_URL=$(echo '$URLS' | jq -r '.[1]')" >> $GITHUB_ENV

- name: Run Integration Tests
  run: |
    curl -f $API_URL/health || exit 1
    echo "Integration tests passed!"
```

## 🔒 Security Considerations

### Token Permissions

This action requires minimal GitHub token permissions:

```yaml
permissions:
  contents: read          # Read repository contents
  issues: write          # Create/update issue comments
  pull-requests: write   # Create/update PR comments
```

### AWS Credentials

Configure AWS credentials securely:

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_REGION: us-east-1
```

**Best Practices:**
- Use IAM roles with minimal required permissions
- Rotate credentials regularly
- Use environment-specific AWS accounts
- Enable CloudTrail for audit logging

### Secrets Management

```yaml
# Recommended secrets configuration
secrets:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Automatic
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

# Optional: Custom SST secrets
  SST_TELEMETRY_DISABLED: "1"
```

## 🚨 Troubleshooting

### Common Issues

#### Issue: "sst command not found"
**Solution:** Ensure SST CLI is installed in your project
```yaml
- name: Install SST CLI
  run: npm install @serverless-stack/cli
```

#### Issue: "Stage not found"
**Solution:** Verify stage exists in your SST configuration
```yaml
- name: Debug Stage
  run: |
    echo "Available stages:"
    npx sst list-stages || echo "No stages found"
```

#### Issue: AWS credentials not configured
**Solution:** Set up AWS credentials in repository secrets
```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

For more detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 📚 Documentation

- 📖 **[API Reference](API.md)** - Complete input/output documentation
- 🛠️ **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

## 📁 Examples

Real-world workflow examples are available in the [examples/](examples/) directory:

- **[Basic Deploy](examples/basic-deploy.yml)** - Simple deployment workflow
- **[PR Workflow](examples/pr-workflow.yml)** - Pull request diff and deploy
- **[Multi-Environment](examples/multi-environment.yml)** - Staging → Production pipeline
- **[Cleanup](examples/cleanup.yml)** - Resource cleanup strategies
- **[Error Handling](examples/error-handling.yml)** - Advanced error handling patterns

### Quick Development Setup

```bash
# Clone and setup
git clone https://github.com/kodehort/sst-ops-action.git
cd sst-ops-action
bun install

# Run tests
bun test

# Build and validate
bun run build
bun run validate
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for [SST (Serverless Stack)](https://sst.dev/) framework
- Powered by [GitHub Actions](https://github.com/features/actions) platform
- Uses [Bun](https://bun.sh/) runtime and [TypeScript](https://www.typescriptlang.org/)
- Inspired by the GitHub Actions community and SST ecosystem

---

**Need Help?**
- 🐛 [Report Issues](https://github.com/kodehort/sst-ops-action/issues)
- 📧 [Contact Maintainers](mailto:maintainers@kodehort.com)

Made with ❤️ by the Kodehort team
