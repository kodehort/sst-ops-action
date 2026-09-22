### ❌ DEPLOY FAILED

| Property | Value |
|----------|-------|
| App | `kodehort-scratch` |
| Stage | `sst-ops-actions` |
| Resource Changes | 11 |
| URLs | 0 |
| Outputs | 0 |
| Status | ![Failed](https://img.shields.io/badge/Status-Failed-red) |

### 📊 Resource Changes

**Total Changes:** 11

| Resource | Action | Details |
|----------|---------|---------|
| `default_6_66_2` | 🆕 Created | pulumi:providers:aws |
| `Database` | 🆕 Created | sst:aws:Dynamo |
| `Web` | 🆕 Created | sst:aws:Astro → WebAssets sst:aws:Bucket |
| `default_4_16_6` | 🆕 Created | pulumi:providers:random |
| `LambdaEncryptionKey` | 🆕 Created | random:index:RandomBytes |
| `Router` | 🆕 Created | sst:aws:Router → RouterCdn sst:aws:CDN |
| `default_1_0_1` | 🆕 Created | pulumi:providers:command |
| `Api` | 🆕 Created | sst:aws:Function → ApiLogGroup aws:cloudwatch:LogGroup |
| `Web` | 🆕 Created | sst:aws:Astro → WebBuilder command:local:Command |
| `Web` | 🆕 Created | sst:aws:Astro → WebAssetsBucket aws:s3:BucketV2 |
| `Database` | 🆕 Created | sst:aws:Dynamo → DatabaseTable aws:dynamodb:Table |