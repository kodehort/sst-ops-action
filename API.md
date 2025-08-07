# API Reference

Complete reference documentation for all inputs, outputs, and behavior of the SST Operations Action.

## Quick Navigation

- [Action Metadata](#action-metadata)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Operations](#operations)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)

---

## Action Metadata

```yaml
name: 'SST Operations Action'
description: 'A unified GitHub Action for SST operations: deploy, diff, and remove'
author: 'Kodehort'
branding:
  icon: 'cloud'
  color: 'orange'
runs:
  using: 'node20'
  main: 'dist/index.js'
```

**Runtime Requirements:**
- Node.js 20 or higher (handled automatically by GitHub Actions)
- GitHub Actions environment
- Repository with SST configuration

---

## Inputs

All inputs are defined in `action.yml` and processed by the action's validation system.

### `operation`

**Description:** SST operation to perform  
**Required:** No  
**Default:** `"deploy"`  
**Type:** String (Enum)  

**Valid Values:**
- `"deploy"` - Deploy SST application to specified stage
- `"diff"` - Show infrastructure changes without deploying  
- `"remove"` - Remove all resources for specified stage

**Examples:**
```yaml
# Default operation (deploy)
- uses: kodehort/sst-operations-action@v1
  with:
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}

# Explicit operation
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Validation:**
- Must be one of the valid values
- Case-sensitive string matching
- Defaults to `"deploy"` if not specified

---

### `stage`

**Description:** SST stage to operate on  
**Required:** Yes  
**Default:** None  
**Type:** String  

**Valid Format:**
- Alphanumeric characters and hyphens only
- Must start with letter or number
- Maximum length: 128 characters
- Minimum length: 1 character

**Examples:**
```yaml
# Simple stage names
stage: production
stage: staging
stage: development

# Dynamic stage names
stage: pr-${{ github.event.number }}
stage: feature-${{ github.run_id }}
stage: ${{ github.ref_name }}

# Sanitized branch names
stage: ${{ steps.sanitize.outputs.stage }}
```

**Common Patterns:**
- `production` - Production environment
- `staging` - Staging environment  
- `pr-123` - Pull request environments
- `dev-john` - Developer-specific stages
- `feature-xyz` - Feature branch stages

**Validation:**
- Required input, action fails if not provided
- Must match regex: `^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$`
- Cannot be empty string

---

### `token`

**Description:** GitHub token for authentication and API access  
**Required:** Yes  
**Default:** None  
**Type:** String (Secret)  

**Usage:**
```yaml
# Built-in token (recommended)
token: ${{ secrets.GITHUB_TOKEN }}

# Personal access token
token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
```

**Required Permissions:**
```yaml
permissions:
  contents: read          # Read repository contents
  issues: write          # Create/update issue comments  
  pull-requests: write   # Create/update PR comments
  actions: write         # Upload artifacts
```

**Token Capabilities:**
- Create and update PR/issue comments
- Upload workflow artifacts
- Set workflow status
- Access repository metadata

**Validation:**
- Required input, action fails if not provided
- Must be valid GitHub token format
- Token permissions validated at runtime

---

### `comment-mode`

**Description:** Controls when PR/issue comments are created  
**Required:** No  
**Default:** `"on-success"`  
**Type:** String (Enum)  

**Valid Values:**
- `"always"` - Always create comments, regardless of outcome
- `"on-success"` - Create comments only when operation succeeds
- `"on-failure"` - Create comments only when operation fails
- `"never"` - Never create comments

**Examples:**
```yaml
# Show diff results in all PRs
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always

# Only comment on successful deployments  
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success

# Silent operation (no comments)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: never
```

**Comment Context:**
- Comments only created in PR and issue contexts
- No comments in push/schedule contexts regardless of mode
- Comments include operation results, URLs, and error details

**Validation:**
- Must be one of the valid values
- Defaults to `"on-success"` if not specified
- Case-sensitive string matching

---

### `fail-on-error`

**Description:** Whether to fail the GitHub Actions workflow when operation fails  
**Required:** No  
**Default:** `true`  
**Type:** Boolean  

**Valid Values:**
- `true` - Fail workflow when operation fails (recommended)
- `false` - Continue workflow even if operation fails

**Examples:**
```yaml
# Fail workflow on error (default)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: true

# Continue workflow on error
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false
```

**Use Cases for `false`:**
- Optional deployments that shouldn't block other jobs
- Exploratory operations where failure is acceptable
- Custom error handling workflows

**Behavior:**
- When `true`: Sets workflow status to failed on operation failure
- When `false`: Workflow continues, check outputs for success status
- Error details always available in outputs regardless of setting

**Validation:**
- Must be boolean value (`true` or `false`)
- String values `"true"` and `"false"` automatically converted
- Invalid values default to `true`

---

### `max-output-size`

**Description:** Maximum size of captured output in bytes  
**Required:** No  
**Default:** `50000` (50KB)  
**Type:** Integer  

**Valid Range:**
- Minimum: `1000` (1KB)
- Maximum: `1000000` (1MB)  
- Default: `50000` (50KB)

**Examples:**
```yaml
# Default size (50KB)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}

# Increased size for large deployments
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    max-output-size: 200000  # 200KB

# Debug mode with maximum size
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    max-output-size: 1000000  # 1MB
```

**Impact:**
- Larger values capture more detailed output
- Smaller values improve performance and reduce memory usage
- Truncated output indicated in `truncated` output field

**When to Adjust:**
- **Increase** for large SST applications with many resources
- **Increase** when debugging requires full output
- **Decrease** for performance-critical workflows
- **Decrease** when output parsing issues occur

**Validation:**
- Must be integer between 1000 and 1000000
- Values outside range are clamped to limits
- String values automatically converted to integers

---

## Outputs

All outputs are provided as strings (GitHub Actions requirement) and available for use in subsequent workflow steps.

### `success`

**Description:** Whether the operation completed successfully  
**Type:** String  
**Format:** `"true"` or `"false"`  

**Usage:**
```yaml
- name: Deploy
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Handle Success
  if: steps.deploy.outputs.success == 'true'
  run: echo "Deployment successful!"

- name: Handle Failure  
  if: steps.deploy.outputs.success == 'false'
  run: echo "Deployment failed!"
```

**Values:**
- `"true"` - Operation completed successfully
- `"false"` - Operation failed or encountered errors

**Notes:**
- Always set, regardless of operation type
- String comparison required (`== 'true'`, not `== true`)
- Reflects final operation status after all processing

---

### `operation`

**Description:** The operation that was performed  
**Type:** String  
**Format:** Operation name  

**Values:**
- `"deploy"` - Deploy operation was executed
- `"diff"` - Diff operation was executed  
- `"remove"` - Remove operation was executed

**Usage:**
```yaml
- name: Check Operation Type
  run: |
    case "${{ steps.sst.outputs.operation }}" in
      "deploy")
        echo "Deployment completed"
        ;;
      "diff")
        echo "Diff analysis completed"
        ;;
      "remove")
        echo "Resource removal completed"
        ;;
    esac
