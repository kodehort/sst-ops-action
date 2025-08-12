### 🔍 Infrastructure Diff Summary

| Property | Value |
|----------|-------|
| App | `complex-app` |
| Stage | `staging` |
| Total Changes | 8 |
| Added Resources | 4 |
| Modified Resources | 2 |
| Removed Resources | 2 |
| Status | ![Success](https://img.shields.io/badge/Status-Success-green) |
| Console Link | [View Diff](https://console.sst.dev/complex-app/staging/diffs/complex123) |

### 📋 Resource Changes

```diff
+ AuthHandler (Function)
+ UserProcessor (Function)
+ GraphQLAPI (Api)
+ UserDatabase (Aurora)
* EmailHandler (Function)
* RestAPI (Api)
- LegacyWebsite (StaticSite)
- OldUserTable (Dynamo)
```