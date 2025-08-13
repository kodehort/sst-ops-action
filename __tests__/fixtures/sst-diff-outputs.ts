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