```

**Notes:**
- Matches the input `operation` parameter
- Useful for generic workflows handling multiple operations
- Always set to the actual operation performed

---

### `stage`

**Description:** The stage that was operated on  
**Type:** String  
**Format:** Stage name  

**Usage:**
```yaml
- name: Report Stage
  run: |
    echo "Operated on stage: ${{ steps.sst.outputs.stage }}"
    echo "DEPLOYED_STAGE=${{ steps.sst.outputs.stage }}" >> $GITHUB_ENV
```

**Notes:**
- Matches the input `stage` parameter
- Useful for downstream processing and notifications
- Always reflects the actual stage used

---

### `app`

**Description:** The SST application name  
**Type:** String  
**Format:** Application name from SST configuration  

**Usage:**
```yaml
- name: Use App Name
  run: |
    APP_NAME="${{ steps.sst.outputs.app }}"
    echo "Deployed app: $APP_NAME"
    
    # Use in notifications
    curl -X POST $SLACK_WEBHOOK \
      -d "{'text': 'Deployed $APP_NAME to ${{ steps.sst.outputs.stage }}'}"
```

**Notes:**
- Extracted from SST configuration (`sst.config.ts`)
- Empty string if app name cannot be determined
- Useful for multi-app repositories

---

### `resource_changes`

**Description:** Number of resource changes made  
**Type:** String (Integer)  
**Format:** Numeric string  

**Values:**
- `"0"` - No resources changed
- `"5"` - Five resources changed
- `""` - Could not determine (parsing failed)

**Usage:**
```yaml
- name: Report Resource Changes
  run: |
    CHANGES="${{ steps.sst.outputs.resource_changes }}"
    if [ "$CHANGES" = "0" ]; then
      echo "No infrastructure changes"
    else
      echo "Changed $CHANGES resources"
    fi
