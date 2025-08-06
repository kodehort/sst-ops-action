/**
 * Test fixtures for SST output parsing
 * Contains realistic SST CLI outputs for testing parsers
 */

export const SST_DEPLOY_SUCCESS_OUTPUT = `
SST Deploy
App: my-sst-app
Stage: staging

✓ Complete
| Created         Function       my-sst-app-staging-handler
| Created         Api           my-sst-app-staging-api
| Created         Website       my-sst-app-staging-web

Router: https://api.staging.example.com
Web:    https://staging.example.com

↗  Permalink https://console.sst.dev/my-sst-app/staging/deployments/abc123

Duration: 45s
`;

export const SST_DEPLOY_PARTIAL_OUTPUT = `
SST Deploy
App: my-sst-app  
Stage: staging

⚠  Partial
| Created         Function       my-sst-app-staging-handler
| Updated         Api           my-sst-app-staging-api
| Failed          Website       my-sst-app-staging-web (timeout)

Router: https://api.staging.example.com

↗  Permalink https://console.sst.dev/my-sst-app/staging/deployments/def456

Duration: 120s
`;

export const SST_DEPLOY_FAILURE_OUTPUT = `
SST Deploy
App: my-sst-app
Stage: staging

✗  Failed
| Created         Function       my-sst-app-staging-handler  
| Failed          Api           my-sst-app-staging-api (permission denied)
| Failed          Website       my-sst-app-staging-web (dependency failed)

Error: Deployment failed with 2 errors

Duration: 30s
`;

export const SST_DIFF_OUTPUT = `
SST Diff
App: my-sst-app
Stage: staging

+ Function        my-sst-app-staging-new-handler
~ Api            my-sst-app-staging-api (environment updated)
- Website        my-sst-app-staging-old-site

3 changes planned
`;

export const SST_DIFF_NO_CHANGES_OUTPUT = `
SST Diff  
App: my-sst-app
Stage: staging

No changes
`;

// Enhanced diff outputs for comprehensive testing
export const SST_DIFF_COMPLEX_OUTPUT = `
SST Diff
App: my-complex-app
Stage: production

+ Function        my-complex-app-production-new-auth
+ Database        my-complex-app-production-users-db (RDS MySQL 8.0)
~ Api            my-complex-app-production-api (environment variables updated)
~ Website        my-complex-app-production-web (build configuration changed)
- Function        my-complex-app-production-old-processor
- Topic          my-complex-app-production-notifications

  Cost changes:
  Monthly: $45.50 → $67.80 (+$22.30)
  
  Breaking changes detected:
  ! Database schema migration required
  ! API endpoint /legacy/users will be removed

6 changes planned

↗  Permalink https://console.sst.dev/my-complex-app/production/diffs/xyz789
`;

export const SST_DIFF_BREAKING_OUTPUT = `
SST Diff
App: breaking-app
Stage: staging

~ Function        breaking-app-staging-handler (runtime changed: node16 → node20)
- Database        breaking-app-staging-legacy-db
+ Database        breaking-app-staging-new-db (PostgreSQL 15)

  Impact: Breaking
  ! Data migration required
  ! Downtime expected: ~5 minutes
  
  Cost changes:
  Monthly: $120.00 → $95.00 (-$25.00)

3 changes planned
`;

export const SST_DIFF_COSMETIC_OUTPUT = `
SST Diff
App: cosmetic-app
Stage: staging

~ Function        cosmetic-app-staging-handler (description updated)
~ Website        cosmetic-app-staging-web (tags updated)

  Impact: Cosmetic
  No functional changes
  
2 changes planned
`;

export const SST_DIFF_MALFORMED_OUTPUT = `
SST Diff started...
Invalid diff format
Malformed resource line without proper prefix
Error parsing changes
`;

