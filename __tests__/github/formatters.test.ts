import { beforeEach, describe, expect, it } from 'vitest';
import { OperationFormatter } from '../../src/github/formatters.js';
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
} from '../../src/types/index.js';
import {
  createMockDeployResource,
  createMockDeployResult,
  createMockDiffResult,
  createMockResourceBatch,
} from '../utils/test-types.js';

describe('OperationFormatter', () => {
  let formatter: OperationFormatter;

  beforeEach(() => {
    formatter = new OperationFormatter();
  });

  describe('formatOperationComment', () => {
    it('should format deploy comment correctly', () => {
      const deployResult = createMockDeployResult({
        stage: 'production',
        app: 'my-app',
        rawOutput: 'Deploy completed successfully',
        resourceChanges: 5,
        outputs: [
          { key: 'app', value: 'https://my-app.com' },
          { key: 'api', value: 'https://api.my-app.com' },
        ],
        resources: [
          createMockDeployResource({
            name: 'MyFunction',
            type: 'AWS::Lambda::Function',
            status: 'created',
          }),
          createMockDeployResource({
            name: 'MyTable',
            type: 'AWS::DynamoDB::Table',
            status: 'updated',
          }),
        ],
        permalink: 'https://console.sst.dev/my-app/production',
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain('🚀 DEPLOY SUCCESS');
      expect(comment).toContain('| Stage | `production` |');
      expect(comment).toContain('| App | `my-app` |');
      expect(comment).toContain('| Resource Changes | 5 |');
      expect(comment).toContain('📊 Resource Changes');
      expect(comment).toContain('**Total Changes:** 5');
      expect(comment).toContain('📋 Deploy Outputs');
      expect(comment).toContain(
        '| app | [https://my-app.com](https://my-app.com) |'
      );
      expect(comment).toContain(
        '| api | [https://api.my-app.com](https://api.my-app.com) |'
      );
      expect(comment).toContain('🖥️ SST Console');
      expect(comment).toContain('https://console.sst.dev/my-app/production');
    });

    it('should format failed deploy comment correctly', () => {
      const failedDeployResult: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy failed',
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        resourceChanges: 0,
        outputs: [],
        resources: [],
        error: 'Deployment failed due to insufficient permissions',
      };

      const comment = formatter.formatOperationComment(failedDeployResult);

      expect(comment).toContain('❌ DEPLOY FAILED');
      expect(comment).toContain('| Stage | `staging` |');
    });

    it('should format diff comment correctly', () => {
      const diffResult = createMockDiffResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Diff completed',
        plannedChanges: 6,
        changeSummary: 'Plan: 3 to add, 2 to change, 1 to destroy',
        changes: [
          { type: 'Lambda', name: 'Function1', action: 'create' },
          { type: 'S3', name: 'Bucket1', action: 'update' },
          { type: 'DynamoDB', name: 'Table1', action: 'delete' },
        ],
      }) as DiffResult;

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain('🔍 DIFF SUCCESS');
      expect(comment).toContain('🔍 Infrastructure Changes Preview');
      expect(comment).toContain('Plan: 3 to add, 2 to change, 1 to destroy');
    });

    it('should format diff comment with no changes', () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'No changes',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 0,
        changeSummary: '',
        changes: [],
      };

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain('✅ No Changes');
      expect(comment).toContain('No infrastructure changes detected');
    });

    it('should format real-world diff with environment variables', () => {
      const realWorldOutput = `
SST 3.17.10  ready!

➜  App:        kodehort-scratch
   Stage:      dev

~  Diff

|  Info        Downloaded provider aws-6.66.2
$ bunx --bun astro build

↗  Permalink   https://sst.dev/u/31550ec5

✓  Generated    
   Router: https://dev.kodeapps.co.uk
   Web: https://dev.kodeapps.co.uk
   Api: https://api.dev.kodeapps.co.uk
   ---
   github_role_arn: arn:aws:iam::194218796960:role/dev-GithubActionRole

+  Web sst:aws:Astro → WebBuilder command:local:Command
   + environment.ACTIONS_CACHE_SERVICE_V2 = True
   + environment.INPUT_OPERATION = diff
   + environment.INPUT_STAGE = dev
   * environment.GITHUB_ACTION = diff
   * environment.GITHUB_SHA = bbeb890c69910ff180191bfb
   - environment.GITHUB_TOKEN
`;

      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'dev',
        app: 'kodehort-scratch',
        rawOutput: realWorldOutput,
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 1,
        changeSummary: '1 changes planned',
        changes: [{ type: 'Astro', name: 'Web', action: 'create' }],
      };

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain('🔍 DIFF SUCCESS');
      expect(comment).toContain('1 changes planned');
      // Should contain the actual diff block with environment variables
      expect(comment).toContain('```diff');
      expect(comment).toContain(
        '+  Web sst:aws:Astro → WebBuilder command:local:Command'
      );
      expect(comment).toContain(
        '+ environment.ACTIONS_CACHE_SERVICE_V2 = True'
      );
      expect(comment).toContain('* environment.GITHUB_ACTION = diff');
      expect(comment).toContain('- environment.GITHUB_TOKEN');
    });

    it('should format remove comment correctly', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'pr-123',
        app: 'my-app',
        rawOutput: 'Resources removed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourcesRemoved: 8,
        removedResources: [],
      };

      const comment = formatter.formatOperationComment(removeResult);

      expect(comment).toContain('🗑️ REMOVE SUCCESS');
      expect(comment).toContain('🗑️ Resource Cleanup');
      expect(comment).toContain('Resources cleaned up: 8');
      expect(comment).toContain('All resources successfully removed');
    });

    it('should format partial remove comment correctly', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'pr-123',
        app: 'my-app',
        rawOutput: 'Partial cleanup',
        exitCode: 0,
        truncated: false,
        completionStatus: 'partial',
        resourcesRemoved: 5,
        removedResources: [
          { type: 'Lambda', name: 'Function1', status: 'removed' },
          { type: 'S3', name: 'Bucket1', status: 'failed' },
        ],
      };

      const comment = formatter.formatOperationComment(removeResult);

      expect(comment).toContain('⚠️ **Partial cleanup completed**');
      expect(comment).toContain('Some resources may still exist');
      expect(comment).toContain('Check logs for details');
    });

    it('should format generic comment for unknown operations', () => {
      const genericResult = {
        success: true,
        operation: 'unknown' as any,
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Operation completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete' as const,
      };

      const comment = formatter.formatOperationComment(genericResult);

      expect(comment).toContain('✅ UNKNOWN SUCCESS');
      expect(comment).toContain('**Stage:** `staging`');
    });
  });

  describe('formatOperationSummary', () => {
    it('should format deploy summary correctly', () => {
      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'production',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 7,
        outputs: [
          { key: 'app', value: 'https://my-app.com' },
          { key: 'api', value: 'https://api.my-app.com' },
        ],
        resources: [],
      };

      const summary = formatter.formatOperationSummary(deployResult);

      expect(summary).toContain('📦 Deployment Summary');
      expect(summary).toContain('Resources Changed | 7');
      expect(summary).toContain('Outputs | 2');
      expect(summary).toContain('📋 Deploy Outputs');
      expect(summary).toContain(
        '| app | [https://my-app.com](https://my-app.com) |'
      );
      expect(summary).toContain(
        '| api | [https://api.my-app.com](https://api.my-app.com) |'
      );
    });

    it('should format deploy summary with many outputs', () => {
      const outputs = Array.from({ length: 15 }, (_, i) => ({
        key: `Service${i}`,
        value: `https://service${i}.example.com`,
      }));

      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 15,
        outputs,
        resources: [],
      };

      const summary = formatter.formatOperationSummary(deployResult);

      expect(summary).toContain('Outputs | 15');
      expect(summary).toContain('... and 5 more outputs');
    });

    it('should format diff summary correctly', () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Diff completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 6,
        changeSummary: '3 resources to create, 2 to update, 1 to destroy',
        changes: [
          { type: 'Lambda', name: 'Function1', action: 'create' },
          { type: 'S3', name: 'Bucket1', action: 'update' },
          { type: 'DynamoDB', name: 'Table1', action: 'delete' },
        ],
      };

      const summary = formatter.formatOperationSummary(diffResult);

      expect(summary).toContain('🔍 Infrastructure Diff Summary');
      expect(summary).toContain('Total Changes | 6');
      expect(summary).toContain('📋 View Resource Changes');
      expect(summary).toContain('```diff');
      expect(summary).toContain('+ Function1 (Lambda)');
      expect(summary).toContain('* Bucket1 (S3)');
      expect(summary).toContain('- Table1 (DynamoDB)');
    });

    it('should format diff summary with no changes', () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'No changes',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 0,
        changeSummary: '',
        changes: [],
      };

      const summary = formatter.formatOperationSummary(diffResult);

      expect(summary).toContain('Total Changes | 0');
      expect(summary).toContain('✅ No Changes');
      expect(summary).toContain('No infrastructure changes detected');
    });

    it('should format remove summary correctly', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'pr-123',
        app: 'my-app',
        rawOutput: 'Cleanup completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourcesRemoved: 10,
        removedResources: [
          { type: 'Lambda', name: 'Function1', status: 'removed' },
          { type: 'S3', name: 'Bucket1', status: 'removed' },
        ],
      };

      const summary = formatter.formatOperationSummary(removeResult);

      expect(summary).toContain('🗑️ Cleanup Summary');
      expect(summary).toContain('Resources Removed | 10');
      expect(summary).toContain('Cleanup Status | complete');
      expect(summary).toContain('✅ Complete Cleanup');
      expect(summary).toContain('All resources have been successfully removed');
    });

    it('should format partial remove summary correctly', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'pr-123',
        app: 'my-app',
        rawOutput: 'Partial cleanup',
        exitCode: 0,
        truncated: false,
        completionStatus: 'partial',
        resourcesRemoved: 5,
        removedResources: [
          { type: 'Lambda', name: 'Function1', status: 'removed' },
          { type: 'S3', name: 'Bucket1', status: 'failed' },
        ],
      };

      const summary = formatter.formatOperationSummary(removeResult);

      expect(summary).toContain('⚠️ Partial Cleanup');
      expect(summary).toContain('Some resources could not be removed');
    });

    it('should include status badges', () => {
      const successResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Success',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 1,
        outputs: [],
        resources: [],
      };

      const failResult: DeployResult = {
        ...successResult,
        success: false,
        exitCode: 1,
        completionStatus: 'failed',
      };

      const successSummary = formatter.formatOperationSummary(successResult);
      const failSummary = formatter.formatOperationSummary(failResult);

      expect(successSummary).toContain(
        '![Success](https://img.shields.io/badge/Status-Success-green)'
      );
      expect(failSummary).toContain(
        '![Failed](https://img.shields.io/badge/Status-Failed-red)'
      );
    });
  });

  describe('resource formatting', () => {
    it('should format resource actions with appropriate icons', () => {
      const deployResult = createMockDeployResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        resourceChanges: 5,
        resources: [
          createMockDeployResource({
            name: 'Function1',
            type: 'AWS::Lambda::Function',
            status: 'created',
          }),
          createMockDeployResource({
            name: 'Function2',
            type: 'AWS::Lambda::Function',
            status: 'updated',
          }),
          createMockDeployResource({
            name: 'Table1',
            type: 'AWS::DynamoDB::Table',
            status: 'updated',
          }),
          createMockDeployResource({
            name: 'Bucket1',
            type: 'AWS::S3::Bucket',
            status: 'updated',
          }),
          createMockDeployResource({
            name: 'OldFunction',
            type: 'AWS::Lambda::Function',
            status: 'updated',
          }),
        ],
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain('🆕 Created');
      expect(comment).toContain('📝 Updated');
    });

    it('should limit displayed resources', () => {
      const deployResult = createMockDeployResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        resourceChanges: 25,
        resources: createMockResourceBatch(25, {
          type: 'AWS::Lambda::Function',
          status: 'created',
        }),
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain('... and 5 more resources');
    });
  });

  describe('custom configuration', () => {
    it('should respect custom maxUrlsToShow configuration', () => {
      const customFormatter = new OperationFormatter({
        includeTimestamp: true,
        includeDuration: true,
        includeDebugInfo: false,
        maxUrlsToShow: 3,
        maxResourcesToShow: 20,
      });

      const deployResult = createMockDeployResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        resourceChanges: 7,
        outputs: Array.from({ length: 7 }, (_, i) => ({
          key: `service${i}`,
          value: `https://service${i}.example.com`,
        })),
      }) as DeployResult;

      const comment = customFormatter.formatOperationComment(deployResult);

      expect(comment).toContain('... and 4 more outputs');
    });

    it('should respect custom maxResourcesToShow configuration', () => {
      const customFormatter = new OperationFormatter({
        includeTimestamp: true,
        includeDuration: true,
        includeDebugInfo: false,
        maxUrlsToShow: 10,
        maxResourcesToShow: 5,
      });

      const deployResult = createMockDeployResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        resourceChanges: 12,
        outputs: [],
        resources: createMockResourceBatch(12, {
          type: 'AWS::Lambda::Function',
          status: 'created',
        }),
      }) as DeployResult;

      const comment = customFormatter.formatOperationComment(deployResult);

      expect(comment).toContain('... and 7 more resources');
    });
  });

  describe('edge cases', () => {
    describe('URL detection with short strings', () => {
      it('should handle very short strings without errors', () => {
        const deployResult = createMockDeployResult({
          stage: 'test',
          app: 'test-app',
          outputs: [
            { key: 'short', value: 'a' },
            { key: 'empty', value: '' },
            { key: 'six', value: 'sixchr' },
            { key: 'seven', value: 'seven!!' },
            { key: 'valid_url', value: 'https://example.com' },
            { key: 'invalid_url', value: 'not-a-url' },
          ],
        }) as DeployResult;

        const comment = formatter.formatOperationComment(deployResult);

        // Should contain the short values as code blocks (non-URL format)
        expect(comment).toContain('`a`');
        expect(comment).toContain('`sixchr`');
        expect(comment).toContain('`seven!!`');

        // Should format the valid URL as a clickable link
        expect(comment).toContain('[https://example.com](https://example.com)');

        // Should format invalid URL as code block
        expect(comment).toContain('`not-a-url`');
      });

      it('should properly detect edge case URLs', () => {
        const deployResult = createMockDeployResult({
          stage: 'test',
          app: 'test-app',
          outputs: [
            { key: 'http_min', value: 'http://' }, // Exactly 7 characters
            { key: 'https_min', value: 'https://' }, // Exactly 8 characters
            { key: 'http_url', value: 'http://example.com' },
            { key: 'https_url', value: 'https://example.com' },
          ],
        }) as DeployResult;

        const comment = formatter.formatOperationComment(deployResult);

        // These should be treated as URLs (even if minimal)
        expect(comment).toContain('[http://](http://)');
        expect(comment).toContain('[https://](https://)');
        expect(comment).toContain('[http://example.com](http://example.com)');
        expect(comment).toContain('[https://example.com](https://example.com)');
      });
    });

    describe('workflow summaries with edge cases', () => {
      it('should handle short strings in workflow summaries', () => {
        const deployResult = createMockDeployResult({
          stage: 'test',
          app: 'test-app',
          outputs: [
            { key: 'short', value: 'ab' },
            { key: 'url', value: 'https://api.test.com' },
          ],
        }) as DeployResult;

        const summary = formatter.formatOperationSummary(deployResult);

        expect(summary).toContain('`ab`');
        expect(summary).toContain(
          '[https://api.test.com](https://api.test.com)'
        );
      });
    });
  });
});