```

**Operation-Specific Behavior:**
- **Deploy:** Number of created, updated, or modified resources
- **Diff:** Number of planned changes  
- **Remove:** Number of deleted resources

---

### `urls` (Deploy Only)

**Description:** Deployed application URLs  
**Type:** String (JSON Array)  
**Format:** JSON-encoded array of URLs  

**Example Values:**
```json
["https://api.example.com"]
["https://web.example.com", "https://api.example.com"]
[]
```

**Usage:**
```yaml
- name: Extract URLs
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Process URLs
  run: |
    URLS='${{ steps.deploy.outputs.urls }}'
    echo "Raw URLs: $URLS"
    
    # Parse JSON array
    echo "First URL: $(echo '$URLS' | jq -r '.[0] // "none"')"
    
    # Set as environment variables
    API_URL=$(echo '$URLS' | jq -r '.[] | select(contains("api"))')
    WEB_URL=$(echo '$URLS' | jq -r '.[] | select(contains("web"))')
    
    echo "API_URL=$API_URL" >> $GITHUB_ENV
    echo "WEB_URL=$WEB_URL" >> $GITHUB_ENV

- name: Test Deployed URLs
  run: |
    for url in $(echo '${{ steps.deploy.outputs.urls }}' | jq -r '.[]'); do
      echo "Testing: $url"
      curl -f "$url/health" || echo "Health check failed for $url"
    done
```

**URL Types:**
- API endpoints (API Gateway, ALB)
- Web applications (CloudFront, S3)
- Function URLs (Lambda)
- WebSocket APIs

**Notes:**
- Only populated for `deploy` operations
- Empty array `[]` if no URLs deployed
- JSON parsing required to extract individual URLs

---

### `diff_summary` (Diff Only)

**Description:** Human-readable summary of planned changes  
**Type:** String  
**Format:** Plain text summary  

**Example Values:**
```
"3 resources to create, 1 to update"
"No changes detected"
"2 resources to delete"
"5 resources to create, 2 to update, 1 to delete"
```

**Usage:**
```yaml
- name: Show Diff Summary
  run: |
    SUMMARY="${{ steps.diff.outputs.diff_summary }}"
    echo "Infrastructure changes: $SUMMARY"
    
    # Use in PR comments or notifications
    if [ -n "$SUMMARY" ]; then
      echo "## Infrastructure Changes" >> $GITHUB_STEP_SUMMARY
      echo "$SUMMARY" >> $GITHUB_STEP_SUMMARY
    fi
```

**Notes:**
- Only populated for `diff` operations
- Empty string if no changes or parsing failed
- Human-readable format for notifications and reports

---

### `completion_status`

**Description:** Final operation status with additional detail  
**Type:** String  
**Format:** Status keyword  

**Values:**
- `"success"` - Operation completed successfully
- `"failed"` - Operation failed completely
- `"partial"` - Operation partially completed (some resources succeeded)
- `"timeout"` - Operation timed out
- `"cancelled"` - Operation was cancelled

**Usage:**
```yaml
- name: Handle Completion Status
  run: |
    STATUS="${{ steps.sst.outputs.completion_status }}"
    case "$STATUS" in
      "success")
        echo "✅ Full success"
        ;;
      "partial") 
        echo "⚠️ Partial completion - review required"
        ;;
      "failed"|"timeout"|"cancelled")
        echo "❌ Operation failed: $STATUS"
        exit 1
        ;;
    esac
