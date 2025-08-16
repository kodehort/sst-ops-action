/**
 * Test fixtures for SST output parsing
 * Contains realistic SST CLI outputs for testing parsers
 */

export const SST_DEPLOY_SUCCESS_OUTPUT = `
SST 3.17.10  ready!

➜  App:        www-kodehort-com
   Stage:      production

~  Deploy

$ bunx --bun astro build
15:04:46 [content] Syncing content
15:04:46 [WARN] [glob-loader] The base directory "/Users/alistairstead/dev/kodehort/kodehort.com/apps/web/src/content/post/" does not exist.
15:04:46 [content] Synced content
15:04:46 [types] Generated 127ms
15:04:46 [build] output: "server"
15:04:46 [build] mode: "server"
15:04:46 [build] directory: /Users/alistairstead/dev/kodehort/kodehort.com/apps/web/dist/
15:04:46 [build] adapter: astro-sst
15:04:46 [build] Collecting build info...
15:04:46 [build] ✓ Completed in 164ms.
15:04:46 [build] Building server entrypoints...
15:04:47 [WARN] [vite] "mergeRefs" is imported from external module "@solid-primitives/refs" but never used in "../../node_modules/solid-motionone/dist/index.jsx" and "../../node_modules/@kobalte/utils/dist/index.js".
15:04:47 [vite] ✓ built in 956ms
15:04:47 [build] ✓ Completed in 975ms.

 building client (vite)
15:04:47 [vite] transforming...
15:04:48 [vite] ✓ 156 modules transformed.
15:04:48 [vite] rendering chunks...
15:04:48 [vite] computing gzip size...
15:04:48 [vite] dist/client/_astro/icon-512.B3K2tbJr.png   11.96 kB
15:04:48 [vite] dist/client/_astro/fade-up.D9YuVHWa.js      0.38 kB │ gzip:   0.28 kB │ map:     1.27 kB
15:04:48 [vite] dist/client/_astro/icon.D24DKZb0.js         2.42 kB │ gzip:   0.94 kB │ map:     3.31 kB
15:04:48 [vite] dist/client/_astro/client.Cz33-c7d.js       5.66 kB │ gzip:   2.48 kB │ map:    29.59 kB
15:04:48 [vite] dist/client/_astro/index.3NZ2Y4bW.js       15.16 kB │ gzip:   6.41 kB │ map:   128.68 kB
15:04:48 [vite] dist/client/_astro/page.BiMgb0QW.js        23.35 kB │ gzip:  10.51 kB │ map:    63.29 kB
15:04:48 [vite] dist/client/_astro/cn.BrKXTeUm.js          24.88 kB │ gzip:   7.96 kB │ map:   132.76 kB
15:04:48 [vite] dist/client/_astro/web.CLf7LvOq.js         25.01 kB │ gzip:   9.67 kB │ map:   128.03 kB
15:04:48 [vite] dist/client/_astro/navbar.CDe2OFev.js     354.28 kB │ gzip: 159.87 kB │ map: 2,444.52 kB
15:04:48 [vite] ✓ built in 436ms

 prerendering static routes
15:04:48 ✓ Completed in 52ms.

15:04:48 [build] Rearranging server assets...
15:04:48 [build] Server built in 1.65s
15:04:48 [build] Complete!
|  Created     Astro sst:aws:Astro → AstroBuilder command:local:Command (2.8s)
|  Created     Astro sst:aws:Astro → AstroServerEuwest2Code aws:s3:BucketObjectv2 (1.4s)
|  Created     Astro sst:aws:Astro → AstroServerEuwest2Sourcemap0 aws:s3:BucketObjectv2 (1.6s)
|  Updated     Astro sst:aws:Astro → AstroServerEuwest2Function aws:lambda:Function (6.1s)
|  Created     Astro sst:aws:Astro → AstroPrewarmEuwest2 aws:lambda:Invocation
|  Deleted     Astro sst:aws:Astro → AstroPrewarmEuwest2 aws:lambda:Invocation
|  Deleted     Astro sst:aws:Astro → AstroServerEuwest2Sourcemap0 aws:s3:BucketObjectv2
|  Deleted     Astro sst:aws:Astro → AstroBuilder command:local:Command
|  Deleted     Astro sst:aws:Astro → AstroServerEuwest2Code aws:s3:BucketObjectv2

↗  Permalink   https://sst.dev/u/1a3e112e

✓  Complete
   Astro: https://kodehort.com
   ---
   github_role_name: production-GithubActionRole
   www: https://kodehort.com
   github_role_arn: arn:aws:iam::196313910340:role/production-GithubActionRole
`;

