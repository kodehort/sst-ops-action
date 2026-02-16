# SST Operations Action

[![CI](https://github.com/kodehort/sst-ops-action/actions/workflows/ci.yml/badge.svg)](https://github.com/kodehort/sst-ops-action/actions/workflows/ci.yml)
[![Release](https://github.com/kodehort/sst-ops-action/actions/workflows/release.yml/badge.svg)](https://github.com/kodehort/sst-ops-action/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/release/kodehort/sst-ops-action.svg)](https://github.com/kodehort/sst-ops-action/releases/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Unified GitHub Action for SST operations: deploy, diff, remove, and stage computation. Consolidates multiple composite actions into a single distributable solution.

## Quick Start

### Deploy

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    token: ${{ secrets.GITHUB_TOKEN }}
    # stage auto-computed from branch/PR when omitted
```

### Diff on PRs

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
```

### Remove on PR Close

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `operation` | SST operation: `deploy`, `diff`, `remove`, `stage` | **Yes** | - |
| `token` | GitHub token (not required for `stage` operation) | Yes | - |
| `stage` | SST stage name. Auto-computed for `deploy` if omitted. Required for `diff` and `remove`. | No | - |
| `runner` | Runtime: `bun`, `npm`, `pnpm`, `yarn`, `sst` | No | `bun` |
| `comment-mode` | PR comment behavior: `always`, `on-success`, `on-failure`, `never` | No | `on-success` |
| `fail-on-error` | Fail workflow on SST errors | No | `true` |
| `max-output-size` | Max output bytes before truncation (1000-1000000) | No | `50000` |
| `truncation-length` | Max stage name length (stage op only) | No | `26` |
| `prefix` | Prefix for numeric stage names (stage op only) | No | `pr-` |

## Outputs

| Output | Description | Operations |
|--------|-------------|------------|
| `success` | Whether operation completed successfully | All |
| `operation` | Operation performed | All |
| `stage` | Stage operated on | All |
| `app` | SST app name | deploy, diff, remove |
| `resource_changes` | Number of resource changes | deploy, remove |
| `outputs` | JSON array of deployment outputs (key/value pairs) | deploy |
| `diff_summary` | Summary of planned changes | diff |
| `completion_status` | `complete`, `partial`, or `failed` | All |
| `permalink` | SST Console permalink | deploy, diff, remove |
| `truncated` | Whether output was truncated | All |
| `computed_stage` | Computed stage name | stage |
| `ref` | Git ref used for computation | stage |
| `event_name` | GitHub event type | stage |
| `is_pull_request` | Whether event is a PR | stage |

## Operations

### Deploy

Deploys SST application to the specified stage. Auto-computes stage from Git context when `stage` is omitted.

```yaml
- name: Deploy
  id: deploy
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success
```

Features:
- Deploys all stack resources and extracts deployment outputs
- Tracks resource changes (created, updated, unchanged)
- Posts PR comments with deployment status
- Generates workflow summaries and uploads artifacts

### Diff

Previews infrastructure changes without deploying. Requires explicit `stage` to compare against.

```yaml
- name: Preview Changes
  uses: kodehort/sst-ops-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
```

Features:
- Shows planned resource changes categorized by impact
- Generates human-readable diff summary with resource counts
- Creates detailed PR comments -- no actual infrastructure changes

### Remove

Deletes all resources for the specified stage. Requires explicit `stage` for safety.

```yaml
- name: Cleanup PR Resources
  uses: kodehort/sst-ops-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

Features:
- Removes all stack resources for the stage
- Tracks cleanup status and handles partial cleanup
- Auto-confirms removal in CI

### Stage

Computes stage name from Git context. Utility operation -- no infrastructure access, no token required.

```yaml
- name: Compute Stage
  id: stage
  uses: kodehort/sst-ops-action@v1
  with:
    operation: stage
    truncation-length: 20
    prefix: feat-

- name: Deploy with Computed Stage
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: ${{ steps.stage.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

The same computation runs automatically when `deploy` is called without a `stage` input. Use the explicit `stage` operation when you need the computed name in other steps.

**Computation rules:**

| Rule | Example |
|------|---------|
| Strip path prefixes (`refs/heads/`, `feature/`) | `feature/user-auth` -> `user-auth` |
| Lowercase, replace non-alphanumeric with hyphens | `My_Branch` -> `my-branch` |
| Truncate to length (default 26) | `very-long-branch-name-exceeding` -> `very-long-branch-name-exce` |
| Prefix numeric names (default `pr-`) | `123-hotfix` -> `pr-123-hotfix` |
| Strip leading/trailing hyphens | `-cleaned-` -> `cleaned` |

## Configuration

### Runner Selection

| Runner | Command | Requirements |
|--------|---------|--------------|
| `bun` (default) | `bun sst <op>` | SST as dependency |
| `npm` | `npm run sst -- <op>` | SST script in package.json |
| `pnpm` | `pnpm sst <op>` | SST as dependency |
| `yarn` | `yarn sst <op>` | SST as dependency |
| `sst` | `sst <op>` | SST CLI globally installed |

### Error Handling

```yaml
- name: Deploy
  id: deploy
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false

- name: Handle Failure
  if: steps.deploy.outputs.success == 'false'
  run: echo "Deploy failed: ${{ steps.deploy.outputs.completion_status }}"
```

### Output Processing

```yaml
- name: Deploy
  id: deploy
  uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use Outputs
  run: |
    OUTPUTS='${{ steps.deploy.outputs.outputs }}'
    echo "Deployment outputs: $OUTPUTS"
    echo "API_URL=$(echo '$OUTPUTS' | jq -r '.[0].value')" >> $GITHUB_ENV
```

## Security

### Token Permissions

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

### AWS Credentials

Configure via repository secrets:

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_REGION: us-east-1
```

Use IAM roles with minimal permissions. Rotate credentials regularly. Consider environment-specific AWS accounts.

## Troubleshooting

**"sst command not found"** -- Ensure SST is installed: `npm install sst`

**"Stage not found"** -- Verify the stage exists in your SST configuration and that AWS credentials are set.

**AWS credentials not configured** -- Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in repository secrets.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more.

## Documentation

- [API Reference](API.md) -- complete input/output docs
- [Troubleshooting](TROUBLESHOOTING.md) -- common issues and solutions
- [Examples](examples/) -- real-world workflow files

## Development

```bash
bun install && bun run validate
```

## License

MIT -- see [LICENSE](LICENSE).

---

Built for [SST](https://sst.dev/) | Powered by [GitHub Actions](https://github.com/features/actions)

[Report Issues](https://github.com/kodehort/sst-ops-action/issues)