```

**Relationship to `success`:**
- `success: "true"` when `completion_status: "success"`
- `success: "false"` for all other completion statuses
- Provides more granular information than boolean success

---

### `permalink`

**Description:** SST Console permalink for operation results  
**Type:** String  
**Format:** URL or empty string  

**Example Values:**
```
"https://console.sst.dev/apps/my-app/stages/production/deployments/123"
""
```

**Usage:**
```yaml
- name: Share Console Link
  run: |
    PERMALINK="${{ steps.sst.outputs.permalink }}"
    if [ -n "$PERMALINK" ]; then
      echo "📊 View details: $PERMALINK"
      echo "SST_CONSOLE_URL=$PERMALINK" >> $GITHUB_ENV
    else
      echo "No console permalink available"
    fi
```

**Notes:**
- May be empty if SST Console integration unavailable
- Useful for sharing operation details with team
- Links to relevant SST Console sections

---

### `truncated`

**Description:** Whether operation output was truncated due to size limits  
**Type:** String  
**Format:** `"true"` or `"false"`  

**Values:**
- `"true"` - Output was truncated, some information may be missing
- `"false"` - Complete output captured

**Usage:**
```yaml
- name: Check for Truncated Output
  run: |
    if [ "${{ steps.sst.outputs.truncated }}" = "true" ]; then
      echo "⚠️ Output was truncated"
      echo "Consider increasing max-output-size parameter"
      echo "Some details may be missing from parsing"
    fi
```

**When Output is Truncated:**
- Output exceeded `max-output-size` parameter
- Parsing may be incomplete or less accurate
- Consider increasing `max-output-size` for full output

---

## Operations

Detailed behavior for each operation type.

### Deploy Operation

**Purpose:** Deploy SST application to specified stage

**Process:**
1. Execute `sst deploy --stage {stage}`
2. Parse deployment output for resources and URLs
3. Extract deployed URLs and resource changes
4. Create PR comments with deployment results
5. Upload artifacts with deployment logs

**Typical Duration:** 30 seconds to 15 minutes (default timeout)

**Success Conditions:**
- SST deploy command exits with code 0
- No critical CloudFormation errors
- Resources successfully created/updated

**Outputs Populated:**
- All standard outputs
- `urls` - Array of deployed URLs
- `resource_changes` - Number of resources modified

**Example:**
```yaml
- name: Deploy to Production
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: on-success
    
- name: Test Deployed Application
  run: |
    URLS='${{ steps.deploy.outputs.urls }}'
    for url in $(echo "$URLS" | jq -r '.[]'); do
      curl -f "$url/health" || exit 1
    done
```

### Diff Operation

**Purpose:** Show planned infrastructure changes without deploying

**Process:**
1. Execute `sst diff --stage {stage}`
2. Parse diff output for planned changes
3. Generate human-readable change summary
4. Create PR comments with change preview
5. No actual infrastructure modifications

**Typical Duration:** 10-60 seconds

**Success Conditions:**
- SST diff command exits successfully
- Changes successfully analyzed (even if no changes)

**Outputs Populated:**
- All standard outputs except `urls`
- `diff_summary` - Human-readable change summary
- `resource_changes` - Number of planned changes

**Example:**
```yaml
- name: Show Infrastructure Changes
  id: diff
  uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
    
- name: Evaluate Changes
  run: |
    CHANGES="${{ steps.diff.outputs.resource_changes }}"
    if [ "$CHANGES" -gt "10" ]; then
      echo "Large number of changes detected: $CHANGES"
      echo "Manual review recommended"
    fi
```

### Remove Operation

**Purpose:** Remove all resources for specified stage

**Process:**
1. Execute `sst remove --stage {stage}`
2. Parse removal output for deleted resources
3. Track cleanup status and any remaining resources
4. Create PR comments with cleanup results
5. Handle partial cleanup scenarios

**Typical Duration:** 1-10 minutes

**Success Conditions:**
- SST remove command completes
- Resources successfully deleted (partial success acceptable)

**Outputs Populated:**
- All standard outputs except `urls` and `diff_summary`
- `resource_changes` - Number of resources removed
- `completion_status` - May be "partial" for incomplete removal

**Example:**
```yaml
- name: Cleanup PR Environment
  id: cleanup
  uses: kodehort/sst-operations-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false  # Allow partial cleanup
    
- name: Handle Cleanup Results
  run: |
    if [ "${{ steps.cleanup.outputs.success }}" = "false" ]; then
      echo "Cleanup issues detected"
      echo "Status: ${{ steps.cleanup.outputs.completion_status }}"
      # Manual cleanup may be required
    fi