export const SST_DEPLOY_FAILURE_OUTPUT = `
SST 3.17.10  ready!

➜  App:        kodehort-scratch
   Stage:      sst-ops-actions

~  Deploy

|  Info        Downloaded provider vercel-1.11.0
|  Info        Downloaded provider command-1.0.1
|  Info        Downloaded provider tls-5.0.1
|  Info        Downloaded provider docker-build-0.0.8
|  Info        Downloaded provider random-4.16.6
|  Info        Downloaded provider cloudflare-6.4.1
|  Info        Downloaded provider aws-6.66.2
|  Created     default_6_66_2 pulumi:providers:aws
|  Created     Database sst:aws:Dynamo
|  Created     Web sst:aws:Astro → WebAssets sst:aws:Bucket
|  Created     default_4_16_6 pulumi:providers:random
|  Created     LambdaEncryptionKey random:index:RandomBytes
|  Created     Router sst:aws:Router → RouterCdn sst:aws:CDN
|  Created     default_1_0_1 pulumi:providers:command
$ bunx --bun astro build
|  Error       Router sst:aws:Router → RouterCdnDistribution aws:cloudfront:Distribution
resource 'E3EDFTB7D6VMW5' does not exist
|  Created     Api sst:aws:Function → ApiLogGroup aws:cloudwatch:LogGroup
19:50:52 [content] Syncing content
19:50:52 [content] Synced content
19:50:52 [types] Generated 162ms
19:50:52 [build] output: "static"
19:50:52 [build] mode: "static"
19:50:52 [build] directory: /home/runner/work/scratch/scratch/apps/www/dist/
19:50:52 [build] adapter: astro-sst
19:50:52 [build] Collecting build info...
19:50:52 [build] ✓ Completed in 180ms.
19:50:52 [build] Building static entrypoints...
19:50:53 [vite] ✓ built in 1.20s
19:50:52 [build] ✓ Completed in 1.27s.

 generating static routes
19:50:54 ▶ src/pages/index.astro
19:50:54   └─ /index.html (+11ms)
19:50:54 ✓ Completed in 65ms.

19:50:54 [build] 1 page(s) built in 1.53s
19:50:54 [build] Complete!
|  Created     Web sst:aws:Astro → WebBuilder command:local:Command (2.5s)
|  Created     Web sst:aws:Astro → WebAssetsBucket aws:s3:BucketV2 (3.0s)
|  Created     Database sst:aws:Dynamo → DatabaseTable aws:dynamodb:Table (15.7s)
|  Error
Error: invocation of aws:iam/getPolicyDocument:getPolicyDocument returned an error: grpc: the client
    at Object.callback cratch/.sst/platform/node_modules/@pulumi/runtime/invoke.ts:311:37)
    at Object.onReceiveStatus cratch/.sst/platform/node_modules/@grpc/grpc-js/src/client.ts:360:26)
    at Object.onReceiveStatus cratch/.sst/platform/node_modules/@grpc/grpc-js/src/client-interceptors.ts:458:34)
    at Object.onReceiveStatus cratch/.sst/platform/node_modules/@grpc/grpc-js/src/client-interceptors.ts:419:48)
    at ratch/.sst/platform/node_modules/@grpc/grpc-js/src/resolving-call.ts:132:24
    at processTicksAndRejections (node:internal/process/task_queues:77:11) {
  promise: Promise { <rejected> [Circular *1] }
}

✗  Failed

Router sst:aws:Router → RouterCdnDistribution aws:cloudfront:Distribution
resource 'E3EDFTB7D6VMW5' does not exist

Error: invocation of aws:iam/getPolicyDocument:getPolicyDocument returned an error: grpc: the client
    at Object.callback cratch/.sst/platform/node_modules/@pulumi/runtime/invoke.ts:311:37)
    at Object.onReceiveStatus cratch/.sst/platform/node_modules/@grpc/grpc-js/src/client.ts:360:26)
    at Object.onReceiveStatus cratch/.sst/platform/node_modules/@grpc/grpc-js/src/client-interceptors.ts:458:34)
    at Object.onReceiveStatus cratch/.sst/platform/node_modules/@grpc/grpc-js/src/client-interceptors.ts:419:48)
    at ratch/.sst/platform/node_modules/@grpc/grpc-js/src/resolving-call.ts:132:24
    at processTicksAndRejections (node:internal/process/task_queues:77:11) {
  promise: Promise { <rejected> [Circular *1] }
}

View more in the console: https://sst.dev/u/75c084c6
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
`;

export const SST_REMOVE_PARTIAL_OUTPUT = `
SST Remove
App: my-sst-app
Stage: staging

⚠  2 resources could not be removed
| Deleted         Website       my-sst-app-staging-web
| Deleted         Function      my-sst-app-staging-handler
! Api            my-sst-app-staging-api could not be removed: dependency exists
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
`;

export const SST_REMOVE_EMPTY_STACK_OUTPUT = `
SST Remove
App: empty-app
Stage: staging

No resources to remove
Stack is already empty or does not exist
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
SST 3.17.10  ready!

➜  App:        my-sst-app
   Stage:      staging

~  Deploy

|  Created     Function sst:aws:Function (1.2s)

✓  Complete
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
`;
