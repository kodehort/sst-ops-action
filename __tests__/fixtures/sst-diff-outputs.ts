/**
 * Test fixtures for SST diff operation parsing
 * Contains realistic SST diff CLI outputs for comprehensive testing
 */

export const SST_DIFF_SUCCESS_OUTPUT = `
SST Diff
App: my-sst-app
Stage: staging

+ Function        my-sst-app-staging-new-handler
~ Api            my-sst-app-staging-api (environment updated)
- Website        my-sst-app-staging-old-site

3 changes planned

↗  Permalink https://console.sst.dev/my-sst-app/staging/diffs/abc123

Duration: 15s
`;

export const SST_DIFF_NO_CHANGES_OUTPUT = `
SST Diff
App: my-sst-app
Stage: staging

No changes

Duration: 5s
`;

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

Duration: 25s
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

Duration: 18s
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

Duration: 8s
`;

export const SST_DIFF_LARGE_OUTPUT = `
SST Diff
App: large-app
Stage: production

${Array.from({ length: 25 }, (_, i) => `+ Function        large-app-production-func-${i + 1}`).join('\n')}
${Array.from({ length: 15 }, (_, i) => `~ Api            large-app-production-api-${i + 1} (config updated)`).join('\n')}
${Array.from({ length: 10 }, (_, i) => `- Website        large-app-production-site-${i + 1}`).join('\n')}

50 changes planned

Duration: 45s
`;

export const SST_DIFF_MALFORMED_OUTPUT = `
SST Diff started...
Invalid diff format
Malformed resource line without proper prefix
Error parsing changes
`;

export const SST_DIFF_ERROR_OUTPUT = `
SST Diff
App: error-app
Stage: staging

Error: Unable to generate diff
Permission denied: cannot read current infrastructure state

Duration: 3s
`;

export const SST_DIFF_EMPTY_OUTPUT = '';

export const SST_DIFF_INCOMPLETE_OUTPUT = `
SST Diff
App: incomplete-app
Stage: staging

+ Function        incomplete-app-staging-new-handler
`;

// Output with mixed resource types and detailed change information
export const SST_DIFF_MIXED_RESOURCES_OUTPUT = `
SST Diff
App: mixed-app
Stage: development

+ Function        mixed-app-development-auth-handler (Node.js 20, 512MB)
+ Database        mixed-app-development-users-db (RDS PostgreSQL 14.9)
+ Topic          mixed-app-development-events
+ Queue          mixed-app-development-jobs (SQS Standard)
~ Api            mixed-app-development-api (cors configuration updated)
~ Website        mixed-app-development-web (CloudFront distribution settings)
~ Function        mixed-app-development-processor (memory: 256MB → 512MB)
- Database        mixed-app-development-legacy-db
- Function        mixed-app-development-old-auth
- Topic          mixed-app-development-deprecated-events

Cost changes:
Monthly: $78.90 → $124.50 (+$45.60)

10 changes planned

↗  Permalink https://console.sst.dev/mixed-app/development/diffs/mixed123

Duration: 32s
`;

// Output with only additions
export const SST_DIFF_ONLY_ADDITIONS_OUTPUT = `
SST Diff
App: new-features-app
Stage: staging

+ Function        new-features-app-staging-feature-a
+ Function        new-features-app-staging-feature-b
+ Api            new-features-app-staging-new-api
+ Website        new-features-app-staging-landing-page

4 changes planned

Duration: 20s
`;

// Output with only deletions
export const SST_DIFF_ONLY_DELETIONS_OUTPUT = `
SST Diff
App: cleanup-app
Stage: staging

- Function        cleanup-app-staging-deprecated-handler
- Database        cleanup-app-staging-old-db
- Topic          cleanup-app-staging-unused-events
- Website        cleanup-app-staging-legacy-site

Cost savings:
Monthly: $89.00 → $12.00 (-$77.00)

4 changes planned

Duration: 12s
`;

// Output with only updates
export const SST_DIFF_ONLY_UPDATES_OUTPUT = `
SST Diff
App: updates-app
Stage: production

~ Function        updates-app-production-handler (timeout: 30s → 60s)
~ Api            updates-app-production-api (rate limiting enabled)
~ Database        updates-app-production-db (backup retention: 7d → 30d)

3 changes planned

Duration: 10s
`;