```

---

## Examples

### Basic Usage Examples

#### Simple Deploy
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### Infrastructure Review
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
```

#### Resource Cleanup
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    operation: remove
    stage: feature-branch
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Configuration Examples

#### Production Deploy with Validation
```yaml
- name: Deploy to Production
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: never
    fail-on-error: true
    max-output-size: 100000
    
- name: Validate Deployment
  run: |
    if [ "${{ steps.deploy.outputs.success }}" = "true" ]; then
      echo "✅ Deployment successful"
      echo "URLs deployed: ${{ steps.deploy.outputs.urls }}"
      echo "Resources changed: ${{ steps.deploy.outputs.resource_changes }}"
      
      # Run health checks
      URLS='${{ steps.deploy.outputs.urls }}'
      for url in $(echo "$URLS" | jq -r '.[]'); do
        echo "Testing: $url"
        curl -f "$url/health" || exit 1
      done
    else
      echo "❌ Deployment failed"
      echo "Status: ${{ steps.deploy.outputs.completion_status }}"
      exit 1
    fi
```

#### Conditional Operations
```yaml
- name: Conditional Deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: ${{ github.event_name == 'pull_request' && 'diff' || 'deploy' }}
    stage: ${{ github.event_name == 'pull_request' && 'staging' || 'production' }}
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: ${{ github.event_name == 'pull_request' && 'always' || 'on-failure' }}
```

#### Multi-Stage Pipeline
```yaml
- name: Deploy to Staging
  id: staging
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    
- name: Run Integration Tests
  run: |
    # Integration tests against staging
    npm run test:integration
    
- name: Deploy to Production
  if: steps.staging.outputs.success == 'true'
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Error Handling

### Error Categories

The action categorizes errors for better handling and recovery:

#### CLI Execution Errors
```
Error: SST command failed with exit code 1
```
**Cause:** SST CLI command failed  
**Recovery:** Check SST configuration and AWS credentials

#### Validation Errors  
```
Error: Invalid operation: "deployment"
```
**Cause:** Invalid input parameters  
**Recovery:** Correct input values

#### Parsing Errors
```
Warning: Failed to parse deployment URLs
```
**Cause:** Unexpected SST output format  
**Recovery:** Operation may succeed but outputs incomplete

#### GitHub API Errors
```
Error: Bad credentials
```
**Cause:** Invalid or insufficient GitHub token  
**Recovery:** Check token permissions

### Error Output Format

When operations fail, outputs are still populated with available information:

```yaml
# Failed operation outputs
success: "false"
operation: "deploy"
stage: "staging"
app: "my-app"
completion_status: "failed"
resource_changes: "0"
urls: "[]"
truncated: "false"
permalink: ""
```

### Error Handling Patterns

#### Fail-Fast Pattern
```yaml
- name: Deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: production
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: true  # Fail immediately on error
```

#### Continue-on-Error Pattern
```yaml
- name: Optional Deploy
  id: deploy
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false
    
- name: Handle Deploy Result
  run: |
    if [ "${{ steps.deploy.outputs.success }}" = "false" ]; then
      echo "Deploy failed, continuing with alternatives"
      # Alternative logic here
    fi
```

#### Retry Pattern
```yaml
- name: Deploy with Retry
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_on: error
    command: |
      # Use the action within retry logic
      echo "Attempting deployment..."
```

---

## Environment Variables

The action respects several environment variables for configuration:

### AWS Configuration
```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_REGION: us-east-1
  AWS_DEFAULT_REGION: us-east-1
```

### SST Configuration  
```yaml
env:
  SST_TELEMETRY_DISABLED: "1"  # Disable telemetry
  SST_DEBUG: "1"              # Enable debug mode
  SST_STAGE: staging          # Default stage (overridden by input)
```

### GitHub Actions
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ACTIONS_STEP_DEBUG: true    # Enable debug logging
```

### Custom Configuration
```yaml
env:
  NODE_ENV: production
  CI: true
  FORCE_COLOR: "1"           # Colorized output
```

---

This API reference provides complete documentation for all aspects of the SST Operations Action. For additional examples and use cases, see the [README.md](README.md) and [examples/](examples/) directory.