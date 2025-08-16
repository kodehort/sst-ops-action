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
   + environment.ACTIONS_CACHE_SERVICE_V2 = True
   + environment.ACTIONS_CACHE_URL = https://acghubeus2.actions.githubusercontent.com/YiRw6b4j0YehLWXAZlEKzBPEU9dOCzWm5vDzxOHqrSY88agxO0/
   * environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN = ***
   * environment.ACTIONS_ID_TOKEN_REQUEST_URL = https://run-actions-3-azure-eastus.actions.githubusercontent.com/104//idtoken/8181d81a-1c0a-482d-b87c-75c52ccd2c47/1cbd420d-c7f0-504d-8b31-81a706ca7886?api-version=2.0
   + environment.ACTIONS_RESULTS_URL = https://results-receiver.actions.githubusercontent.com/
   + environment.ACTIONS_RUNTIME_TOKEN = ***
   + environment.ACTIONS_RUNTIME_URL = https://pipelinesghubeus13.actions.githubusercontent.com/YiRw6b4j0YehLWXAZlEKzBPEU9dOCzWm5vDzxOHqrSY88agxO0/
   * environment.AWS_ACCESS_KEY_ID = ***
   * environment.AWS_SECRET_ACCESS_KEY = ***
   * environment.AWS_SESSION_TOKEN = ***
   * environment.CI = 1
   + environment.FORCE_COLOR = 3
   * environment.GITHUB_ACTION = diff
   - environment.GITHUB_ACTION_PATH
   * environment.GITHUB_ACTION_REF = v0
   * environment.GITHUB_ACTION_REPOSITORY = kodehort/sst-ops-action
   * environment.GITHUB_BASE_REF = main
   * environment.GITHUB_ENV = /home/runner/work/_temp/_runner_file_commands/set_env_ea5de4c1-f39c-409c-97d4-6249a970121a
   * environment.GITHUB_EVENT_NAME = pull_request
   * environment.GITHUB_HEAD_REF = sst-ops-actions
   * environment.GITHUB_JOB = diff
   * environment.GITHUB_OUTPUT = /home/runner/work/_temp/_runner_file_commands/set_output_ea5de4c1-f39c-409c-97d4-6249a970121a
   * environment.GITHUB_PATH = /home/runner/work/_temp/_runner_file_commands/add_path_ea5de4c1-f39c-409c-97d4-6249a970121a
   * environment.GITHUB_REF = refs/pull/164/merge
   * environment.GITHUB_REF_NAME = 164/merge
   * environment.GITHUB_REF_PROTECTED = false
   * environment.GITHUB_RUN_ATTEMPT = 4
   * environment.GITHUB_RUN_ID = 16890482111
   * environment.GITHUB_RUN_NUMBER = 134
   * environment.GITHUB_SHA = bbeb890c69910ff180191bfb24dfc1a0f36f6d0e
   * environment.GITHUB_STATE = /home/runner/work/_temp/_runner_file_commands/save_state_ea5de4c1-f39c-409c-97d4-6249a970121a
   * environment.GITHUB_STEP_SUMMARY = /home/runner/work/_temp/_runner_file_commands/step_summary_ea5de4c1-f39c-409c-97d4-6249a970121a
   - environment.GITHUB_TOKEN
   * environment.GITHUB_WORKFLOW_REF = kodehort/scratch/.github/workflows/ci.yml@refs/pull/164/merge
   * environment.GITHUB_WORKFLOW_SHA = bbeb890c69910ff180191bfb24dfc1a0f36f6d0e
   * environment.GRADLE_HOME = /usr/share/gradle-9.0.0
   + environment.INPUT_OPERATION = diff
   + environment.INPUT_PREFIX = pr-
   + environment.INPUT_RUNNER = bun
   + environment.INPUT_STAGE = dev
   + environment.INPUT_TOKEN = ***
   * environment.INVOCATION_ID = 46bc408d840e4374bbcf693fb6dd6c9a
   * environment.ImageVersion = 20250804.2.0
   * environment.JOURNAL_STREAM = 9:12598
   + environment.NODE_ENV = production
   + environment.NODE_PATH =
   * environment.PULUMI_BACKEND_URL = file:///home/runner/work/scratch/scratch/.sst/pulumi/fe675bd3657c128c31550ec5
   + environment.PULUMI_NODEJS_DRY_RUN = true
   * environment.PULUMI_NODEJS_ENGINE = 127.0.0.1:39009
   * environment.PULUMI_NODEJS_MONITOR = 127.0.0.1:45135
   * environment.PULUMI_NODEJS_SYNC = /tmp/pulumi-node-pipes2858183656
   * environment.RUNNER_NAME = GitHub Actions 1000002487
   * environment.RUNNER_TRACKING_ID = github_b80c6824-a1c0-4c38-9d4b-796fbd89507e
   * environment.SHLVL = 0
   * environment.SST_AWS_ACCESS_KEY_ID = ***
   * environment.SST_AWS_SECRET_ACCESS_KEY = ***
   * environment.SST_AWS_SESSION_TOKEN = ***
   * environment.SYSTEMD_EXEC_PID = 1746
   * environment.TURBO_TEAM =
   + environment.TURBO_TELEMETRY_DISABLED = 1
   * environment.npm_config_user_agent = bun/1.2.20 npm/? node/v24.3.0 linux x64
   + environment["INPUT_COMMENT-MODE"] = on-success
   + environment["INPUT_FAIL-ON-ERROR"] = true
   + environment["INPUT_MAX-OUTPUT-SIZE"] = 50000
   + environment["INPUT_TRUNCATION-LENGTH"] = 26
   * triggers[0] = 1755101063020
```

</details>