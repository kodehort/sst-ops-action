/**
 * Test fixtures for SST diff operation parsing
 * Contains realistic SST diff CLI outputs based on real SST command output
 */

export const SST_DIFF_SUCCESS_OUTPUT = `
SST 3.17.4  ready!

➜  App:        my-sst-app
   Stage:      staging

~  Diff

|  Created     NewHandler sst:aws:Function
|  Created     Api sst:aws:Api
$ bunx vite build
vite v6.3.5 building for production...
✓ 150 modules transformed.
✓ built in 0.8s

↗  Permalink   https://console.sst.dev/my-sst-app/staging/diffs/abc123

✓  Generated

+  my-sst-app-staging pulumi:pulumi:Stack

+  NewHandler sst:aws:Function

*  Api sst:aws:Api

-  Website sst:aws:StaticSite

+  NewHandler sst:aws:Function → NewHandlerLogGroup aws:cloudwatch:LogGroup

+  Api sst:aws:Api → ApiFunction sst:aws:Function

-  Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket
`;

export const SST_DIFF_NO_CHANGES_OUTPUT = `
SST 3.17.4  ready!

➜  App:        my-sst-app
   Stage:      staging

~  Diff

|  No changes required

↗  Permalink   https://console.sst.dev/my-sst-app/staging/diffs/nochanges123

✓  Generated

No changes
`;

export const SST_DIFF_COMPLEX_OUTPUT = `
SST 3.17.4  ready!

➜  App:        my-complex-app
   Stage:      production

~  Diff

|  Created     NewAuth sst:aws:Function
|  Created     UsersDatabase sst:aws:Aurora
|  Updated     Api sst:aws:Api
$ bunx vite build
vite v6.3.5 building for production...
✓ 500 modules transformed.
✓ built in 2.1s

↗  Permalink   https://console.sst.dev/my-complex-app/production/diffs/xyz789

✓  Generated

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
`;

export const SST_DIFF_BREAKING_OUTPUT = `
SST 3.17.4  ready!

➜  App:        breaking-app
   Stage:      staging

~  Diff

|  Updated     Handler sst:aws:Function
|  Created     NewDatabase sst:aws:Aurora
$ bunx vite build
vite v6.3.5 building for production...
✓ 200 modules transformed.
✓ built in 1.2s

↗  Permalink   https://console.sst.dev/breaking-app/staging/diffs/break123

✓  Generated

+  breaking-app-staging pulumi:pulumi:Stack

*  Handler sst:aws:Function

-  LegacyDatabase sst:aws:Aurora

+  NewDatabase sst:aws:Aurora

*  Handler sst:aws:Function → HandlerFunction aws:lambda:Function

-  LegacyDatabase sst:aws:Aurora → LegacyDatabaseCluster aws:rds:Cluster

+  NewDatabase sst:aws:Aurora → NewDatabaseCluster aws:rds:Cluster
`;

export const SST_DIFF_COSMETIC_OUTPUT = `
SST 3.17.4  ready!

➜  App:        cosmetic-app
   Stage:      staging

~  Diff

|  Updated     Handler sst:aws:Function
|  Updated     Website sst:aws:StaticSite

↗  Permalink   https://console.sst.dev/cosmetic-app/staging/diffs/cosmetic123

✓  Generated

+  cosmetic-app-staging pulumi:pulumi:Stack

*  Handler sst:aws:Function

*  Website sst:aws:StaticSite

*  Handler sst:aws:Function → HandlerFunction aws:lambda:Function

*  Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket
`;

export const SST_DIFF_LARGE_OUTPUT = `
SST 3.17.4  ready!

➜  App:        large-app
   Stage:      production

~  Diff

|  Created     ManyFunctions sst:aws:Function
$ bunx vite build
vite v6.3.5 building for production...
✓ 1000 modules transformed.
✓ built in 5.2s

↗  Permalink   https://console.sst.dev/large-app/production/diffs/large123

✓  Generated

+  large-app-production pulumi:pulumi:Stack

${Array.from({ length: 25 }, (_, i) => `+  Function${i + 1} sst:aws:Function`).join('\n\n')}

${Array.from({ length: 15 }, (_, i) => `*  Api${i + 1} sst:aws:Api`).join('\n\n')}

${Array.from({ length: 10 }, (_, i) => `-  Website${i + 1} sst:aws:StaticSite`).join('\n\n')}
`;

