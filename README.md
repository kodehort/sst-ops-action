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
| `working-directory` | Directory containing `sst.config.ts` | No | `.` |
| `cache-providers` | Cache SST providers between runs ([see below](#caching-sst-providers)) | No | `false` |
| `truncation-length` | Max stage name length (stage op only) | No | `26` |
| `prefix` | Prefix for numeric stage names (stage op only) | No | `pr-` |

## Outputs

| Output | Description | Operations |
|--------|-------------|------------|
| `success` | Whether operation completed successfully | All |
| `operation` | Operation performed | All |
| `stage` | Stage operated on | All |
| `app` | SST app name | deploy, diff, remove |
| `resource_changes` | Number of resource changes; mirrors `planned_changes` for diff and `resources_removed` for remove | deploy, diff, remove |
| `outputs` | JSON array of deployment outputs (`key`/`value` pairs) | deploy |
| `urls` | JSON array of the http(s) URLs SST reported (`key`/`value` pairs) | deploy, diff |
| `resources` | JSON array of reported resources (`name`/`type`/`status`) | deploy |
| `diff_summary` | Summary of planned changes | diff |
| `planned_changes` | Number of changes SST plans to make | diff |
| `resources_removed` | Number of resources removed | remove |
| `removed_resources` | JSON array of removed resources (`name`/`type`/`status`) | remove |
| `error` | Error message when the operation fails; empty on success | All |
| `completion_status` | `complete`, `partial`, `failed`, or `skipped` (remove only: stage not deployed) | All |
| `permalink` | SST Console permalink | deploy, diff, remove |
| `truncated` | Whether output was truncated | All |
| `computed_stage` | Computed stage name | stage |
| `ref` | Git ref used for computation | stage |
| `event_name` | GitHub event type | stage |
| `is_pull_request` | Whether event is a PR | stage |
| `stages` | JSON array of `{ref, stage}` pairs for the `refs` input | stage |

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
- Generates workflow summaries

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

### Caching SST Providers

On a clean runner, the first SST command has to bootstrap the app before it can
do any work: generate `.sst/platform`, fetch the vendored `pulumi` and `bun`
binaries, and download every provider plugin declared in `sst.config.ts`. That
happens on every run, and on a multi-provider app it can dominate a short
deploy.

Set `cache-providers: true` and the action restores that work from the GitHub
Actions cache, runs `sst install` when there is nothing to restore, and saves
the result:

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    token: ${{ secrets.GITHUB_TOKEN }}
    cache-providers: true
```

What gets cached:

| Path | Contents |
|------|----------|
| `<working-directory>/.sst/platform` | Generated platform sources and typings |
| `~/.config/sst/plugins` | Provider plugins — the bulk of it |
| `~/.config/sst/bin` | The vendored `pulumi` and `bun` binaries |

The cache key is the runner's OS and architecture, the working directory, the
installed SST version (read from `node_modules/sst`), and a hash of
`sst.config.ts`. Providers are declared in that file, so adding one produces a
new key and a fresh install; the previous entry is still reused as a starting
point, since the plugin downloads are pinned by the SST version.

Install dependencies before this step — the SST version comes from
`node_modules`. Everything about the cache fails open: an unavailable cache
service, an unreadable config, or a failed `sst install` produces a warning and
the operation runs as it would have anyway.

For a monorepo, point `working-directory` at the app. Each app gets its own
cache entry:

```yaml
- uses: kodehort/sst-ops-action@v1
  with:
    operation: deploy
    token: ${{ secrets.GITHUB_TOKEN }}
    working-directory: packages/infra
    cache-providers: true
```

Provider plugins are large, and GitHub gives each repository 10 GB of cache
with least-recently-used eviction — worth knowing if the repository caches
other things it cares about.

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
    echo "API_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.key == "Api") | .value')" >> $GITHUB_ENV

- name: Smoke Test Every Deployed URL
  run: |
    echo '${{ steps.deploy.outputs.urls }}' \
      | jq -r '.[] | "\(.key) \(.value)"' \
      | while read -r key url; do
          curl -fsS "$url" > /dev/null && echo "$key ok" || echo "$key FAILED"
        done
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
