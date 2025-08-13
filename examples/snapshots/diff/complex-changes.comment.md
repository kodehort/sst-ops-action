### 🔍 DIFF SUCCESS

**Stage:** `production`
**App:** `my-complex-app`
**Status:** `complete`

### 🔍 Infrastructure Changes Preview

| Property | Value |
|----------|-------|
| App | `my-complex-app` |
| Stage | `production` |
| Total Changes | 6 |
| Summary | 6 changes planned |
| Console Link | [View Diff](https://console.sst.dev/my-complex-app/production/diffs/xyz789) |

### 📋 Resource Changes

```diff
+  my-complex-app-production pulumi:pulumi:Stack

+  NewAuth sst:aws:Function

+  UsersDatabase sst:aws:Aurora

*  Api sst:aws:Api

*  Website sst:aws:StaticSite

-  OldProcessor sst:aws:Function

-  NotificationTopic sst:aws:Topic

+  NewAuth sst:aws:Function → NewAuthLogGroup aws:cloudwatch:LogGroup

+  UsersDatabase sst:aws:Aurora → UsersDatabaseCluster aws:rds:Cluster

*  Api sst:aws:Api → ApiFunction sst:aws:Function

*  Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket

-  OldProcessor sst:aws:Function → OldProcessorLogGroup aws:cloudwatch:LogGroup

-  NotificationTopic sst:aws:Topic → NotificationTopicTopic aws:sns:Topic
```

### 🖥️ SST Console

[View in SST Console](https://console.sst.dev/my-complex-app/production/diffs/xyz789) to see detailed resource information and logs.