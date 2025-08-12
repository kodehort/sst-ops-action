# Example DIff output

## Diff output 1
```
SST 3.17.4  ready!

➜  App:        inheritly
   Stage:      alistairstead

~  Diff

|  Created     VPC sst:aws:Vpc
|  Created     PostHogHost sst:sst:Secret
|  Created     PostHogKey sst:sst:Secret
|  Created     Studio sst:sst:DevCommand
|  Created     DevPDF sst:sst:DevCommand
|  Created     Bus sst:aws:Bus
|  Created     OpenAuth sst:aws:Auth
|  Created     DatabaseMigrator sst:aws:Function
|  Created     EncryptionKey sst:sst:Secret
|  Created     PostHogHost sst:sst:Secret (1.0s)
|  Created     WorkspaceAssets sst:aws:Bucket
|  Created     Email sst:aws:Email
|  Created     default_6_66_2 pulumi:providers:aws
|  Created     Router sst:aws:Router
|  Created     JSXEmail sst:sst:DevCommand
|  Created     ContactOpsEmail sst:sst:Secret
|  Created     PostHogKey sst:sst:Secret (1.0s)
|  Created     DockerPostgres sst:sst:DevCommand
|  Created     Reports sst:aws:Bucket
|  Created     Postgres sst:aws:Aurora
|  Created     EncryptionKey sst:sst:Secret (1.0s)
|  Created     Bus sst:aws:Bus (1.0s)
|  Created     DatabaseMigrator sst:aws:Function (1.0s)
|  Created     DevPDF sst:sst:DevCommand (1.0s)
|  Created     ReferralImpressionTrackingTable sst:aws:Dynamo
|  Created     Website sst:aws:StaticSite
|  Created     ApiFunction sst:aws:Function
|  Created     AuthTable sst:aws:Dynamo
|  Created     Results sst:aws:Dynamo
|  Created     DatabaseSeed sst:aws:Function
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber
|  Created     DeploymentVersionUpdater sst:aws:Function
|  Created     Urls sst:sst:Linkable
|  Created     Dashboard sst:aws:StaticSite
|  Created     Survey sst:aws:StaticSite
|  Created     TrackingFunction sst:aws:Function
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuer sst:aws:Function
|  Created     OpenAuth sst:aws:Auth → OpenAuthStorage sst:aws:Dynamo
|  Created     ReferralImpressionTrackingTable sst:aws:Dynamo
|  Created     default_1_0_1 pulumi:providers:command
|  Created     WorkspaceAssets sst:aws:Bucket
|  Created     Router sst:aws:Router → RouterCdn sst:aws:CDN
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunction sst:aws:Function
|  Created     Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket
|  Created     Email sst:aws:Email
|  Created     Dashboard sst:aws:StaticSite → DashboardAssets sst:aws:Bucket
|  Created     JSXEmail sst:sst:DevCommand
|  Created     Survey sst:aws:StaticSite → SurveyAssets sst:aws:Bucket
|  Created     ContactOpsEmail sst:sst:Secret
|  Created     Reports sst:aws:Bucket
|  Created     Postgres sst:aws:Aurora
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber
|  Created     AuthTable sst:aws:Dynamo
|  Created     Results sst:aws:Dynamo
|  Created     DatabaseSeed sst:aws:Function
$ bunx --bun vite build
|  Created     DeploymentVersionUpdater sst:aws:Function
|  Created     Urls sst:sst:Linkable
|  Created     default_4_16_6 pulumi:providers:random
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuer sst:aws:Function
|  Created     OpenAuth sst:aws:Auth → OpenAuthStorage sst:aws:Dynamo
|  Created     LambdaEncryptionKey random:index:RandomBytes
vite v6.3.5 building for production...
Generated route tree in 71ms
transforming...
|  Created     Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket
|  Created     Bus sst:aws:Bus → BusBus aws:cloudwatch:EventBus
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunction sst:aws:Function
|  Created     DatabaseMigrator sst:aws:Function → DatabaseMigratorLogGroup aws:cloudwatch:LogGroup
|  Created     Router sst:aws:Router → RouterCdn sst:aws:CDN
|  Created     Survey sst:aws:StaticSite → SurveyAssets sst:aws:Bucket
|  Created     Dashboard sst:aws:StaticSite → DashboardAssets sst:aws:Bucket
|  Created     Website sst:aws:StaticSite → WebsiteBuilder command:local:Command
|  Created     ApiFunction sst:aws:Function → ApiFunctionLogGroup aws:cloudwatch:LogGroup
|  Created     ReferralImpressionTrackingTable sst:aws:Dynamo → ReferralImpressionTrackingTableTable aws:dynamodb:Table
|  Created     Reports sst:aws:Bucket → ReportsBucket aws:s3:BucketV2
|  Created     DatabaseSeed sst:aws:Function → DatabaseSeedLogGroup aws:cloudwatch:LogGroup
|  Created     DeploymentVersionUpdater sst:aws:Function → DeploymentVersionUpdaterLogGroup aws:cloudwatch:LogGroup
|  Created     TrackingFunction sst:aws:Function → TrackingFunctionLogGroup aws:cloudwatch:LogGroup
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuerLogGroup aws:cloudwatch:LogGroup
|  Created     AuthTable sst:aws:Dynamo → AuthTableTable aws:dynamodb:Table
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionLogGroup aws:cloudwatch:LogGroup
|  Created     Results sst:aws:Dynamo → ResultsTable aws:dynamodb:Table
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberRule aws:cloudwatch:EventRule
|  Created     OpenAuth sst:aws:Auth → OpenAuthStorageTable aws:dynamodb:Table
|  Created     Website sst:aws:StaticSite → WebsiteAssetsBucket aws:s3:BucketV2
|  Created     Survey sst:aws:StaticSite → SurveyAssetsBucket aws:s3:BucketV2
|  Created     Dashboard sst:aws:StaticSite → DashboardAssetsBucket aws:s3:BucketV2
|  Created     Reports sst:aws:Bucket → ReportsPublicAccessBlock aws:s3:BucketPublicAccessBlock
|  Created     Reports sst:aws:Bucket → ReportsCors aws:s3:BucketCorsConfigurationV2
|  Created     Website sst:aws:StaticSite → WebsiteAssetsPublicAccessBlock aws:s3:BucketPublicAccessBlock
|  Created     Website sst:aws:StaticSite → WebsiteAssetsCors aws:s3:BucketCorsConfigurationV2
|  Created     Survey sst:aws:StaticSite → SurveyAssetsCors aws:s3:BucketCorsConfigurationV2
|  Created     Survey sst:aws:StaticSite → SurveyAssetsPublicAccessBlock aws:s3:BucketPublicAccessBlock
|  Created     Dashboard sst:aws:StaticSite → DashboardAssetsCors aws:s3:BucketCorsConfigurationV2
|  Created     Dashboard sst:aws:StaticSite → DashboardAssetsPublicAccessBlock aws:s3:BucketPublicAccessBlock
|  Created     Reports sst:aws:Bucket → ReportsPolicy aws:s3:BucketPolicy
|  Created     Survey sst:aws:StaticSite → SurveyAssetsPolicy aws:s3:BucketPolicy
|  Created     Website sst:aws:StaticSite → WebsiteAssetsPolicy aws:s3:BucketPolicy
|  Created     Dashboard sst:aws:StaticSite → DashboardAssetsPolicy aws:s3:BucketPolicy
|  Created     TrackingFunction sst:aws:Function → TrackingFunctionRole aws:iam:Role
|  Created     ApiFunction sst:aws:Function → ApiFunctionRole aws:iam:Role
|  Created     DatabaseSeed sst:aws:Function → DatabaseSeedRole aws:iam:Role
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuerRole aws:iam:Role
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionRole aws:iam:Role
|  Created     DeploymentVersionUpdater sst:aws:Function → DeploymentVersionUpdaterRole aws:iam:Role
|  Created     DatabaseMigrator sst:aws:Function → DatabaseMigratorRole aws:iam:Role
|  Created     RouterRoute/workspace-files sst:aws:RouterBucketRoute
|  Created     Survey sst:aws:StaticSite (1.2s)
|  Created     Website sst:aws:StaticSite (1.3s)
|  Created     default pulumi:providers:pulumi-nodejs
|  Created     TrackingFunction sst:aws:Function (1.3s)
|  Created     Dashboard sst:aws:StaticSite → DashboardRoutesUpdate sst:aws:KvRoutesUpdate
|  Created     ApiFunction sst:aws:Function → ApiFunctionRoutesUpdate sst:aws:KvRoutesUpdate
|  Created     TrackingFunction sst:aws:Function → TrackingFunctionRoutesUpdate sst:aws:KvRoutesUpdate
|  Created     ApiFunction sst:aws:Function (1.3s)
|  Created     Website sst:aws:StaticSite → WebsiteRoutesUpdate sst:aws:KvRoutesUpdate
|  Created     Survey sst:aws:StaticSite → SurveyRoutesUpdate sst:aws:KvRoutesUpdate
|  Created     RouterRoute/workspace-files sst:aws:RouterBucketRoute → RouterRoute/workspace-filesRoutesUpdate sst:aws:KvRoutesUpdate
|  Created     RouterRoute/workspace-files sst:aws:RouterBucketRoute → RouterRoute/workspace-filesRouteKey sst:aws:KvKeys
|  Created     Router sst:aws:Router (1.3s)
|  Created     RouterRoute/workspace-files sst:aws:RouterBucketRoute
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberPermission aws:lambda:Permission
|  Created     Studio sst:sst:DevCommand (2.3s)
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuerUrl aws:lambda:FunctionUrl
|  Created     TrackingFunction sst:aws:Function → TrackingFunctionUrl aws:lambda:FunctionUrl
|  Created     DockerPostgres sst:sst:DevCommand (1.3s)
|  Created     DatabaseMigratorInvocation aws:lambda:Invocation
|  Created     DatabaseSeedInvocation aws:lambda:Invocation
|  Created     DeploymentVersionUpdate aws:lambda:Invocation
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberTarget aws:cloudwatch:EventTarget
|  Created     OpenAuth sst:aws:Auth (2.3s)
✓ 1754 modules transformed.
|  Created     Dashboard sst:aws:StaticSite (1.3s)
|  Created     Dashboard sst:aws:StaticSite → DashboardKvKeys sst:aws:KvKeys
|  Created     ApiFunction sst:aws:Function → ApiFunctionUrl aws:lambda:FunctionUrl
|  Created     TrackingFunction sst:aws:Function → TrackingFunctionRouteKey sst:aws:KvKeys
|  Created     ApiFunction sst:aws:Function → ApiFunctionRouteKey sst:aws:KvKeys
rendering chunks...
computing gzip size...
dist/index.html                        0.88 kB │ gzip:   0.46 kB
dist/assets/index-DEg0doZY.css        80.46 kB │ gzip:  13.15 kB
dist/assets/privacy-38WKmqxl.js        7.93 kB │ gzip:   2.66 kB
dist/assets/referral-CNYs6r0U.js       9.74 kB │ gzip:   2.51 kB
dist/assets/index-Dr5orugk.js         12.04 kB │ gzip:   3.60 kB
dist/assets/Footer-D2FLP7O3.js        32.88 kB │ gzip:  11.41 kB
dist/assets/ContactForm-BQ2Kzn5E.js   80.12 kB │ gzip:  19.96 kB
dist/assets/index-Ym7sFwxm.js        415.56 kB │ gzip: 139.63 kB
✓ built in 1.15s
|  Created     Website sst:aws:StaticSite → WebsiteKvKeys sst:aws:KvKeys
|  Created     Survey sst:aws:StaticSite → SurveyBuilder command:local:Command
$ bunx --bun vite build
|  Created     Website sst:aws:StaticSite → WebsiteAssetFiles sst:aws:BucketFiles
|  Created     Website sst:aws:StaticSite → WebsiteInvalidation sst:aws:DistributionInvalidation
vite v6.3.5 building for production...
Generated route tree in 68ms
transforming...
|  Created     VPC sst:aws:Vpc (3.8s)
✓ 3389 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                            0.72 kB │ gzip:   0.38 kB
dist/assets/index-B3ndF9tm.css            80.48 kB │ gzip:  13.93 kB
dist/assets/index-CEV9pcFS.css           278.77 kB │ gzip:  31.75 kB
dist/assets/index-D_Wxvt_x.js              0.06 kB │ gzip:   0.08 kB
dist/assets/_referralCode-D_Wxvt_x.js      0.06 kB │ gzip:   0.08 kB
dist/assets/route-BSy7c5tw.js              0.19 kB │ gzip:   0.16 kB
dist/assets/tooltip-qbqzoeLP.js            0.84 kB │ gzip:   0.48 kB
dist/assets/success-1aaeSteL.js            1.33 kB │ gzip:   0.66 kB
dist/assets/section2-Ciq9UDHg.js           4.00 kB │ gzip:   1.58 kB
dist/assets/section1-DF1COHl0.js           4.17 kB │ gzip:   1.60 kB
dist/assets/privacy-Dr70D_ZX.js            6.24 kB │ gzip:   2.13 kB
dist/assets/section5-Z2jFtoSM.js           6.45 kB │ gzip:   1.99 kB
dist/assets/section4-73mwnp6K.js           7.06 kB │ gzip:   2.30 kB
dist/assets/section3-M3gt3jkF.js           7.80 kB │ gzip:   2.58 kB
dist/assets/Container-BZoEJinJ.js         25.11 kB │ gzip:   8.08 kB
dist/assets/index-DIEfjKME.js            215.37 kB │ gzip:  64.85 kB
dist/assets/index-n7x-_HLI.js          2,704.77 kB │ gzip: 650.24 kB
✓ built in 3.24s

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
|  Created     Survey sst:aws:StaticSite → SurveyKvKeys sst:aws:KvKeys
|  Created     Survey sst:aws:StaticSite → SurveyAssetFiles sst:aws:BucketFiles
|  Created     Survey sst:aws:StaticSite → SurveyInvalidation sst:aws:DistributionInvalidation

↗  Permalink   https://sst.dev/u/184e99ca

✓  Generated

+  inheritly-alistairstead pulumi:pulumi:Stack

+  VPC sst:aws:Vpc

+  PostHogHost sst:sst:Secret

+  PostHogKey sst:sst:Secret

+  Studio sst:sst:DevCommand

+  DevPDF sst:sst:DevCommand

+  Bus sst:aws:Bus

+  OpenAuth sst:aws:Auth

+  DatabaseMigrator sst:aws:Function

+  EncryptionKey sst:sst:Secret

+  WebsiteLinkRef sst:sst:LinkRef

+  PostHogHost sst:sst:Secret

+  WorkspaceAssets sst:aws:Bucket

+  Email sst:aws:Email

+  default_6_66_2 pulumi:providers:aws

+  Router sst:aws:Router

+  JSXEmail sst:sst:DevCommand

+  EmailLinkRef sst:sst:LinkRef

+  ContactOpsEmail sst:sst:Secret

+  PostHogKey sst:sst:Secret

+  DockerPostgres sst:sst:DevCommand

+  Reports sst:aws:Bucket

+  Postgres sst:aws:Aurora

+  EncryptionKey sst:sst:Secret

+  Bus sst:aws:Bus

+  DatabaseMigrator sst:aws:Function

+  VPCLinkRef sst:sst:LinkRef

+  DevPDF sst:sst:DevCommand

+  ReferralImpressionTrackingTable sst:aws:Dynamo

+  Website sst:aws:StaticSite

+  ApiFunction sst:aws:Function

+  AuthTable sst:aws:Dynamo

+  Results sst:aws:Dynamo

+  DatabaseSeed sst:aws:Function

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber

+  DeploymentVersionUpdater sst:aws:Function

+  PostgresLinkRef sst:sst:LinkRef

+  Urls sst:sst:Linkable

+  Dashboard sst:aws:StaticSite

+  Survey sst:aws:StaticSite

+  ResultsLinkRef sst:sst:LinkRef

+  RouterLinkRef sst:sst:LinkRef

+  EncryptionKeyLinkRef sst:sst:LinkRef

+  AuthTableLinkRef sst:sst:LinkRef

+  TrackingFunction sst:aws:Function

+  PostHogHostLinkRef sst:sst:LinkRef

+  BusLinkRef sst:sst:LinkRef

+  DatabaseMigratorLinkRef sst:sst:LinkRef

+  UrlsLinkRef sst:sst:LinkRef

+  ContactOpsEmailLinkRef sst:sst:LinkRef

+  DeploymentVersionUpdaterLinkRef sst:sst:LinkRef

+  OpenAuthLinkRef sst:sst:LinkRef

+  SurveyLinkRef sst:sst:LinkRef

+  ReferralImpressionTrackingTableLinkRef sst:sst:LinkRef

+  ApiFunctionLinkRef sst:sst:LinkRef

+  PostHogKeyLinkRef sst:sst:LinkRef

+  DatabaseSeedLinkRef sst:sst:LinkRef

+  TrackingFunctionLinkRef sst:sst:LinkRef

+  WorkspaceAssetsLinkRef sst:sst:LinkRef

+  ReportsLinkRef sst:sst:LinkRef

+  OpenAuth sst:aws:Auth → OpenAuthIssuer sst:aws:Function

+  DashboardLinkRef sst:sst:LinkRef

+  OpenAuth sst:aws:Auth → OpenAuthStorage sst:aws:Dynamo

+  OpenAuthVersion sst:sst:Version

+  ReferralImpressionTrackingTable sst:aws:Dynamo

+  default_1_0_1 pulumi:providers:command

+  WorkspaceAssets sst:aws:Bucket

+  Router sst:aws:Router → RouterCdn sst:aws:CDN

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunction sst:aws:Function

+  Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket

+  Email sst:aws:Email

+  Dashboard sst:aws:StaticSite → DashboardAssets sst:aws:Bucket

+  JSXEmail sst:sst:DevCommand

+  Survey sst:aws:StaticSite → SurveyAssets sst:aws:Bucket

+  ContactOpsEmail sst:sst:Secret

+  Reports sst:aws:Bucket

+  Postgres sst:aws:Aurora

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber

+  AuthTable sst:aws:Dynamo

+  Results sst:aws:Dynamo

+  DatabaseSeed sst:aws:Function

+  DeploymentVersionUpdater sst:aws:Function

+  Urls sst:sst:Linkable

+  default_4_16_6 pulumi:providers:random

+  EncryptionKeyLinkRef sst:sst:LinkRef

+  PostHogHostLinkRef sst:sst:LinkRef

+  UrlsLinkRef sst:sst:LinkRef

+  ContactOpsEmailLinkRef sst:sst:LinkRef

+  OpenAuth sst:aws:Auth → OpenAuthIssuer sst:aws:Function

+  PostHogKeyLinkRef sst:sst:LinkRef

+  OpenAuth sst:aws:Auth → OpenAuthStorage sst:aws:Dynamo

+  LambdaEncryptionKey random:index:RandomBytes

+  OpenAuthVersion sst:sst:Version

+  Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket

+  Bus sst:aws:Bus → BusBus aws:cloudwatch:EventBus

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunction sst:aws:Function

+  DatabaseMigrator sst:aws:Function → DatabaseMigratorLogGroup aws:cloudwatch:LogGroup

+  Router sst:aws:Router → RouterCdn sst:aws:CDN

+  Survey sst:aws:StaticSite → SurveyAssets sst:aws:Bucket

+  Dashboard sst:aws:StaticSite → DashboardAssets sst:aws:Bucket

+  BusLinkRef sst:sst:LinkRef

+  Website sst:aws:StaticSite → WebsiteBuilder command:local:Command

+  ApiFunction sst:aws:Function → ApiFunctionLogGroup aws:cloudwatch:LogGroup

+  ReferralImpressionTrackingTable sst:aws:Dynamo → ReferralImpressionTrackingTableTable aws:dynamodb:Table

+  Reports sst:aws:Bucket → ReportsBucket aws:s3:BucketV2

+  DatabaseSeed sst:aws:Function → DatabaseSeedLogGroup aws:cloudwatch:LogGroup

+  DeploymentVersionUpdater sst:aws:Function → DeploymentVersionUpdaterLogGroup aws:cloudwatch:LogGroup

+  TrackingFunction sst:aws:Function → TrackingFunctionLogGroup aws:cloudwatch:LogGroup

+  OpenAuth sst:aws:Auth → OpenAuthIssuerLogGroup aws:cloudwatch:LogGroup

+  AuthTable sst:aws:Dynamo → AuthTableTable aws:dynamodb:Table

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionLogGroup aws:cloudwatch:LogGroup

+  Results sst:aws:Dynamo → ResultsTable aws:dynamodb:Table

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberRule aws:cloudwatch:EventRule

+  OpenAuth sst:aws:Auth → OpenAuthStorageTable aws:dynamodb:Table

+  Website sst:aws:StaticSite → WebsiteAssetsBucket aws:s3:BucketV2

+  Survey sst:aws:StaticSite → SurveyAssetsBucket aws:s3:BucketV2

+  Dashboard sst:aws:StaticSite → DashboardAssetsBucket aws:s3:BucketV2

+  ReferralImpressionTrackingTableLinkRef sst:sst:LinkRef

+  Reports sst:aws:Bucket → ReportsPublicAccessBlock aws:s3:BucketPublicAccessBlock

+  Reports sst:aws:Bucket → ReportsCors aws:s3:BucketCorsConfigurationV2

+  AuthTableLinkRef sst:sst:LinkRef

+  ResultsLinkRef sst:sst:LinkRef

+  Website sst:aws:StaticSite → WebsiteAssetsPublicAccessBlock aws:s3:BucketPublicAccessBlock

+  Website sst:aws:StaticSite → WebsiteAssetsCors aws:s3:BucketCorsConfigurationV2

+  Survey sst:aws:StaticSite → SurveyAssetsCors aws:s3:BucketCorsConfigurationV2

+  Survey sst:aws:StaticSite → SurveyAssetsPublicAccessBlock aws:s3:BucketPublicAccessBlock

+  Dashboard sst:aws:StaticSite → DashboardAssetsCors aws:s3:BucketCorsConfigurationV2

+  Dashboard sst:aws:StaticSite → DashboardAssetsPublicAccessBlock aws:s3:BucketPublicAccessBlock

+  Reports sst:aws:Bucket → ReportsPolicy aws:s3:BucketPolicy

+  Survey sst:aws:StaticSite → SurveyAssetsPolicy aws:s3:BucketPolicy

+  Website sst:aws:StaticSite → WebsiteAssetsPolicy aws:s3:BucketPolicy

+  Dashboard sst:aws:StaticSite → DashboardAssetsPolicy aws:s3:BucketPolicy

+  ReportsLinkRef sst:sst:LinkRef

+  EmailLinkRef sst:sst:LinkRef

+  WorkspaceAssetsLinkRef sst:sst:LinkRef

+  TrackingFunction sst:aws:Function → TrackingFunctionRole aws:iam:Role

+  ApiFunction sst:aws:Function → ApiFunctionRole aws:iam:Role

+  DatabaseSeed sst:aws:Function → DatabaseSeedRole aws:iam:Role

+  OpenAuth sst:aws:Auth → OpenAuthIssuerRole aws:iam:Role

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionRole aws:iam:Role

+  DeploymentVersionUpdater sst:aws:Function → DeploymentVersionUpdaterRole aws:iam:Role

+  DatabaseMigrator sst:aws:Function → DatabaseMigratorRole aws:iam:Role

+  RouterRoute/workspace-files sst:aws:RouterBucketRoute

+  Survey sst:aws:StaticSite

+  Website sst:aws:StaticSite

+  default pulumi:providers:pulumi-nodejs

+  WebsiteLinkRef sst:sst:LinkRef

+  VPCVersion sst:sst:Version

+  TrackingFunction sst:aws:Function

+  RouterLinkRef sst:sst:LinkRef

+  Dashboard sst:aws:StaticSite → DashboardRoutesUpdate sst:aws:KvRoutesUpdate

+  SurveyLinkRef sst:sst:LinkRef

+  ApiFunction sst:aws:Function → ApiFunctionRoutesUpdate sst:aws:KvRoutesUpdate

+  TrackingFunction sst:aws:Function → TrackingFunctionRoutesUpdate sst:aws:KvRoutesUpdate

+  ApiFunction sst:aws:Function

+  Website sst:aws:StaticSite → WebsiteRoutesUpdate sst:aws:KvRoutesUpdate

+  Survey sst:aws:StaticSite → SurveyRoutesUpdate sst:aws:KvRoutesUpdate

+  RouterRoute/workspace-files sst:aws:RouterBucketRoute → RouterRoute/workspace-filesRoutesUpdate sst:aws:KvRoutesUpdate

+  DashboardLinkRef sst:sst:LinkRef

+  RouterRoute/workspace-files sst:aws:RouterBucketRoute → RouterRoute/workspace-filesRouteKey sst:aws:KvKeys

+  Router sst:aws:Router

+  RouterRoute/workspace-files sst:aws:RouterBucketRoute

+  TrackingFunctionLinkRef sst:sst:LinkRef

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberPermission aws:lambda:Permission

+  Studio sst:sst:DevCommand

+  OpenAuth sst:aws:Auth → OpenAuthIssuerUrl aws:lambda:FunctionUrl

+  TrackingFunction sst:aws:Function → TrackingFunctionUrl aws:lambda:FunctionUrl

+  DockerPostgres sst:sst:DevCommand

+  DatabaseMigratorInvocation aws:lambda:Invocation

+  DatabaseSeedLinkRef sst:sst:LinkRef

+  DeploymentVersionUpdaterLinkRef sst:sst:LinkRef

+  DatabaseSeedInvocation aws:lambda:Invocation

+  DatabaseMigratorLinkRef sst:sst:LinkRef

+  DeploymentVersionUpdate aws:lambda:Invocation

+  PostgresLinkRef sst:sst:LinkRef

+  VPCVersion sst:sst:Version

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberTarget aws:cloudwatch:EventTarget

+  OpenAuth sst:aws:Auth

+  Dashboard sst:aws:StaticSite

+  Dashboard sst:aws:StaticSite → DashboardKvKeys sst:aws:KvKeys

+  ApiFunction sst:aws:Function → ApiFunctionUrl aws:lambda:FunctionUrl

+  OpenAuthLinkRef sst:sst:LinkRef

+  ApiFunctionLinkRef sst:sst:LinkRef

+  TrackingFunction sst:aws:Function → TrackingFunctionRouteKey sst:aws:KvKeys

+  ApiFunction sst:aws:Function → ApiFunctionRouteKey sst:aws:KvKeys

+  Website sst:aws:StaticSite → WebsiteKvKeys sst:aws:KvKeys

+  Survey sst:aws:StaticSite → SurveyBuilder command:local:Command

+  Website sst:aws:StaticSite → WebsiteAssetFiles sst:aws:BucketFiles

+  Website sst:aws:StaticSite → WebsiteInvalidation sst:aws:DistributionInvalidation

+  VPC sst:aws:Vpc

+  VPCLinkRef sst:sst:LinkRef

+  Survey sst:aws:StaticSite → SurveyKvKeys sst:aws:KvKeys

+  Survey sst:aws:StaticSite → SurveyAssetFiles sst:aws:BucketFiles

+  Survey sst:aws:StaticSite → SurveyInvalidation sst:aws:DistributionInvalidation

+  inheritly-alistairstead pulumi:pulumi:Stack
```

