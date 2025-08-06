import { describe, expect, it } from 'vitest';
import { OutputFormatter } from '../../src/outputs/formatter';
import type { DeployResult, DiffResult, RemoveResult } from '../../src/types';

describe('OutputFormatter Integration', () => {
  describe('GitHub Actions workflow integration', () => {
    it('should produce consistent outputs for deploy workflow', () => {
      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'production',
        app: 'my-sst-app',
        rawOutput: 'Deploy completed successfully',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 5,
        urls: [
          { name: 'API', url: 'https://api.myapp.com', type: 'api' },
          { name: 'Web', url: 'https://myapp.com', type: 'web' },
        ],
        resources: [
          { type: 'Function', name: 'api-handler', status: 'created' },
          { type: 'Api', name: 'api-gateway', status: 'updated' },
        ],
        permalink:
          'https://console.sst.dev/my-sst-app/production/deployments/xyz789',
      };

      const outputs = OutputFormatter.formatForGitHubActions(deployResult);

      // Validate outputs are properly formatted
      OutputFormatter.validateOutputs(outputs);
      OutputFormatter.validateOperationConsistency(outputs, 'deploy');

      // Verify all required fields are strings
      expect(typeof outputs.success).toBe('string');
      expect(typeof outputs.operation).toBe('string');
      expect(typeof outputs.stage).toBe('string');
      expect(typeof outputs.completion_status).toBe('string');

      // Verify operation-specific fields
      expect(outputs.success).toBe('true');
      expect(outputs.operation).toBe('deploy');
      expect(outputs.stage).toBe('production');
      expect(outputs.completion_status).toBe('complete');
      expect(outputs.resource_changes).toBe('5');
      expect(JSON.parse(outputs.urls || '[]')).toHaveLength(2);
      expect(JSON.parse(outputs.resources || '[]')).toHaveLength(2);
    });

    it('should produce consistent outputs for diff workflow', () => {
      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'staging',
        app: 'my-sst-app',
        rawOutput: 'Diff analysis completed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 3,
        changeSummary: 'Found 3 planned infrastructure changes',
        changes: [
          { type: 'Function', name: 'handler', action: 'create', details: '' },
          {
            type: 'Database',
            name: 'main-db',
            action: 'update',
            details: 'schema change',
          },
          { type: 'Bucket', name: 'assets', action: 'delete', details: '' },
        ],
      };

      const outputs = OutputFormatter.formatForGitHubActions(diffResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);
      OutputFormatter.validateOperationConsistency(outputs, 'diff');

      // Verify diff-specific fields
      expect(outputs.operation).toBe('diff');
      expect(outputs.planned_changes).toBe('3');
      expect(outputs.diff_summary).toBe(
        'Found 3 planned infrastructure changes'
      );
      expect(outputs.resource_changes).toBe('3'); // Should match plannedChanges

      // Verify other operation fields are empty
      expect(outputs.urls).toBe('');
      expect(outputs.resources).toBe('');
      expect(outputs.resources_removed).toBe('');
      expect(outputs.removed_resources).toBe('');
    });

    it('should produce consistent outputs for remove workflow', () => {
      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'staging',
        app: 'my-sst-app',
        rawOutput: 'Resources removed successfully',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourcesRemoved: 7,
        removedResources: [
          { type: 'Function', name: 'api-handler', status: 'removed' },
          { type: 'Database', name: 'main-db', status: 'removed' },
          { type: 'Api', name: 'api-gateway', status: 'removed' },
        ],
      };

      const outputs = OutputFormatter.formatForGitHubActions(removeResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);
      OutputFormatter.validateOperationConsistency(outputs, 'remove');

      // Verify remove-specific fields
      expect(outputs.operation).toBe('remove');
      expect(outputs.resources_removed).toBe('7');
      expect(outputs.resource_changes).toBe('7'); // Should match resourcesRemoved
      expect(JSON.parse(outputs.removed_resources || '[]')).toHaveLength(3);

      // Verify other operation fields are empty
      expect(outputs.urls).toBe('');
      expect(outputs.resources).toBe('');
      expect(outputs.diff_summary).toBe('');
      expect(outputs.planned_changes).toBe('');
    });

    it('should handle failed operations consistently', () => {
      const failedResult: DeployResult = {
        success: false,
        operation: 'deploy',
        stage: 'production',
        app: 'my-sst-app',
        rawOutput: 'Deploy failed: insufficient permissions',
        exitCode: 1,
        truncated: false,
        completionStatus: 'failed',
        resourceChanges: 0,
        urls: [],
        resources: [],
        error:
          'AWS credentials do not have sufficient permissions to deploy to production',
      };

      const outputs = OutputFormatter.formatForGitHubActions(failedResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);

      // Verify failure handling
      expect(outputs.success).toBe('false');
      expect(outputs.completion_status).toBe('failed');
      expect(outputs.error).toBe(
        'AWS credentials do not have sufficient permissions to deploy to production'
      );
      expect(outputs.resource_changes).toBe('0');
    });

    it('should handle partial completion consistently', () => {
      const partialResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'staging',
        app: 'my-sst-app',
        rawOutput: 'Some resources could not be removed',
        exitCode: 0,
        truncated: false,
        completionStatus: 'partial',
        resourcesRemoved: 2,
        removedResources: [
          { type: 'Function', name: 'handler1', status: 'removed' },
          { type: 'Function', name: 'handler2', status: 'removed' },
          { type: 'Database', name: 'main-db', status: 'failed' },
        ],
      };

      const outputs = OutputFormatter.formatForGitHubActions(partialResult);

      // Validate outputs
      OutputFormatter.validateOutputs(outputs);

      // Verify partial completion handling
      expect(outputs.success).toBe('true');
      expect(outputs.completion_status).toBe('partial');
      expect(outputs.resources_removed).toBe('2');
      expect(JSON.parse(outputs.removed_resources || '[]')).toHaveLength(3); // All resources listed, including failed ones
    });

    it('should maintain consistency across all operation types', () => {
      const deployResult: DeployResult = {
        success: true,
        operation: 'deploy',
        stage: 'test',
        app: 'test-app',
        rawOutput: '',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourceChanges: 1,
        urls: [],
        resources: [],
      };

      const diffResult: DiffResult = {
        success: true,
        operation: 'diff',
        stage: 'test',
        app: 'test-app',
        rawOutput: '',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        plannedChanges: 1,
        changeSummary: '',
        changes: [],
      };

      const removeResult: RemoveResult = {
        success: true,
        operation: 'remove',
        stage: 'test',
        app: 'test-app',
        rawOutput: '',
        exitCode: 0,
        truncated: false,
        completionStatus: 'complete',
        resourcesRemoved: 1,
        removedResources: [],
      };

      const deployOutputs =
        OutputFormatter.formatForGitHubActions(deployResult);
      const diffOutputs = OutputFormatter.formatForGitHubActions(diffResult);
      const removeOutputs =
        OutputFormatter.formatForGitHubActions(removeResult);

      // All should have the same required fields
      const requiredFields = OutputFormatter.getRequiredFields();
      for (const field of requiredFields) {
        expect(deployOutputs).toHaveProperty(field);
        expect(diffOutputs).toHaveProperty(field);
        expect(removeOutputs).toHaveProperty(field);
      }

      // All should have the same total number of fields
      const allFields = OutputFormatter.getExpectedFields();
      expect(Object.keys(deployOutputs)).toHaveLength(allFields.length);
      expect(Object.keys(diffOutputs)).toHaveLength(allFields.length);
      expect(Object.keys(removeOutputs)).toHaveLength(allFields.length);

      // All should pass validation
      expect(() =>
        OutputFormatter.validateOutputs(deployOutputs)
      ).not.toThrow();
      expect(() => OutputFormatter.validateOutputs(diffOutputs)).not.toThrow();
      expect(() =>
        OutputFormatter.validateOutputs(removeOutputs)
      ).not.toThrow();
    });
  });
});
