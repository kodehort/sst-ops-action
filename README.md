# SST Operations Action

[![CI](https://github.com/kodehort/sst-ops-action/actions/workflows/ci.yml/badge.svg)](https://github.com/kodehort/sst-ops-action/actions/workflows/ci.yml)
[![Release](https://github.com/kodehort/sst-ops-action/actions/workflows/release.yml/badge.svg)](https://github.com/kodehort/sst-ops-action/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/release/kodehort/sst-ops-action.svg)](https://github.com/kodehort/sst-ops-action/releases/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified, production-ready GitHub Action for **SST (Serverless Stack)** operations: deploy, diff, and remove. This action consolidates functionality from multiple composite actions into a single, maintainable, and distributable solution.

## ✨ Features

- 🚀 **Multi-Operation Support** - Deploy, diff, and remove operations in one action
- 📝 **Automated PR Comments** - Rich markdown comments with deployment status and changes
- 🔍 **Infrastructure Diff** - See planned changes before deployment
- 🧹 **Resource Cleanup** - Automated removal of staging environments
- ⚙️ **Configurable Runtime** - Support for Bun, npm, pnpm, Yarn, or direct SST CLI
- 📊 **GitHub Integration** - Workflow summaries, artifacts, and status reporting

## 🚀 Quick Start

### Basic Deploy

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
          stage: staging
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

## 📖 Usage

### Inputs

| Input | Description | Required | Default | Example |
|-------|-------------|----------|---------|---------|
| `operation` | SST operation to perform | No | `deploy` | `deploy`, `diff`, `remove` |
| `stage` | SST stage to operate on | Yes | - | `production`, `staging`, `pr-123` |
| `token` | GitHub token for authentication | Yes | - | `${{ secrets.GITHUB_TOKEN }}` |
| `runner` | Package manager/runtime for SST commands | No | `bun` | `bun`, `npm`, `pnpm`, `yarn`, `sst` |
| `comment-mode` | When to create PR comments | No | `on-success` | `always`, `on-success`, `on-failure`, `never` |
| `fail-on-error` | Whether to fail the workflow on errors | No | `true` | `true`, `false` |
| `max-output-size` | Maximum output size in bytes | No | `50000` | `100000` |

### Outputs

| Output | Description | Type | Example |
|--------|-------------|------|---------|
| `success` | Whether the operation completed successfully | String | `"true"`, `"false"` |
| `operation` | The operation that was performed | String | `"deploy"`, `"diff"`, `"remove"` |
| `stage` | The stage that was operated on | String | `"production"`, `"staging"` |
| `app` | The SST app name | String | `"my-app"` |
| `resource_changes` | Number of resource changes | String | `"5"` |
| `urls` | Deployed URLs (deploy only) | JSON String | `["https://api.example.com"]` |
| `diff_summary` | Diff summary (diff only) | String | `"3 resources to create, 1 to update"` |
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
          stage: production
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

      - name: Show Infrastructure Changes
        id: diff
        uses: kodehort/sst-ops-action@v1
        with:
          operation: diff
          stage: staging
          token: ${{ secrets.GITHUB_TOKEN }}
          comment-mode: always
          fail-on-error: false

      - name: Deploy Preview Environment
        if: contains(github.event.pull_request.labels.*.name, 'deploy-preview')
        uses: kodehort/sst-ops-action@v1
        with:
          operation: deploy
          stage: pr-${{ github.event.number }}
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
