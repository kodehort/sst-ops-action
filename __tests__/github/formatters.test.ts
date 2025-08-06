import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFormatter,
  formatters,
  type OperationFormatter,
} from '../../src/github/formatters.js';
import type {
  DeployResult,
  DiffResult,
  RemoveResult,
  SSTUrl,
} from '../../src/types/index.js';
import {
  createMockDeployResource,
  createMockDeployResult,
  createMockDiffChange,
  createMockDiffResult,
  createMockResourceBatch,
  createMockSSTUrl,
  createMockUrlBatch,
} from '../utils/test-types.js';

describe('OperationFormatter', () => {
  let formatter: OperationFormatter;

  beforeEach(() => {
    formatter = createFormatter();
  });

  describe('formatOperationComment', () => {
    it('should format deploy comment correctly', () => {
      const deployResult = createMockDeployResult({
        stage: 'production',
        app: 'my-app',
        rawOutput: 'Deploy completed successfully',
        resourceChanges: 5,
        urls: [
          createMockSSTUrl({
            name: 'app',
            type: 'web',
            url: 'https://my-app.com',
          }),
          createMockSSTUrl({
            name: 'api',
            type: 'api',
            url: 'https://api.my-app.com',
          }),
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
      expect(comment).toContain('**Stage:** `production`');
      expect(comment).toContain('**App:** `my-app`');
      expect(comment).toContain('**Status:** `complete`');
      expect(comment).toContain('📊 Resource Changes');
      expect(comment).toContain('**Total Changes:** 5');
      expect(comment).toContain('🔗 Deployed URLs');
      expect(comment).toContain('https://my-app.com');
      expect(comment).toContain('https://api.my-app.com');
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
        urls: [],
        resources: [],
        error: 'Deployment failed due to insufficient permissions',
      };

      const comment = formatter.formatOperationComment(failedDeployResult);

      expect(comment).toContain('❌ DEPLOY FAILED');
      expect(comment).toContain('**Status:** `failed`');
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

      expect(comment).toContain('No changes detected');
      expect(comment).toContain('Your infrastructure is up to date');
    });

    it('should format diff comment with breaking changes warning', () => {
      const diffResult = createMockDiffResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Diff with breaking changes',
        plannedChanges: 2,
        changeSummary: 'Plan: 1 to add, 1 to destroy (force-new-resource)',
        changes: [
          createMockDiffChange({
            type: 'Lambda',
            name: 'Function1',
            action: 'create',
          }),
          createMockDiffChange({
            type: 'S3',
            name: 'Bucket1',
            action: 'delete',
          }),
        ],
      }) as DiffResult;

      const comment = formatter.formatOperationComment(diffResult);

      expect(comment).toContain(
        '⚠️ **Warning**: This diff may contain breaking changes'
      );
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
        urls: [
          { name: 'app', type: 'web', url: 'https://my-app.com' },
          { name: 'api', type: 'api', url: 'https://api.my-app.com' },
        ],
        resources: [],
      };

      const summary = formatter.formatOperationSummary(deployResult);

      expect(summary).toContain('📦 Deployment Summary');
      expect(summary).toContain('Resources Changed | 7');
      expect(summary).toContain('URLs Deployed | 2');
      expect(summary).toContain('🔗 Deployed URLs');
      expect(summary).toContain(
        '**Web**: [https://my-app.com](https://my-app.com)'
      );
      expect(summary).toContain(
        '**API**: [https://api.my-app.com](https://api.my-app.com)'
      );
    });

    it('should format deploy summary with many URLs', () => {
      const urls: SSTUrl[] = Array.from({ length: 15 }, (_, i) => ({
        name: `Service${i}`,
        type: 'api' as const,
        url: `https://service${i}.example.com`,
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
        urls,
        resources: [],
      };

      const summary = formatter.formatOperationSummary(deployResult);

      expect(summary).toContain('URLs Deployed | 15');
      expect(summary).toContain('... and 5 more URLs');
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

      expect(summary).toContain('🔍 Infrastructure Preview');
      expect(summary).toContain('Changes Detected | Yes');
      expect(summary).toContain('📋 Changes Summary');
      expect(summary).toContain(
        '3 resources to create, 2 to update, 1 to destroy'
      );
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

      expect(summary).toContain('Changes Detected | No');
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
        urls: [],
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
        resourceChanges: 4,
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
            status: 'unchanged',
          }),
        ],
      }) as DeployResult;

      const comment = formatter.formatOperationComment(deployResult);

      expect(comment).toContain('🆕 Created');
      expect(comment).toContain('📝 Updated');
      expect(comment).toContain('🗑️ Deleted');
      expect(comment).toContain('➖ Unchanged');
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
      const customFormatter = createFormatter({ maxUrlsToShow: 3 });

      const deployResult = createMockDeployResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        resourceChanges: 7,
        urls: createMockUrlBatch(7),
      }) as DeployResult;

      const comment = customFormatter.formatOperationComment(deployResult);

      expect(comment).toContain('... and 4 more URLs');
    });

    it('should respect custom maxResourcesToShow configuration', () => {
      const customFormatter = createFormatter({ maxResourcesToShow: 5 });

      const deployResult = createMockDeployResult({
        stage: 'staging',
        app: 'my-app',
        rawOutput: 'Deploy completed',
        resourceChanges: 12,
        urls: [],
        resources: createMockResourceBatch(12, {
          type: 'AWS::Lambda::Function',
          status: 'created',
        }),
      }) as DeployResult;

      const comment = customFormatter.formatOperationComment(deployResult);

      expect(comment).toContain('... and 7 more resources');
    });
  });
});

describe('formatters utility functions', () => {
  describe('formatStatus', () => {
    it('should format success status correctly', () => {
      const result = formatters.formatStatus(true, 'deploy');
      expect(result).toBe('✅ DEPLOY SUCCESS');
    });

    it('should format failure status correctly', () => {
      const result = formatters.formatStatus(false, 'remove');
      expect(result).toBe('❌ REMOVE FAILED');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatters.formatDuration(500)).toBe('500ms');
    });

    it('should format seconds correctly', () => {
      expect(formatters.formatDuration(2500)).toBe('2.5s');
    });

    it('should format minutes correctly', () => {
      expect(formatters.formatDuration(90_000)).toBe('1.5m');
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(formatters.formatSize(500)).toBe('500.0B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatters.formatSize(1536)).toBe('1.5KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatters.formatSize(2_097_152)).toBe('2.0MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatters.formatSize(3_221_225_472)).toBe('3.0GB');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp in ISO format', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = formatters.formatTimestamp(date);
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should use current date when no date provided', () => {
      const result = formatters.formatTimestamp();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