export const SST_DIFF_MALFORMED_OUTPUT = `
SST 3.17.4  ready!

➜  App:        malformed-app
   Stage:      staging

~  Diff

Invalid diff format
Malformed resource line without proper prefix
Error parsing changes
`;

export const SST_DIFF_ERROR_OUTPUT = `
SST 3.17.4  ready!

➜  App:        error-app
   Stage:      staging

~  Diff

Error: Unable to generate diff
Permission denied: cannot read current infrastructure state
`;

export const SST_DIFF_EMPTY_OUTPUT = '';

export const SST_DIFF_INCOMPLETE_OUTPUT = `
SST 3.17.4  ready!

➜  App:        incomplete-app
   Stage:      staging

~  Diff

|  Created     NewHandler sst:aws:Function

↗  Permalink   https://console.sst.dev/incomplete-app/staging/diffs/incomplete123

✓  Generated

+  NewHandler sst:aws:Function
`;

// Output with mixed resource types and detailed change information
export const SST_DIFF_MIXED_RESOURCES_OUTPUT = `
SST 3.17.4  ready!

➜  App:        mixed-app
   Stage:      development

~  Diff

|  Created     AuthHandler sst:aws:Function
|  Created     UsersDatabase sst:aws:Aurora
|  Created     EventsTopic sst:aws:Topic
|  Created     JobsQueue sst:aws:Queue
|  Updated     Api sst:aws:Api
|  Updated     Website sst:aws:StaticSite
$ bunx vite build
vite v6.3.5 building for production...
✓ 750 modules transformed.
✓ built in 3.2s

↗  Permalink   https://console.sst.dev/mixed-app/development/diffs/mixed123

✓  Generated

+  mixed-app-development pulumi:pulumi:Stack

+  AuthHandler sst:aws:Function

+  UsersDatabase sst:aws:Aurora

+  EventsTopic sst:aws:Topic

+  JobsQueue sst:aws:Queue

*  Api sst:aws:Api

*  Website sst:aws:StaticSite

*  Processor sst:aws:Function

-  LegacyDatabase sst:aws:Aurora

-  OldAuth sst:aws:Function

-  DeprecatedEvents sst:aws:Topic

+  AuthHandler sst:aws:Function → AuthHandlerLogGroup aws:cloudwatch:LogGroup

+  UsersDatabase sst:aws:Aurora → UsersDatabaseCluster aws:rds:Cluster

+  EventsTopic sst:aws:Topic → EventsTopicTopic aws:sns:Topic

+  JobsQueue sst:aws:Queue → JobsQueueQueue aws:sqs:Queue

*  Api sst:aws:Api → ApiFunction sst:aws:Function

*  Website sst:aws:StaticSite → WebsiteAssets sst:aws:Bucket

*  Processor sst:aws:Function → ProcessorFunction aws:lambda:Function

-  LegacyDatabase sst:aws:Aurora → LegacyDatabaseCluster aws:rds:Cluster

-  OldAuth sst:aws:Function → OldAuthFunction aws:lambda:Function

-  DeprecatedEvents sst:aws:Topic → DeprecatedEventsTopicTopic aws:sns:Topic
`;

// Output with only additions
export const SST_DIFF_ONLY_ADDITIONS_OUTPUT = `
SST 3.17.4  ready!

➜  App:        new-features-app
   Stage:      staging

~  Diff

|  Created     FeatureA sst:aws:Function
|  Created     FeatureB sst:aws:Function
|  Created     NewApi sst:aws:Api
|  Created     LandingPage sst:aws:StaticSite
$ bunx vite build
vite v6.3.5 building for production...
✓ 300 modules transformed.
✓ built in 1.5s

↗  Permalink   https://console.sst.dev/new-features-app/staging/diffs/additions123

✓  Generated

+  new-features-app-staging pulumi:pulumi:Stack

+  FeatureA sst:aws:Function

+  FeatureB sst:aws:Function

+  NewApi sst:aws:Api

+  LandingPage sst:aws:StaticSite

+  FeatureA sst:aws:Function → FeatureALogGroup aws:cloudwatch:LogGroup

+  FeatureB sst:aws:Function → FeatureBLogGroup aws:cloudwatch:LogGroup

+  NewApi sst:aws:Api → NewApiFunction sst:aws:Function

+  LandingPage sst:aws:StaticSite → LandingPageAssets sst:aws:Bucket
`;

