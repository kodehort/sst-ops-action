### 🔍 Infrastructure Diff Summary

| Property | Value |
|----------|-------|
| App | `kodehort-scratch` |
| Stage | `dev` |
| Total Changes | 1 |
| Added Resources | 1 |
| Modified Resources | 0 |
| Removed Resources | 0 |
| Status | ![Success](https://img.shields.io/badge/Status-Success-green) |
| Console Link | [View Diff](https://sst.dev/u/31550ec5) |

<details>
<summary>📋 View Resource Changes</summary>

```diff
Router: https://dev.kodeapps.co.uk
   Web: https://dev.kodeapps.co.uk
   Api: https://api.dev.kodeapps.co.uk
   ---
   github_role_arn: arn:aws:iam::194218796960:role/dev-GithubActionRole
   github_role_name: dev-GithubActionRole

+  Web sst:aws:Astro → WebBuilder command:local:Command
   * environment (65 variables changed, values hidden)
   * triggers[0] = 1755101063020
```

</details>