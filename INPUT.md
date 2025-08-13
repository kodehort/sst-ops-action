# Example Deploy output

## Deploy output 1

```
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
19:50:53 [build] ✓ Completed in 1.27s.

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

✕  Failed

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
```

## Deploy output 2

```
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
```
