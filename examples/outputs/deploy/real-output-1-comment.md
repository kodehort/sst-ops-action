### 🚀 DEPLOY SUCCESS

**Stage:** `production`
**App:** `e-commerce-api`
**Status:** `complete`

### 📊 Resource Changes

**Total Changes:** 9

| Resource | Action | Details |
|----------|---------|---------|
| `Database` | 🆕 Created | sst:aws:Dynamo → DatabaseTable aws:dynamodb:Table |
| `Queue` | 🆕 Created | sst:aws:Queue → QueueSqs aws:sqs:Queue |
| `ApiFunction` | 📝 Updated | sst:aws:Function → ApiFunctionLambda aws:lambda:Function |
| `ApiFunction` | 🆕 Created | sst:aws:Function → ApiFunctionUrl aws:lambda:FunctionUrl |
| `Router` | 🆕 Created | sst:aws:Router → RouterCdn sst:aws:CDN |
| `Website` | 📝 Updated | sst:aws:StaticSite → WebsiteDistribution aws:cloudfront:Distribution |
| `Auth` | 🆕 Created | sst:aws:Auth → AuthIssuer sst:aws:Function |
| `Worker` | 📝 Updated | sst:aws:Function → WorkerLambda aws:lambda:Function |
| `Bucket` | 🆕 Created | sst:aws:Bucket → BucketS3 aws:s3:BucketV2 |

### 🔗 Deployed URLs
- **api**: [https://api.ecommerce-prod.com](https://api.ecommerce-prod.com)
- **web**: [https://ecommerce-prod.com](https://ecommerce-prod.com)
- **other**: [https://auth.ecommerce-prod.com/oauth](https://auth.ecommerce-prod.com/oauth)
- **other**: [https://admin.ecommerce-prod.com](https://admin.ecommerce-prod.com)

### 🖥️ SST Console

[View in SST Console](https://sst.dev/u/abc123def) to see detailed resource information and logs.