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
description: 'A unified GitHub Action for SST operations: deploy, diff, remove, and stage'
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
- `"stage"` - Calculate stage name from Git branch or pull request

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

# Stage calculation operation
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Validation:**
- Must be one of the valid values
- Case-sensitive string matching
- Defaults to `"deploy"` if not specified

---

### `stage`

**Description:** SST stage to operate on (automatically computed from Git context if not provided)  
**Required:** No  
**Default:** Auto-computed from Git context (branch/PR name)  
**Type:** String  

**Valid Format:**
- Alphanumeric characters and hyphens only
- Must start with letter or number
- Maximum length: 128 characters
- Minimum length: 1 character

**Examples:**
```yaml
# Automatic stage inference (recommended)
# Stage computed from Git context (branch/PR name)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    # No stage input - automatically computed
    token: ${{ secrets.GITHUB_TOKEN }}

# Explicit stage names
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
- Optional input for all operations (automatically computed from Git context if not provided)
- When provided, must match regex: `^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$`
- Cannot be empty string if explicitly provided
- Falls back to automatic computation from branch/PR name when omitted

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
# Show diff results in all PRs (auto-computed stage)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: diff
    # Stage automatically computed from PR branch name
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

### `truncation-length`

**Description:** Maximum length for computed stage names (stage operation only)  
**Required:** No  
**Default:** `26`  
**Type:** Integer  

**Valid Range:**
- Minimum: `1`
- Maximum: `100`  
- Default: `26`

**Examples:**
```yaml
# Default length (26 characters)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}

# Custom length for shorter stage names
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    truncation-length: 15

# Longer stage names for environments without naming constraints
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    truncation-length: 50
```

**Impact:**
- Controls maximum length of computed stage names
- Truncation includes any prefix
- Trailing hyphens are cleaned up after truncation
- Useful for services with specific naming constraints (Route53, ELBs, etc.)

**When to Adjust:**
- **Decrease** for strict naming requirements (e.g., Route53 subdomain limits)
- **Increase** when longer, more descriptive stage names are needed
- **Customize** based on target infrastructure constraints

**Validation:**
- Must be integer between 1 and 100
- Values outside range are constrained to limits
- String values automatically converted to integers

---

### `prefix`

**Description:** Prefix to add when stage name starts with a number (stage operation only)  
**Required:** No  
**Default:** `"pr-"`  
**Type:** String  

**Valid Format:**
- Maximum length: 10 characters
- Must contain only lowercase letters, numbers, and hyphens
- Can be empty string to disable prefixing

**Examples:**
```yaml
# Default prefix ('pr-')
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}

# Custom prefix for issue tracking
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    prefix: "issue-"

# No prefix (empty string)
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    prefix: ""

# Ticket system integration
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    prefix: "ticket-"
```

**Usage Examples:**
| Branch Name | Prefix | Result |
|-------------|--------|--------|
| `123-hotfix` | `pr-` | `pr-123-hotfix` |
| `456-feature` | `fix-` | `fix-456-feature` |
| `789-update` | `` (empty) | `789-update` |
| `bug-123` | `issue-` | `bug-123` (no prefix, doesn't start with digit) |

**Impact:**
- Only applied when stage name starts with a digit
- Prefix is included in truncation length calculation
- Useful for integrating with ticket systems or issue trackers
- Ensures valid resource names in cloud environments

**When to Customize:**
- **Issue Tracking**: Use `issue-` for GitHub issues or Jira tickets
- **Bug Fixes**: Use `fix-` or `hotfix-` for hotfix branches
- **No Prefix**: Use empty string when numeric names are acceptable
- **Team Conventions**: Match your team's branch naming standards

**Validation:**
- Maximum 10 characters
- Must match regex: `^[a-z0-9-]*$`
- Empty string is valid (disables prefixing)
- Invalid characters are rejected

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
- `"stage"` - Stage operation was executed

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
      "stage")
        echo "Stage calculation completed"
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

**Description:** Deployed application URLs extracted from generic outputs  
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
- Empty array `[]` if no URLs found in outputs
- JSON parsing required to extract individual URLs
- URLs are extracted from the generic SST outputs during parsing

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

### `computed_stage` (Stage Only)

**Description:** Computed stage name from Git branch or pull request  
**Type:** String  
**Format:** Stage name (kebab-case)  

**Example Values:**
```
"main"
"feature-branch"
"user-authentication"
"pr-123-hotfix"
```

**Usage:**
```yaml
- name: Calculate Stage
  id: stage-calc
  uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use Computed Stage
  run: |
    STAGE="${{ steps.stage-calc.outputs.computed_stage }}"
    echo "Computed stage: $STAGE"
    
    # Use in subsequent operations
    echo "DEPLOYMENT_STAGE=$STAGE" >> $GITHUB_ENV