## Diff output 2
```
SST 3.17.4  ready!

➜  App:        inheritly
   Stage:      dev

~  Diff

$ bunx --bun vite build
vite v6.3.5 building for production...
Generated route tree in 72ms
transforming...
|  Created     Website sst:aws:StaticSite → WebsiteBuilder command:local:Command
|  Created     DeploymentVersionUpdate aws:lambda:Invocation
|  Created     DatabaseMigratorInvocation aws:lambda:Invocation
✓ 1754 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                        0.88 kB │ gzip:   0.46 kB
dist/assets/index-DEg0doZY.css        80.46 kB │ gzip:  13.15 kB
dist/assets/privacy-BsBkDwm0.js        7.93 kB │ gzip:   2.66 kB
dist/assets/referral-BjXJcq9E.js       9.74 kB │ gzip:   2.51 kB
dist/assets/index-J9Mkwgwv.js         12.04 kB │ gzip:   3.60 kB
dist/assets/Footer-rW9y7s8I.js        32.88 kB │ gzip:  11.41 kB
dist/assets/ContactForm-CLRTqEnQ.js   80.11 kB │ gzip:  19.96 kB
dist/assets/index-By2sXoFz.js        415.56 kB │ gzip: 139.63 kB
✓ built in 1.35s
|  Created     Survey sst:aws:StaticSite → SurveyBuilder command:local:Command
$ bunx --bun vite build
|  Updated     Website sst:aws:StaticSite → WebsiteAssetFiles sst:aws:BucketFiles
|  Updated     Website sst:aws:StaticSite → WebsiteInvalidation sst:aws:DistributionInvalidation
|  Created     DatabaseSeed sst:aws:Function → DatabaseSeedCode aws:s3:BucketObjectv2
|  Created     DatabaseSeed sst:aws:Function → DatabaseSeedSourcemap0 aws:s3:BucketObjectv2
|  Updated     DatabaseSeed sst:aws:Function → DatabaseSeedFunction aws:lambda:Function
|  Created     DatabaseSeedInvocation aws:lambda:Invocation
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuerCode aws:s3:BucketObjectv2
|  Created     OpenAuth sst:aws:Auth → OpenAuthIssuerSourcemap0 aws:s3:BucketObjectv2
|  Updated     OpenAuth sst:aws:Auth → OpenAuthIssuerFunction aws:lambda:Function
vite v6.3.5 building for production...
Generated route tree in 90ms
transforming...
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionCode aws:s3:BucketObjectv2
|  Updated     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionFunction aws:lambda:Function
|  Created     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionSourcemap0 aws:s3:BucketObjectv2
|  Created     ApiFunction sst:aws:Function → ApiFunctionCode aws:s3:BucketObjectv2
|  Created     ApiFunction sst:aws:Function → ApiFunctionSourcemap0 aws:s3:BucketObjectv2
|  Updated     ApiFunction sst:aws:Function → ApiFunctionFunction aws:lambda:Function
✓ 3389 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                            0.72 kB │ gzip:   0.38 kB
dist/assets/index-B3ndF9tm.css            80.48 kB │ gzip:  13.93 kB
dist/assets/index-CEV9pcFS.css           278.77 kB │ gzip:  31.75 kB
dist/assets/index-D_Wxvt_x.js              0.06 kB │ gzip:   0.08 kB
dist/assets/_referralCode-D_Wxvt_x.js      0.06 kB │ gzip:   0.08 kB
dist/assets/route-Dy4x4u8J.js              0.19 kB │ gzip:   0.16 kB
dist/assets/tooltip-qbqzoeLP.js            0.84 kB │ gzip:   0.48 kB
dist/assets/success-DhXtrlo2.js            1.33 kB │ gzip:   0.66 kB
dist/assets/section2-Ciq9UDHg.js           4.00 kB │ gzip:   1.58 kB
dist/assets/section1-DF1COHl0.js           4.17 kB │ gzip:   1.60 kB
dist/assets/privacy-Cwd4W54N.js            6.24 kB │ gzip:   2.13 kB
dist/assets/section5-Z2jFtoSM.js           6.45 kB │ gzip:   1.99 kB
dist/assets/section4-73mwnp6K.js           7.06 kB │ gzip:   2.30 kB
dist/assets/section3-M3gt3jkF.js           7.80 kB │ gzip:   2.58 kB
dist/assets/Container-CtClkSyB.js         25.11 kB │ gzip:   8.08 kB
dist/assets/index-DlZ2ZcLf.js            215.37 kB │ gzip:  64.85 kB
dist/assets/index-CUoAQjNx.js          2,704.74 kB │ gzip: 650.23 kB
✓ built in 3.31s

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
|  Updated     Survey sst:aws:StaticSite → SurveyKvKeys sst:aws:KvKeys
|  Created     Dashboard sst:aws:StaticSite → DashboardBuilder command:local:Command
$ bunx --bun vite build
|  Updated     Survey sst:aws:StaticSite → SurveyAssetFiles sst:aws:BucketFiles
|  Updated     Survey sst:aws:StaticSite → SurveyInvalidation sst:aws:DistributionInvalidation
vite v6.3.5 building for production...
Generated route tree in 109ms
transforming...
✓ 3460 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                 0.67 kB │ gzip:   0.35 kB
dist/assets/index-HTaXj0-e.css                106.26 kB │ gzip:  18.36 kB
dist/assets/skeleton-DcNJFVSJ.js                0.17 kB │ gzip:   0.16 kB
dist/assets/loader-circle-C-wdtYLO.js           0.31 kB │ gzip:   0.26 kB
dist/assets/plus-ilhfugSN.js                    0.33 kB │ gzip:   0.26 kB
dist/assets/arrow-left-S1B8rPoc.js              0.34 kB │ gzip:   0.27 kB
dist/assets/circle-check-DRPYi5ld.js            0.35 kB │ gzip:   0.27 kB
dist/assets/clock-BeijJyK8.js                   0.35 kB │ gzip:   0.27 kB
dist/assets/circle-check-big-W79Y1VDN.js        0.36 kB │ gzip:   0.28 kB
dist/assets/copy-C66HOjqV.js                    0.40 kB │ gzip:   0.31 kB
dist/assets/download-Bd_HJln_.js                0.41 kB │ gzip:   0.30 kB
dist/assets/circle-alert-BaBNHddG.js            0.42 kB │ gzip:   0.30 kB
dist/assets/eye-CWOFZKhP.js                     0.42 kB │ gzip:   0.30 kB
dist/assets/shield-_uPGbkp4.js                  0.44 kB │ gzip:   0.33 kB
dist/assets/square-pen-DAUUxxkk.js              0.49 kB │ gzip:   0.35 kB
dist/assets/useWorkspaceChange-pagebwhq.js      0.54 kB │ gzip:   0.32 kB
dist/assets/card-CnAsZkxf.js                    0.99 kB │ gzip:   0.38 kB
dist/assets/referral-api-Cdd_KJ7K.js            1.26 kB │ gzip:   0.63 kB
dist/assets/index-CbI_KTT_.js                   1.50 kB │ gzip:   0.67 kB
dist/assets/survey-api-BecTTxM4.js              1.51 kB │ gzip:   0.68 kB
dist/assets/table-DqMf-B8z.js                   1.56 kB │ gzip:   0.54 kB
dist/assets/report-api-TOVniezX.js              1.99 kB │ gzip:   0.63 kB
dist/assets/index-D3W_A2EH.js                   2.22 kB │ gzip:   1.03 kB
dist/assets/progress-KSMMDaTG.js                2.26 kB │ gzip:   1.17 kB
dist/assets/client-api-7gkwCwfp.js              2.61 kB │ gzip:   0.77 kB
dist/assets/settings-Ttxi-UXB.js                3.12 kB │ gzip:   1.23 kB
dist/assets/alert-dialog-DC6VYDw1.js            4.77 kB │ gzip:   1.75 kB
dist/assets/edit-CEM6PbsW.js                    5.52 kB │ gzip:   1.56 kB
dist/assets/create-svxWvIV6.js                  5.60 kB │ gzip:   1.65 kB
dist/assets/branding-BuEin0U5.js                5.91 kB │ gzip:   2.06 kB
dist/assets/index-SsNBVmic.js                   7.34 kB │ gzip:   2.13 kB
dist/assets/en-US-D8UQXs-H.js                   7.68 kB │ gzip:   2.73 kB
dist/assets/_id-CRhbv4SH.js                     8.18 kB │ gzip:   2.27 kB
dist/assets/team-Dai4D4RU.js                    8.43 kB │ gzip:   3.05 kB
dist/assets/enhanced-tabs-DeIEtjwd.js           8.81 kB │ gzip:   3.55 kB
dist/assets/surveys-data-grid-CQmiCsNV.js       9.42 kB │ gzip:   2.94 kB
dist/assets/reports-data-grid-TJ0ObyZ4.js       9.94 kB │ gzip:   2.83 kB
dist/assets/theme-Cp7ZA-mH.js                  20.41 kB │ gzip:   5.91 kB
dist/assets/index-C-loBvLL.js                  52.00 kB │ gzip:  14.00 kB
dist/assets/index-B9AQZ-Y-.js                 109.68 kB │ gzip:  33.07 kB
dist/assets/_id-B6C100Lp.js                   422.21 kB │ gzip: 122.01 kB
dist/assets/index-B0RWfP08.js               1,046.49 kB │ gzip: 310.85 kB
✓ built in 2.42s

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
|  Updated     Dashboard sst:aws:StaticSite → DashboardAssetFiles sst:aws:BucketFiles
|  Updated     Dashboard sst:aws:StaticSite → DashboardInvalidation sst:aws:DistributionInvalidation
|  Deleted     DatabaseMigratorInvocation aws:lambda:Invocation
|  Deleted     DeploymentVersionUpdate aws:lambda:Invocation
|  Deleted     ApiFunction sst:aws:Function → ApiFunctionSourcemap0 aws:s3:BucketObjectv2
|  Deleted     DatabaseSeedInvocation aws:lambda:Invocation
|  Deleted     Dashboard sst:aws:StaticSite → DashboardBuilder command:local:Command
|  Deleted     Survey sst:aws:StaticSite → SurveyBuilder command:local:Command
|  Deleted     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionSourcemap0 aws:s3:BucketObjectv2
|  Deleted     DatabaseSeed sst:aws:Function → DatabaseSeedSourcemap0 aws:s3:BucketObjectv2
|  Deleted     Website sst:aws:StaticSite → WebsiteBuilder command:local:Command
|  Deleted     BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionCode aws:s3:BucketObjectv2
|  Deleted     ApiFunction sst:aws:Function → ApiFunctionCode aws:s3:BucketObjectv2
|  Deleted     DatabaseSeed sst:aws:Function → DatabaseSeedCode aws:s3:BucketObjectv2
|  Deleted     OpenAuth sst:aws:Auth → OpenAuthIssuerSourcemap0 aws:s3:BucketObjectv2
|  Deleted     OpenAuth sst:aws:Auth → OpenAuthIssuerCode aws:s3:BucketObjectv2

↗  Permalink   https://sst.dev/u/4ea58149

✓  Generated
   Website: https://dev.inheritly.ai
   OpenAuth: https://4dhuezouqsujoxoyyqnykig3za0gynvf.lambda-url.eu-west-2.on.aws
   Router: https://dev.inheritly.ai
   ApiFunction: https://api.dev.inheritly.ai
   Dashboard: https://dashboard.dev.inheritly.ai
   PostHogProxy: https://telemetry.dev.inheritly.ai
   Survey: https://survey.dev.inheritly.ai
   TrackingFunction: https://referral.dev.inheritly.ai
   ---
   postgres_id: inheritly-dev-postgrescluster-cbdfnunk
   router_distributionID: E23TTPYIO3GGJ9
   vpc_id: vpc-06018355a85e8a219
   github_role_arn: arn:aws:iam::772954894005:role/dev-GithubActionRole
   github_role_name: dev-GithubActionRole

+  Website sst:aws:StaticSite → WebsiteBuilder command:local:Command
   * dir = /Users/alistairstead/dev/client/ark/inheritly/apps/website
   * triggers[0] = 1754943809936

+  DeploymentVersionUpdate aws:lambda:Invocation
   * input = {"gitCommit":"unknown","metadata":{"environment":"dev","deployedBy":"alistairstead","deployedAt":"2025-08-11T20:23:29.811Z"}}

+  DatabaseMigratorInvocation aws:lambda:Invocation
   * input = 1754943809766

+  Survey sst:aws:StaticSite → SurveyBuilder command:local:Command
   * dir = /Users/alistairstead/dev/client/ark/inheritly/apps/survey
   * triggers[0] = 1754943809910

*  Website sst:aws:StaticSite → WebsiteAssetFiles sst:aws:BucketFiles
   * files[0].hash = f48cbf5e793ad0266dfa0243fd87f76653f998ef68a7c49e178ca8f3edb7fe03
   * files[0].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/index.html
   * files[1].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/favicon.svg
   * files[2].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/favicon.ico
   * files[3].hash = 8e8cbd2157ad375a04b074cf2c40f467da2c248850975e5ed99cad083e894d83
   * files[3].key = assets/referral-BjXJcq9E.js
   * files[3].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/referral-BjXJcq9E.js
   * files[4].hash = ff1a202613f6c8b95eb70e7fa8e58137bffd60f2cc34de9b3c0dbdb89b5b8f87
   * files[4].key = assets/privacy-BsBkDwm0.js
   * files[4].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/privacy-BsBkDwm0.js
   * files[5].contentType = text/javascript;charset=UTF-8
   * files[5].hash = 0d4aaebad9b8025c961e2ebe96d08ba45d71fe0acc9fa97fbd988c11c24d6416
   * files[5].key = assets/index-J9Mkwgwv.js
   * files[5].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/index-J9Mkwgwv.js
   * files[6].contentType = text/css;charset=UTF-8
   * files[6].hash = 03e594dab258cd922dc242e829b5a10ec5cfba9ed74a528217a64748d7fce16d
   * files[6].key = assets/index-DEg0doZY.css
   * files[6].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/index-DEg0doZY.css
   * files[7].hash = b2153a15a80fc0aa62460ce6ab51f0cc9e57b6c79b75ec087d9a9c172625dde8
   * files[7].key = assets/index-By2sXoFz.js
   * files[7].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/index-By2sXoFz.js
   * files[8].hash = 69b41beaf42524bdbbc77b97c3ad9111a14614af0e2e28ccfd85646a542e4648
   * files[8].key = assets/Footer-rW9y7s8I.js
   * files[8].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/Footer-rW9y7s8I.js
   * files[9].hash = 4f1d743ce82b7dcde96c5f2193173c6f11ba1b6c2b5973d76cae25cf3c8c9695
   * files[9].key = assets/ContactForm-CLRTqEnQ.js
   * files[9].source = /Users/alistairstead/dev/client/ark/inheritly/apps/website/dist/assets/ContactForm-CLRTqEnQ.js

*  Website sst:aws:StaticSite → WebsiteInvalidation sst:aws:DistributionInvalidation
   * version = c6beac5f2c1427b5d21a8a178d040d4b

+  DatabaseSeed sst:aws:Function → DatabaseSeedCode aws:s3:BucketObjectv2
   * key = assets/DatabaseSeed-code-c2a44b02af863286bdec207535a5ec9ff84d7d78b07a6901b0abc64623e609e1.zip
   * source = {
       "4dabf18193072939515e22adb298388d": "0def7320c3a5731c473e5ecbe6d01bc7",
       "hash": "a00178fbba8793f95560e82a8c97b680d52dbc0db44291788f931ffbdc829116",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/DatabaseSeed/code.zip"
     }

+  DatabaseSeed sst:aws:Function → DatabaseSeedSourcemap0 aws:s3:BucketObjectv2
   * key = sourcemap/arn:aws:logs:eu-west-2:772954894005:log-group:/aws/lambda/inheritly-dev-DatabaseSeedFunction-baubxswa/c2a44b02af863286bdec207535a5ec9ff84d7d78b07a6901b0abc64623e609e1.bundle.mjs.map
   * source = {
       "4dabf18193072939515e22adb298388d": "c44067f5952c0a294b673a41bacd8c17",
       "hash": "df00b705cf34c1da7d70eb1897bc68e11463e23b5b849ef6c3b7148766ea71a6",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/DatabaseSeed-src/bundle.mjs.map"
     }

*  DatabaseSeed sst:aws:Function → DatabaseSeedFunction aws:lambda:Function
   * s3Key = assets/DatabaseSeed-code-c2a44b02af863286bdec207535a5ec9ff84d7d78b07a6901b0abc64623e609e1.zip

+  DatabaseSeedInvocation aws:lambda:Invocation
   * input = 1754943809896

+  OpenAuth sst:aws:Auth → OpenAuthIssuerCode aws:s3:BucketObjectv2
   * key = assets/OpenAuthIssuer-code-a54eddb672b5be8eb8b5ff26112612453a10be23b498f75a1c4d396e9eb27660.zip
   * source = {
       "4dabf18193072939515e22adb298388d": "0def7320c3a5731c473e5ecbe6d01bc7",
       "hash": "17321042ea8e955e141cdb6b57858ecae2cffece7eed1788ef16d3caced37eeb",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/OpenAuthIssuer/code.zip"
     }

+  OpenAuth sst:aws:Auth → OpenAuthIssuerSourcemap0 aws:s3:BucketObjectv2
   * key = sourcemap/arn:aws:logs:eu-west-2:772954894005:log-group:/aws/lambda/inheritly-dev-OpenAuthIssuerFunction-conehdom/a54eddb672b5be8eb8b5ff26112612453a10be23b498f75a1c4d396e9eb27660.bundle.mjs.map
   * source = {
       "4dabf18193072939515e22adb298388d": "c44067f5952c0a294b673a41bacd8c17",
       "hash": "ec8dcf541a437fce3c4454c9b0cfafd215c2abf612cb261cec974a43b874dbd9",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/OpenAuthIssuer-src/bundle.mjs.map"
     }

*  OpenAuth sst:aws:Auth → OpenAuthIssuerFunction aws:lambda:Function
   * s3Key = assets/OpenAuthIssuer-code-a54eddb672b5be8eb8b5ff26112612453a10be23b498f75a1c4d396e9eb27660.zip

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionCode aws:s3:BucketObjectv2
   * key = assets/BusSubscriberEventSubscriberFunction-code-3f6b47276e6b0795afe2a9e82a6712e27d19c7ceb1946c6c01ffc48ec86e54a0.zip
   * source = {
       "4dabf18193072939515e22adb298388d": "0def7320c3a5731c473e5ecbe6d01bc7",
       "hash": "2b4217fec5f130e0468b81c5fa328ab4baf96cdbfb78ebd5000fdd7bf8ddc02a",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/BusSubscriberEventSubscriberFunction/code.zip"
     }

*  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionFunction aws:lambda:Function
   * s3Key = assets/BusSubscriberEventSubscriberFunction-code-3f6b47276e6b0795afe2a9e82a6712e27d19c7ceb1946c6c01ffc48ec86e54a0.zip

+  BusSubscriberEventSubscriber sst:aws:BusLambdaSubscriber → BusSubscriberEventSubscriberFunctionSourcemap0 aws:s3:BucketObjectv2
   * key = sourcemap/arn:aws:logs:eu-west-2:772954894005:log-group:/aws/lambda/inheri-dev-BusSubscriberEventSubscriberFunctionFunction-bbaexkxf/3f6b47276e6b0795afe2a9e82a6712e27d19c7ceb1946c6c01ffc48ec86e54a0.bundle.mjs.map
   * source = {
       "4dabf18193072939515e22adb298388d": "c44067f5952c0a294b673a41bacd8c17",
       "hash": "d0a085ef0e94045276f415918eace855bf6c36dc19daded31d0c8c69a04e8ffb",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/BusSubscriberEventSubscriberFunction-src/bundle.mjs.map"
     }

+  ApiFunction sst:aws:Function → ApiFunctionCode aws:s3:BucketObjectv2
   * key = assets/ApiFunction-code-dd27d9046149f7ab6ebb98c225f5e1aea0f8ce434bfa6d5a3527e8e8f142404b.zip
   * source = {
       "4dabf18193072939515e22adb298388d": "0def7320c3a5731c473e5ecbe6d01bc7",
       "hash": "6f452614bf7e28ef01bfaddd02d18958e8ed95be0eb6ef0f3ae0cb8e080ba595",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/ApiFunction/code.zip"
     }

*  ApiFunction sst:aws:Function → ApiFunctionFunction aws:lambda:Function
   * description =
   * environment.variables = {
       "4dabf18193072939515e22adb298388d": "1b47061264138c4ac30d75fd1eb44270",
       "ciphertext": "[secret]"
     }
   * environment.variables.CORS_ORIGIN
   - environment.variables.SST_APP
   - environment.variables.SST_APPSYNC_HTTP
   - environment.variables.SST_APPSYNC_REALTIME
   - environment.variables.SST_ASSET_BUCKET
   - environment.variables.SST_FUNCTION_ID
   - environment.variables.SST_REGION
   - environment.variables.SST_STAGE
   * handler = bundle.handler
   * runtime = nodejs20.x
   * s3Key = assets/ApiFunction-code-dd27d9046149f7ab6ebb98c225f5e1aea0f8ce434bfa6d5a3527e8e8f142404b.zip

+  ApiFunction sst:aws:Function → ApiFunctionSourcemap0 aws:s3:BucketObjectv2
   * key = sourcemap/arn:aws:logs:eu-west-2:772954894005:log-group:/aws/lambda/inheritly-dev-ApiFunctionFunction-eunetrob/dd27d9046149f7ab6ebb98c225f5e1aea0f8ce434bfa6d5a3527e8e8f142404b.bundle.mjs.map
   * source = {
       "4dabf18193072939515e22adb298388d": "c44067f5952c0a294b673a41bacd8c17",
       "hash": "e9afcf26551f5842acbf4be8cfba05255d4d832bd2fa1c6f08d921efd8a738b0",
       "path": "/Users/alistairstead/dev/client/ark/inheritly/.sst/artifacts/ApiFunction-src/bundle.mjs.map"
     }

*  Survey sst:aws:StaticSite → SurveyKvKeys sst:aws:KvKeys
   * entries = {
       "4dabf18193072939515e22adb298388d": "1b47061264138c4ac30d75fd1eb44270",
       "ciphertext": "[secret]"
     }

+  Dashboard sst:aws:StaticSite → DashboardBuilder command:local:Command
   * dir = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard
   * triggers[0] = 1754943809798

*  Survey sst:aws:StaticSite → SurveyAssetFiles sst:aws:BucketFiles
   * files[0].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/index.html
   * files[10].hash = a822734a42d945ceca02db7e683ea889b4f031c72a8407da2c3d4dfb48ed95c8
   * files[10].key = assets/success-DhXtrlo2.js
   * files[10].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/success-DhXtrlo2.js
   * files[11].hash = a09928192c894a73b861c0371f67e39936a30a7030e808bf75f55750b0d3e5f5
   * files[11].key = assets/section5-Z2jFtoSM.js
   * files[11].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/section5-Z2jFtoSM.js
   * files[12].hash = 391b6345e0a4c3ef2adfc08b3c49458728f75145f124f13e1be062c54bea6650
   * files[12].key = assets/section4-73mwnp6K.js
   * files[12].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/section4-73mwnp6K.js
   * files[13].hash = 5ccf42bdcffec8a604a83d75801b309db9d07b1bcb967b53b41f05fbe0d5eeea
   * files[13].key = assets/section3-M3gt3jkF.js
   * files[13].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/section3-M3gt3jkF.js
   * files[14].hash = 95baa5920329ab65f91817aedf717f78e8c8e3f1610e03edb5227e661611ff3d
   * files[14].key = assets/section2-Ciq9UDHg.js
   * files[14].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/section2-Ciq9UDHg.js
   * files[15].hash = feabcfe654d23e47c67a83f24aeb4deb765a8bba77ffddedb6aa67ac23d758d4
   * files[15].key = assets/section1-DF1COHl0.js
   * files[15].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/section1-DF1COHl0.js
   * files[16].hash = 53683102ced310ca73dd880d7e54e5d28976acd5d28ea4962ac1785b9ddc9a1c
   * files[16].key = assets/route-Dy4x4u8J.js
   * files[16].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/route-Dy4x4u8J.js
   * files[17].hash = 76b1f1dc85eee5404ff540677a5153e301ca7c83fee4e2fe060c9463ed5f558d
   * files[17].key = assets/privacy-Cwd4W54N.js
   * files[17].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/privacy-Cwd4W54N.js
   * files[18].hash = c6ad03f910487c23c0730696175d516c2acdbb3497232d0afd1b3cec5c36a6cc
   * files[18].key = assets/index-DlZ2ZcLf.js
   * files[18].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/index-DlZ2ZcLf.js
   * files[19].hash = 2820fbd43de6d6e7dda52d2a97d413f36a2a8fe5372d929e52a195acc3788af5
   * files[19].key = assets/index-D_Wxvt_x.js
   * files[19].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/index-D_Wxvt_x.js
   * files[1].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/robots.txt
   * files[20].contentType = text/javascript;charset=UTF-8
   * files[20].hash = 6ba09b39343172097b8250381aa26081b916d8d36bd59a8da4de2a99fbcb57d4
   * files[20].key = assets/index-CUoAQjNx.js
   * files[20].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/index-CUoAQjNx.js
   * files[21].hash = 78993611382f7f297dcc01494b41a14b90b9ca5bf0ed64d831f5407826681bb1
   * files[21].key = assets/index-CEV9pcFS.css
   * files[21].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/index-CEV9pcFS.css
   * files[22].contentType = text/css;charset=UTF-8
   * files[22].hash = 0abd4fc3ef5eda048f099d51a3e2273cdf6c29c26aabfc06537f5473573550b8
   * files[22].key = assets/index-B3ndF9tm.css
   * files[22].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/index-B3ndF9tm.css
   * files[23].hash = 2820fbd43de6d6e7dda52d2a97d413f36a2a8fe5372d929e52a195acc3788af5
   * files[23].key = assets/_referralCode-D_Wxvt_x.js
   * files[23].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/_referralCode-D_Wxvt_x.js
   + files[24] = {
       "cacheControl": "max-age=31536000,public,immutable",
       "contentType": "text/javascript;charset=UTF-8",
       "hash": "bf72798810f76768061d558d3a8405c05ec9356bdbf37f65c3bfc45c41f0eeee",
       "key": "assets/Container-CtClkSyB.js",
       "source": "/Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/Container-CtClkSyB.js"
     }
   * files[2].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/favicon.svg
   * files[3].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/favicon.ico
   * files[4].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/bg-right.png
   * files[5].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/bg-left.png
   * files[6].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/apple-touch-icon.png
   * files[7].contentType = application/octet-stream
   * files[7].hash = 27d694b2f35516b2d4809acd2e99037ed7f93f2b6c612ee60a72598da71d7947
   * files[7].key = .DS_Store
   * files[7].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/.DS_Store
   * files[8].contentType = image/png
   * files[8].hash = 2765acc2fa3f37ffd125676c91d6647bcfa343e989d0f2c91f19b192b08bb51c
   * files[8].key = email/inheritly-logo.png
   * files[8].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/email/inheritly-logo.png
   * files[9].hash = 1d479d5332c4b8027098653ed3fb87e197f75efdadc6b9a2c22249d2582d145f
   * files[9].key = assets/tooltip-qbqzoeLP.js
   * files[9].source = /Users/alistairstead/dev/client/ark/inheritly/apps/survey/dist/assets/tooltip-qbqzoeLP.js

*  Survey sst:aws:StaticSite → SurveyInvalidation sst:aws:DistributionInvalidation
   * version = 142cb63d4f1f7fbfbb017b930feeb673

*  Dashboard sst:aws:StaticSite → DashboardAssetFiles sst:aws:BucketFiles
   * files[0].hash = d15381fd0a7cb5e8ac671ebf6ced9fed7082b81631b7364bc75f652dddda72cb
   * files[0].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/index.html
   * files[10].hash = ab6929d5ef84b8d71e9bd54b10d5328192e2153b61dde6ea71c9536cd1dfb434
   * files[10].key = assets/surveys-data-grid-CQmiCsNV.js
   * files[10].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/surveys-data-grid-CQmiCsNV.js
   * files[11].hash = 5641f48490cfd26850775ae408bd35d70a153269e5b3513d85e6ed5bc7cea3fb
   * files[11].key = assets/survey-api-BecTTxM4.js
   * files[11].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/survey-api-BecTTxM4.js
   * files[12].hash = 6591cddbbdb021670a37d9ff8d6da25957628d892723a2f9536ea9340ce0acc0
   * files[12].key = assets/square-pen-DAUUxxkk.js
   * files[12].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/square-pen-DAUUxxkk.js
   * files[13].hash = c266b9d7b2d4c82f916b2af53c8271b4b4ed20997ec07dcc5c873956375b284b
   * files[13].key = assets/skeleton-DcNJFVSJ.js
   * files[13].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/skeleton-DcNJFVSJ.js
   * files[14].hash = 8afd123dbcbfa38eb5ed3d0b617bb8a46a591c16801bcf0fb4199e047f0eb8d4
   * files[14].key = assets/shield-_uPGbkp4.js
   * files[14].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/shield-_uPGbkp4.js
   * files[15].hash = 6931fad3a22145b350171fab00cf4126e8560d2a74333fa9b8db7052f371e839
   * files[15].key = assets/settings-Ttxi-UXB.js
   * files[15].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/settings-Ttxi-UXB.js
   * files[16].hash = 83177cee79588aee4690100468a550fce371e1b31614c014c8054c10b85300f5
   * files[16].key = assets/reports-data-grid-TJ0ObyZ4.js
   * files[16].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/reports-data-grid-TJ0ObyZ4.js
   * files[17].hash = cb8cd04a7213015a50fe65dbd183a11a9a9a660ebeacaf803e7479cba03c59da
   * files[17].key = assets/report-api-TOVniezX.js
   * files[17].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/report-api-TOVniezX.js
   * files[18].hash = ff2af9da6643f33dd4547990abd08132b8ad5019f3a2f343a6d50d599fa9f61d
   * files[18].key = assets/referral-api-Cdd_KJ7K.js
   * files[18].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/referral-api-Cdd_KJ7K.js
   * files[19].hash = ac99a02e66b23fba9be1c6afaa84077b03de6a244fdc63454f4a7dc8527f200c
   * files[19].key = assets/progress-KSMMDaTG.js
   * files[19].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/progress-KSMMDaTG.js
   * files[1].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/robots.txt
   * files[20].hash = 139232ddee716d8f735d9e015958bc4843d82309a3a440734f85c7b63dc6cbd3
   * files[20].key = assets/plus-ilhfugSN.js
   * files[20].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/plus-ilhfugSN.js
   * files[21].hash = 2f2daefbe749684111e204a1477c0cf987fe50a9391678d626bfd73dbe35db6f
   * files[21].key = assets/loader-circle-C-wdtYLO.js
   * files[21].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/loader-circle-C-wdtYLO.js
   * files[22].contentType = text/javascript;charset=UTF-8
   * files[22].hash = fb2a93c791c7f0f01fbc1b4246fd0f8b24164b180b60b2111e9efa56f6615684
   * files[22].key = assets/index-SsNBVmic.js
   * files[22].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-SsNBVmic.js
   * files[23].contentType = text/css;charset=UTF-8
   * files[23].hash = c8de485940776776e70a567216e4e7f410d23a99cf460fc277afbd4ddc6b400b
   * files[23].key = assets/index-HTaXj0-e.css
   * files[23].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-HTaXj0-e.css
   * files[24].hash = 23fc586619db0045bc7b59324af90af4410bb412b419fb22ce1654ca7846f4ef
   * files[24].key = assets/index-D3W_A2EH.js
   * files[24].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-D3W_A2EH.js
   * files[25].hash = 5e9af6454e1aa4f437656c07a53604a0c903f1421800bbbb9a0a3cd7fdee43cf
   * files[25].key = assets/index-CbI_KTT_.js
   * files[25].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-CbI_KTT_.js
   * files[26].hash = e6e13770e26979848c589d4327e4449fdce50b9177e962f04d9e4b09895d7478
   * files[26].key = assets/index-C-loBvLL.js
   * files[26].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-C-loBvLL.js
   * files[27].hash = 30b69c68259f99e5b3fbedc6eebae64d13017a78bc22866b321e7ddd133e4e8b
   * files[27].key = assets/index-B9AQZ-Y-.js
   * files[27].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-B9AQZ-Y-.js
   * files[28].hash = 1c900e3b39bb7f5af93a1f3a59172ad1934b4d2741fd0e0d1dab8658c77a1e27
   * files[28].key = assets/index-B0RWfP08.js
   * files[28].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/index-B0RWfP08.js
   * files[29].hash = 0bac0e6d2c3247a0831f2ee60aa9f037c5fd3831b42b923f547c1e49db6853d5
   * files[29].key = assets/eye-CWOFZKhP.js
   * files[29].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/eye-CWOFZKhP.js
   * files[2].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/favicon.svg
   * files[30].hash = 0382aabcc2b8e7abb036edfbb53d8edcddf3e6a38b9a2f50796d0a32859415f0
   * files[30].key = assets/enhanced-tabs-DeIEtjwd.js
   * files[30].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/enhanced-tabs-DeIEtjwd.js
   * files[31].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/en-US-D8UQXs-H.js
   * files[32].hash = a9aca969efff36cf0ac3d13155e8c14802861459137133a39574a14c827b355f
   * files[32].key = assets/edit-CEM6PbsW.js
   * files[32].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/edit-CEM6PbsW.js
   * files[33].hash = 90852f341e6870c911a34cd70b3281a26f73b6d3788edf10799d7ebcb17f27ad
   * files[33].key = assets/download-Bd_HJln_.js
   * files[33].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/download-Bd_HJln_.js
   * files[34].hash = fbeb5bbd8b009fbd9dedad56d0d11c83c1dcaf98708864f33060ff088953f2c6
   * files[34].key = assets/create-svxWvIV6.js
   * files[34].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/create-svxWvIV6.js
   * files[35].hash = 1d8745bb0a9982bdb04295a2afb5a44762e887ef7a5d5be6f889521c53d8ee36
   * files[35].key = assets/copy-C66HOjqV.js
   * files[35].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/copy-C66HOjqV.js
   * files[36].hash = df64f66a5855189169d880e99aec4946f1b03972e141fd58f0369db95f450468
   * files[36].key = assets/clock-BeijJyK8.js
   * files[36].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/clock-BeijJyK8.js
   * files[37].hash = 008fc87cb25c13dfd7f3e2b6d4f4e529ac03219b1d12be638734b2e31d9f32e3
   * files[37].key = assets/client-api-7gkwCwfp.js
   * files[37].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/client-api-7gkwCwfp.js
   * files[38].hash = 26226ce59c5a4a531dd1c6402314a4c4ec44abb4b37b7782a4f061626d7eaaa2
   * files[38].key = assets/circle-check-big-W79Y1VDN.js
   * files[38].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/circle-check-big-W79Y1VDN.js
   * files[39].hash = 1026b10f958ec8abd337672ff0168a05e07aba29c102947e6e915f7abc4a736e
   * files[39].key = assets/circle-check-DRPYi5ld.js
   * files[39].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/circle-check-DRPYi5ld.js
   * files[3].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/favicon.ico
   * files[40].hash = 597482348e95bc8e98235776d5dd3f2a7054619349ebd8777900a054d4b2515a
   * files[40].key = assets/circle-alert-BaBNHddG.js
   * files[40].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/circle-alert-BaBNHddG.js
   * files[41].hash = a044fdcdeff787e189d4112e7e02df06c311c7ecb05ef1e6a5213254623be8ea
   * files[41].key = assets/card-CnAsZkxf.js
   * files[41].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/card-CnAsZkxf.js
   * files[42].hash = c7d122a09daa18cfd8cb04ec143bae3fbfe7e4e3242acf11c29be5a9824fdd77
   * files[42].key = assets/branding-BuEin0U5.js
   * files[42].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/branding-BuEin0U5.js
   * files[43].hash = f132e9a0497d6f91101306745b93bbac55f26525e7a4ba9434088af3e97c47b1
   * files[43].key = assets/arrow-left-S1B8rPoc.js
   * files[43].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/arrow-left-S1B8rPoc.js
   * files[44].hash = 88e462cb1e815c2ce92b4ddf1c0270982dfc4dfd24c4b1b4b7a26e1c025f0b68
   * files[44].key = assets/alert-dialog-DC6VYDw1.js
   * files[44].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/alert-dialog-DC6VYDw1.js
   * files[45].hash = 4f3b96810df1aced0821b967a81d6815dec5504773a336138fbba0416ceafcbc
   * files[45].key = assets/_id-CRhbv4SH.js
   * files[45].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/_id-CRhbv4SH.js
   * files[46].hash = 4b6764aab165788f48653be319689b5745c72cd8f1bedf6f171d7895293a788a
   * files[46].key = assets/_id-B6C100Lp.js
   * files[46].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/_id-B6C100Lp.js
   * files[4].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/apple-touch-icon.png
   * files[5].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/email/inheritly-logo.png
   * files[6].hash = 469b82ac0699fd8dbfb8017bed3c4afd931da4e624268de73cc03aae2337a3b2
   * files[6].key = assets/useWorkspaceChange-pagebwhq.js
   * files[6].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/useWorkspaceChange-pagebwhq.js
   * files[7].hash = a8d8391a73e947d2b45c95f50d310b6275b2cf9763f3658636591fa51e9e60fb
   * files[7].key = assets/theme-Cp7ZA-mH.js
   * files[7].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/theme-Cp7ZA-mH.js
   * files[8].hash = 628ce613729f15a1fdea7cb166367535deb46a56205e2f6692790e8a0ce3a94b
   * files[8].key = assets/team-Dai4D4RU.js
   * files[8].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/team-Dai4D4RU.js
   * files[9].hash = e508dea4552332b6cc57cdef9a27d6dbb048fd12c4b7c2abf8788c76cdf5fb27
   * files[9].key = assets/table-DqMf-B8z.js
   * files[9].source = /Users/alistairstead/dev/client/ark/inheritly/apps/dashboard/dist/assets/table-DqMf-B8z.js

*  Dashboard sst:aws:StaticSite → DashboardInvalidation sst:aws:DistributionInvalidation
   * version = 3e595f9857ea4b972e5cbf17f9a7affc

```
