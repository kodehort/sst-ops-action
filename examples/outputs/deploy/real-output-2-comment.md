### 🚀 DEPLOY SUCCESS

**Stage:** `staging`
**App:** `blog-platform`
**Status:** `complete`

### 📊 Resource Changes

**Total Changes:** 12

| Resource | Action | Details |
|----------|---------|---------|
| `CMS` | 🆕 Created | sst:aws:StaticSite → CMSBuilder command:local:Command |
| `CMS` | 📝 Updated | sst:aws:StaticSite → CMSDistribution aws:cloudfront:Distribution |
| `BlogApi` | 🆕 Created | sst:aws:Function → BlogApiLogGroup aws:cloudwatch:LogGroup |
| `BlogApi` | 📝 Updated | sst:aws:Function → BlogApiLambda aws:lambda:Function |
| `BlogApi` | 🆕 Created | sst:aws:Function → BlogApiUrl aws:lambda:FunctionUrl |
| `Database` | 🆕 Created | sst:aws:Postgres → DatabaseCluster aws:rds:Cluster |
| `FileStorage` | 🆕 Created | sst:aws:Bucket → FileStorageBucket aws:s3:BucketV2 |
| `Queue` | 🆕 Created | sst:aws:Queue → QueueSqs aws:sqs:Queue |
| `Worker` | 📝 Updated | sst:aws:Function → WorkerLambda aws:lambda:Function |
| `Cache` | 🆕 Created | sst:aws:Redis → CacheCluster aws:elasticache:ReplicationGroup |
| `SearchIndex` | 🆕 Created | sst:aws:OpenSearch → SearchDomain aws:opensearch:Domain |
| `Monitoring` | 📝 Updated | sst:aws:Function → MonitoringLambda aws:lambda:Function |

### 🔗 Deployed URLs
- **api**: [https://api.blog-staging.dev](https://api.blog-staging.dev)
- **other**: [https://cms.blog-staging.dev](https://cms.blog-staging.dev)
- **web**: [https://blog-staging.dev](https://blog-staging.dev)
- **other**: [https://admin.blog-staging.dev](https://admin.blog-staging.dev)
- **other**: [https://search-blog-staging.us-west-2.es.amazonaws.com](https://search-blog-staging.us-west-2.es.amazonaws.com)

### 🖥️ SST Console

[View in SST Console](https://sst.dev/u/xyz789ghi) to see detailed resource information and logs.