- name: Deploy with Computed Stage
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: ${{ steps.stage-calc.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Stage Computation Rules:**
- Branch `main` → stage `main`
- Branch `feature/user-auth` → stage `user-auth`
- Branch `123-hotfix` → stage `pr-123-hotfix`
- Pull request from `feature/api` → stage `api`
- Maximum 26 characters for Route53 compatibility
- Sanitized to alphanumeric + hyphens only

**Notes:**
- Only populated for `stage` operations
- Always produces a valid stage name or uses fallback
- Follows consistent naming conventions across environments

---

### `ref` (Stage Only)

**Description:** Git reference that was used for stage computation  
**Type:** String  
**Format:** Git reference path  

**Example Values:**
```
"refs/heads/main"
"refs/heads/feature/user-auth"
"feature-branch"
""
```

**Usage:**
```yaml
- name: Show Git Reference
  run: |
    REF="${{ steps.stage-calc.outputs.ref }}"
    echo "Computed from ref: $REF"
    
    # Use in commit status or notifications
    if [ -n "$REF" ]; then
      echo "Source: $REF" >> $GITHUB_STEP_SUMMARY
    fi
```

**Notes:**
- Only populated for `stage` operations
- May be empty if ref cannot be determined
- Useful for debugging stage computation

---

### `event_name` (Stage Only)

**Description:** GitHub event type that triggered the workflow  
**Type:** String  
**Format:** GitHub event name  

**Example Values:**
```
"push"
"pull_request"
"workflow_dispatch"
"schedule"
```

**Usage:**
```yaml
- name: Handle Event Type
  run: |
    EVENT="${{ steps.stage-calc.outputs.event_name }}"
    case "$EVENT" in
      "pull_request")
        echo "Processing pull request stage"
        ;;
      "push")
        echo "Processing push event stage"
        ;;
      *)
        echo "Processing $EVENT event stage"
        ;;
    esac
```

**Notes:**
- Only populated for `stage` operations
- Matches `github.context.eventName`
- Useful for conditional logic based on event type

---

### `is_pull_request` (Stage Only)

**Description:** Whether the stage was computed from a pull request  
**Type:** String  
**Format:** `"true"` or `"false"`  

**Values:**
- `"true"` - Stage computed from pull request context
- `"false"` - Stage computed from push or other event

**Usage:**
```yaml
- name: Handle Pull Request
  run: |
    if [ "${{ steps.stage-calc.outputs.is_pull_request }}" = "true" ]; then
      echo "This is a pull request deployment"
      echo "Stage: ${{ steps.stage-calc.outputs.computed_stage }}"
      echo "Will be cleaned up when PR closes"
    else
      echo "This is a direct branch deployment"
    fi
```

**Notes:**
- Only populated for `stage` operations
- String comparison required (`== 'true'`, not `== true`)
- Useful for conditional cleanup workflows

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
2. Parse deployment output for resources and generic outputs
3. Extract URLs and other outputs from generic parsing
4. Create PR comments with deployment results
5. Upload artifacts with deployment logs

**Typical Duration:** 30 seconds to 15 minutes (default timeout)

**Success Conditions:**
- SST deploy command exits with code 0
- No critical CloudFormation errors
- Resources successfully created/updated

**Outputs Populated:**
- All standard outputs
- `urls` - Array of URLs extracted from generic outputs
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
- All standard outputs (no URLs for diff operations)
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
- All standard outputs (no URLs or diff summaries for remove operations)
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

### Stage Operation

**Purpose:** Calculate stage name from Git branch or pull request information

**Process:**
1. Extract Git reference from GitHub context
2. Apply stage computation rules and sanitization  
3. Generate Route53-compatible stage name (≤26 characters)
4. Provide detailed context about computation
5. No SST CLI execution required

**Typical Duration:** < 1 second

**Success Conditions:**
- Git reference successfully extracted or fallback stage available
- Stage name passes validation rules
- GitHub context accessible

**Outputs Populated:**
- All standard outputs
- `computed_stage` - Final computed stage name
- `ref` - Git reference used for computation
- `event_name` - GitHub event type
- `is_pull_request` - Whether from pull request context

**Stage Computation Algorithm:**
1. **Extract Reference**: Get Git ref from GitHub context based on event type
2. **Remove Prefixes**: Strip `refs/heads/`, `feature/`, etc.
3. **Normalize**: Convert to lowercase
4. **Sanitize**: Replace non-alphanumeric chars with hyphens
5. **Clean**: Remove leading/trailing hyphens
6. **Truncate**: Limit to 26 characters for Route53
7. **Fix Numeric**: Prefix with `pr-` if starts with digit

**Example:**
```yaml
- name: Calculate Stage Name
  id: stage-calc
  uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    stage: fallback-stage  # Optional fallback
    truncation-length: 20  # Custom length
    prefix: issue-  # Custom prefix
    
- name: Use Computed Stage
  run: |
    STAGE="${{ steps.stage-calc.outputs.computed_stage }}"
    REF="${{ steps.stage-calc.outputs.ref }}"
    IS_PR="${{ steps.stage-calc.outputs.is_pull_request }}"
    
    echo "Computed stage: $STAGE (from $REF)"
    
    if [ "$IS_PR" = "true" ]; then
      echo "This is a pull request preview environment"
    fi

- name: Deploy to Computed Stage
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: ${{ steps.stage-calc.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Stage Computation Examples:**

| Input Branch/Ref | Event Type | Config | Computed Stage | Notes |
|------------------|------------|--------|---------------|--------|
| `main` | push | Default | `main` | Direct mapping |
| `feature/user-auth` | push | Default | `user-auth` | Prefix removed |
| `feature/user-auth` | pull_request | Default | `user-auth` | Same result for PR |
| `123-hotfix` | push | Default | `pr-123-hotfix` | Numeric prefix added |
| `123-hotfix` | push | `prefix: "fix-"` | `fix-123-hotfix` | Custom prefix |
| `123-hotfix` | push | `prefix: ""` | `123-hotfix` | No prefix |
| `Feature_Branch_NAME` | push | Default | `feature-branch-name` | Case + chars normalized |
| `refs/heads/develop` | push | Default | `develop` | Git prefix stripped |
| `very-long-branch-name-that-exceeds-limits` | push | Default | `very-long-branch-name-that` | Truncated to 26 chars |
| `very-long-branch-name-that-exceeds-limits` | push | `length: 15` | `very-long-branc` | Custom truncation |
| `123-very-long-name-exceeds-limits` | push | `prefix: "issue-", length: 20` | `issue-123-very-long` | Custom prefix + truncation |
| No ref available | any | Any | Uses fallback stage | Error handling |

**Error Handling:**
- Missing Git reference → Uses provided fallback stage
- Invalid characters → Sanitized automatically  
- Exceeds length → Truncated to 26 characters
- Starts with number → Prefixed with `pr-`
- GitHub context unavailable → Uses fallback with error status

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

#### Stage Calculation
```yaml
- uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
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

#### Dynamic Stage Management
```yaml
- name: Calculate Dynamic Stage
  id: stage-calc
  uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    stage: development  # Fallback for edge cases
    truncation-length: 20  # Shorter stage names
    prefix: ticket-  # Custom prefix for ticket integration

- name: Conditional Deploy Based on Stage
  uses: kodehort/sst-operations-action@v1
  with:
    operation: ${{ steps.stage-calc.outputs.is_pull_request == 'true' && 'diff' || 'deploy' }}
    stage: ${{ steps.stage-calc.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: ${{ steps.stage-calc.outputs.is_pull_request == 'true' && 'always' || 'on-failure' }}

- name: Cleanup Preview Environments
  if: |
    github.event_name == 'pull_request' && 
    github.event.action == 'closed' &&
    steps.stage-calc.outputs.is_pull_request == 'true'
  uses: kodehort/sst-operations-action@v1
  with:
    operation: remove
    stage: ${{ steps.stage-calc.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false  # Allow partial cleanup
```

#### Route53-Compatible Stages
```yaml
- name: Calculate Route53-Safe Stage
  id: route53-stage
  uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    truncation-length: 26  # Route53 subdomain limit
    prefix: env-    # Ensure valid DNS names
    stage: default          # Fallback stage

- name: Deploy with Route53-Safe Stage
  uses: kodehort/sst-operations-action@v1
  with:
    operation: deploy
    stage: ${{ steps.route53-stage.outputs.computed_stage }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### Short Stage Names for Resource Constraints
```yaml
- name: Calculate Short Stage Name
  id: short-stage
  uses: kodehort/sst-operations-action@v1
  with:
    operation: stage
    token: ${{ secrets.GITHUB_TOKEN }}
    truncation-length: 12  # Very short stages
    prefix: ""      # No prefix for maximum brevity
    stage: dev             # Short fallback
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