export const SST_REMOVE_SUCCESS_OUTPUT = `
SST Remove
App: my-sst-app
Stage: staging

✓ All resources removed
| Deleted         Website       my-sst-app-staging-web
| Deleted         Api           my-sst-app-staging-api  
| Deleted         Function      my-sst-app-staging-handler

Monthly savings: $50.00

Duration: 60s
`;

export const SST_REMOVE_PARTIAL_OUTPUT = `
SST Remove
App: my-sst-app
Stage: staging

⚠  2 resources could not be removed
| Deleted         Website       my-sst-app-staging-web
| Deleted         Function      my-sst-app-staging-handler
! Api            my-sst-app-staging-api could not be removed: dependency exists

Duration: 90s
`;

// Enhanced remove outputs for comprehensive testing
export const SST_REMOVE_COMPLETE_OUTPUT = `
SST Remove
App: complex-app
Stage: production

✓ All resources removed
| Deleted         Function      complex-app-production-auth-handler
| Deleted         Database      complex-app-production-users-db
| Deleted         Api           complex-app-production-api
| Deleted         Website       complex-app-production-web
| Deleted         Topic         complex-app-production-notifications
| Deleted         Queue         complex-app-production-jobs

Monthly savings: $245.80

↗  Permalink https://console.sst.dev/complex-app/production/removals/abc123

Duration: 180s
`;

export const SST_REMOVE_FAILED_OUTPUT = `
SST Remove
App: failed-app
Stage: staging

✗  Remove failed
| Deleted         Website       failed-app-staging-web
! Function       failed-app-staging-handler could not be removed: still referenced by API
! Database       failed-app-staging-db could not be removed: contains data, manual intervention required
! Api            failed-app-staging-api could not be removed: external dependencies

Error: Remove operation failed - 3 resources could not be removed

Duration: 45s
`;

export const SST_REMOVE_TIMEOUT_OUTPUT = `
SST Remove
App: timeout-app
Stage: staging

⚠  Remove operation timed out
| Deleted         Website       timeout-app-staging-web
| Deleted         Function      timeout-app-staging-handler
! Database       timeout-app-staging-db removal timed out after 300s

Partial cleanup completed
Manual intervention may be required

Duration: 300s
`;

export const SST_REMOVE_EMPTY_STACK_OUTPUT = `
SST Remove
App: empty-app
Stage: staging

No resources to remove
Stack is already empty or does not exist

Duration: 5s
`;

export const SST_REMOVE_MALFORMED_OUTPUT = `
SST Remove started...
Invalid removal format
Cannot parse resource status
Unknown error occurred
`;

export const MALFORMED_OUTPUT = `
This is not a valid SST output
Random text without patterns
`;

export const EMPTY_OUTPUT = '';

export const INCOMPLETE_OUTPUT = `
SST Deploy
App: my-sst-app
Stage: staging

✓ Complete
| Created         Function       my-sst-app-staging-handler
`;

// Additional diff-specific test fixtures
export const SST_DIFF_LARGE_OUTPUT = `
SST Diff
App: large-app
Stage: production

${Array.from({ length: 50 }, (_, i) => `+ Function        large-app-production-func-${i + 1}`).join('\n')}
${Array.from({ length: 30 }, (_, i) => `~ Api            large-app-production-api-${i + 1} (config updated)`).join('\n')}
${Array.from({ length: 20 }, (_, i) => `- Website        large-app-production-site-${i + 1}`).join('\n')}

100 changes planned
`;

// Large remove output for performance testing
export const SST_REMOVE_LARGE_OUTPUT = `
SST Remove
App: large-app
Stage: development

✓ All resources removed
${Array.from({ length: 50 }, (_, i) => `| Deleted         Function      large-app-development-func-${i + 1}`).join('\n')}
${Array.from({ length: 30 }, (_, i) => `| Deleted         Api           large-app-development-api-${i + 1}`).join('\n')}
${Array.from({ length: 20 }, (_, i) => `| Deleted         Website       large-app-development-site-${i + 1}`).join('\n')}

Monthly savings: $1,250.75

100 resources removed
Duration: 240s
`;
