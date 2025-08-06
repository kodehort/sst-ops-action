/**
 * Test fixtures for SST remove operation outputs
 * Used to test the RemoveParser class with various real-world scenarios
 */

export const SST_REMOVE_SUCCESS_OUTPUT = `
SST Remove
App: my-sst-app
Stage: staging

- Function        my-sst-app-staging-handler
- Api             my-sst-app-staging-api
- Website         my-sst-app-staging-site

✓ Complete

3 resources removed

Permalink: https://console.sst.dev/my-sst-app/staging/removes/abc123
`.trim();

export const SST_REMOVE_NO_RESOURCES_OUTPUT = `
SST Remove
App: my-sst-app
Stage: staging

✓ Complete

No resources to remove

Permalink: https://console.sst.dev/my-sst-app/staging/removes/def456
`.trim();

export const SST_REMOVE_PARTIAL_OUTPUT = `
SST Remove
App: my-sst-app
Stage: production

- Function        my-sst-app-production-handler
× Api             my-sst-app-production-api (failed: dependency exists)
- Website         my-sst-app-production-site

⚠ Partial completion

2 resources removed, 1 failed

Permalink: https://console.sst.dev/my-sst-app/production/removes/ghi789
`.trim();

export const SST_REMOVE_ERROR_OUTPUT = `
SST Remove
App: error-app
Stage: staging

Error: Unable to connect to AWS
Permission denied: IAM role lacks required permissions

× Failed

0 resources removed

Permalink: https://console.sst.dev/error-app/staging/removes/jkl012
`.trim();

export const SST_REMOVE_COMPLEX_OUTPUT = `
SST Remove
App: complex-app
Stage: production

- Function        complex-app-production-auth-handler
- Function        complex-app-production-api-handler
- Function        complex-app-production-worker
- Database        complex-app-production-users-db
× Database        complex-app-production-sessions-db (failed: not empty)
- Topic           complex-app-production-events
- Queue           complex-app-production-jobs
- Api             complex-app-production-api
- Website         complex-app-production-web

⚠ Partial completion

8 resources removed, 1 failed

Permalink: https://console.sst.dev/complex-app/production/removes/mno345
`.trim();

export const SST_REMOVE_LARGE_OUTPUT = (() => {
  const removedResources = Array.from(
    { length: 45 },
    (_, i) => `- Function        large-app-production-func-${i + 1}`
  ).join('\n');

  const failedResources = Array.from(
    { length: 5 },
    (_, i) =>
      `× Database        large-app-production-db-${i + 1} (failed: dependencies exist)`
  ).join('\n');

  return `
SST Remove
App: large-app
Stage: production

${removedResources}
${failedResources}

⚠ Partial completion

45 resources removed, 5 failed

Permalink: https://console.sst.dev/large-app/production/removes/pqr678
`.trim();
})();

export const SST_REMOVE_MIXED_RESOURCES_OUTPUT = `
SST Remove
App: mixed-app
Stage: development

- Function        mixed-app-dev-auth (Lambda runtime: node20)
- Database        mixed-app-dev-users (RDS PostgreSQL 14.9)
- Topic           mixed-app-dev-notifications (SNS topic)
- Queue           mixed-app-dev-messages (SQS standard queue)
- Api             mixed-app-dev-rest-api (API Gateway v2)
× Api             mixed-app-dev-graphql-api (failed: custom domain in use)
- Website         mixed-app-dev-frontend (CloudFront + S3)
- Bucket          mixed-app-dev-assets (S3 bucket)

⚠ Partial completion

7 resources removed, 1 failed

Permalink: https://console.sst.dev/mixed-app/development/removes/stu901
`.trim();

export const SST_REMOVE_ONLY_FAILURES_OUTPUT = `
SST Remove
App: failing-app
Stage: staging

× Function        failing-app-staging-handler (failed: in use by API)
× Database        failing-app-staging-db (failed: not empty)
× Api             failing-app-staging-api (failed: custom domain attached)

× Failed

0 resources removed, 3 failed

Permalink: https://console.sst.dev/failing-app/staging/removes/vwx234
`.trim();

export const SST_REMOVE_MALFORMED_OUTPUT = `
SST Remove malformed output
Random text that doesn't follow expected format
Some resource might be here but not properly formatted
Error parsing output
`.trim();

export const SST_REMOVE_EMPTY_OUTPUT = '';

export const SST_REMOVE_INCOMPLETE_OUTPUT = `
SST Remove
App: incomplete-app
Stage: staging

- Function        incomplete-app-staging-handler
`.trim();

export const SST_REMOVE_SKIPPED_OUTPUT = `
SST Remove
App: skipped-app
Stage: staging

- Function        skipped-app-staging-handler
~ Database        skipped-app-staging-db (skipped: protected resource)
- Website         skipped-app-staging-site

✓ Complete

2 resources removed, 1 skipped

Permalink: https://console.sst.dev/skipped-app/staging/removes/yza567
`.trim();

export const SST_REMOVE_TIMEOUT_OUTPUT = `
SST Remove
App: timeout-app
Stage: production

- Function        timeout-app-production-handler
× Api             timeout-app-production-api (failed: timeout after 300s)

⚠ Partial completion

1 resource removed, 1 failed

Operation timed out after 5 minutes

Permalink: https://console.sst.dev/timeout-app/production/removes/bcd890
`.trim();