// Output with only deletions
export const SST_DIFF_ONLY_DELETIONS_OUTPUT = `
SST 3.17.4  ready!

➜  App:        cleanup-app
   Stage:      staging

~  Diff

↗  Permalink   https://console.sst.dev/cleanup-app/staging/diffs/deletions123

✓  Generated

+  cleanup-app-staging pulumi:pulumi:Stack

-  DeprecatedHandler sst:aws:Function

-  OldDatabase sst:aws:Aurora

-  UnusedEvents sst:aws:Topic

-  LegacySite sst:aws:StaticSite

-  DeprecatedHandler sst:aws:Function → DeprecatedHandlerLogGroup aws:cloudwatch:LogGroup

-  OldDatabase sst:aws:Aurora → OldDatabaseCluster aws:rds:Cluster

-  UnusedEvents sst:aws:Topic → UnusedEventsTopicTopic aws:sns:Topic

-  LegacySite sst:aws:StaticSite → LegacySiteAssets sst:aws:Bucket
`;

// Output with only updates
export const SST_DIFF_ONLY_UPDATES_OUTPUT = `
SST 3.17.4  ready!

➜  App:        updates-app
   Stage:      production

~  Diff

|  Updated     Handler sst:aws:Function
|  Updated     Api sst:aws:Api
|  Updated     Database sst:aws:Aurora

↗  Permalink   https://console.sst.dev/updates-app/production/diffs/updates123

✓  Generated

+  updates-app-production pulumi:pulumi:Stack

*  Handler sst:aws:Function

*  Api sst:aws:Api

*  Database sst:aws:Aurora

*  Handler sst:aws:Function → HandlerFunction aws:lambda:Function

*  Api sst:aws:Api → ApiFunction sst:aws:Function

*  Database sst:aws:Aurora → DatabaseCluster aws:rds:Cluster
`;

// Real world SST output format with environment variables and build output
export const SST_DIFF_REAL_WORLD_OUTPUT = `
SST 3.17.10  ready!

➜  App:        kodehort-scratch
   Stage:      dev

~  Diff

|  Info        Downloaded provider command-1.0.1
|  Info        Downloaded provider tls-5.0.1
|  Info        Downloaded provider docker-build-0.0.8
|  Info        Downloaded provider random-4.16.6
|  Info        Downloaded provider vercel-1.11.0
|  Info        Downloaded provider cloudflare-6.4.1
|  Info        Downloaded provider aws-6.66.2
$ bunx --bun astro build
|  Created     Web sst:aws:Astro → WebBuilder command:local:Command
16:04:25 [content] Syncing content
16:04:25 [content] Synced content
16:04:25 [types] Generated 309ms
16:04:25 [build] output: "static"
16:04:25 [build] mode: "static"
16:04:25 [build] directory: /home/runner/work/scratch/scratch/apps/www/dist/
16:04:25 [build] adapter: astro-sst
16:04:25 [build] Collecting build info...
16:04:25 [build] ✓ Completed in 336ms.
16:04:25 [build] Building static entrypoints...
16:04:26 [vite] ✓ built in 1.13s
16:04:26 [build] ✓ Completed in 1.25s.

 generating static routes
16:04:26 ▶ src/pages/index.astro
16:04:26   └─ /index.html (+9ms)
16:04:26 ✓ Completed in 52ms.

16:04:26 [build] 1 page(s) built in 1.66s
16:04:26 [build] Complete!
|  Deleted     Web sst:aws:Astro → WebBuilder command:local:Command

↗  Permalink   https://sst.dev/u/31550ec5

✓  Generated    
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
`;
