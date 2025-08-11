import { describe, expect, it } from 'vitest';
import { OutputFormatter } from '../../src/outputs/formatter';
import type {
  DeployResult,
  DiffResult,
  OperationResult,
  RemoveResult,
  StageResult,
} from '../../src/types';

describe('Output Formatter - GitHub Actions Output Processing', () => {
  describe('formatOperationForGitHubActions', () => {
    describe('deploy operations', () => {
      it('should format successful deploy result correctly', () => {
        const deployResult: DeployResult = {
          success: true,
          operation: 'deploy',
          stage: 'staging',
          app: 'test-app',
          rawOutput: 'Deploy completed successfully',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          resourceChanges: 3,
          urls: [
            { name: 'API', url: 'https://api.example.com', type: 'api' },
            { name: 'Web', url: 'https://web.example.com', type: 'web' },
          ],
          resources: [
            { type: 'Function', name: 'MyFunction', status: 'created' },
            { type: 'Api', name: 'MyApi', status: 'updated' },
          ],
          permalink:
            'https://console.sst.dev/test-app/staging/deployments/abc123',
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(deployResult);

        expect(outputs).toEqual({
          success: 'true',
          operation: 'deploy',
          stage: 'staging',
          completion_status: 'complete',
          app: 'test-app',
          permalink:
            'https://console.sst.dev/test-app/staging/deployments/abc123',
          truncated: 'false',
          resource_changes: '3',
          error: '',
          urls: JSON.stringify(deployResult.urls),
          resources: JSON.stringify(deployResult.resources),
          diff_summary: '',
          planned_changes: '',
          resources_removed: '',
          removed_resources: '',
          computed_stage: '',
          ref: '',
          event_name: '',
          is_pull_request: '',
        });
      });

      it('should handle deploy result with missing optional fields', () => {
        const deployResult: DeployResult = {
          success: false,
          operation: 'deploy',
          stage: 'production',
          app: 'test-app',
          rawOutput: 'Deploy failed',
          exitCode: 1,
          truncated: false,
          completionStatus: 'failed',
          resourceChanges: 0,
          urls: [],
          resources: [],
          error: 'Deployment failed due to timeout',
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(deployResult);

        expect(outputs.success).toBe('false');
        expect(outputs.operation).toBe('deploy');
        expect(outputs.stage).toBe('production');
        expect(outputs.completion_status).toBe('failed');
        expect(outputs.resource_changes).toBe('0');
        expect(outputs.urls).toBe('[]');
        expect(outputs.resources).toBe('[]');
        expect(outputs.error).toBe('Deployment failed due to timeout');
        expect(outputs.permalink).toBe('');
      });
    });

    describe('diff operations', () => {
      it('should format successful diff result correctly', () => {
        const diffResult: DiffResult = {
          success: true,
          operation: 'diff',
          stage: 'staging',
          app: 'test-app',
          rawOutput: 'Diff completed',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          plannedChanges: 2,
          changeSummary: 'Found 2 planned changes: 1 creation, 1 update',
          changes: [
            {
              type: 'Function',
              name: 'MyFunction',
              action: 'create',
              details: '',
            },
            {
              type: 'Api',
              name: 'MyApi',
              action: 'update',
              details: 'config updated',
            },
          ],
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(diffResult);

        expect(outputs).toEqual({
          success: 'true',
          operation: 'diff',
          stage: 'staging',
          completion_status: 'complete',
          app: 'test-app',
          permalink: '',
          truncated: 'false',
          resource_changes: '2',
          error: '',
          urls: '',
          resources: '',
          diff_summary: 'Found 2 planned changes: 1 creation, 1 update',
          planned_changes: '2',
          resources_removed: '',
          removed_resources: '',
          computed_stage: '',
          ref: '',
          event_name: '',
          is_pull_request: '',
        });
      });

      it('should handle diff result with no changes', () => {
        const diffResult: DiffResult = {
          success: true,
          operation: 'diff',
          stage: 'production',
          app: 'test-app',
          rawOutput: 'No changes detected',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          plannedChanges: 0,
          changeSummary: 'No changes detected',
          changes: [],
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(diffResult);

        expect(outputs.success).toBe('true');
        expect(outputs.operation).toBe('diff');
        expect(outputs.resource_changes).toBe('0');
        expect(outputs.planned_changes).toBe('0');
        expect(outputs.diff_summary).toBe('No changes detected');
      });
    });

    describe('remove operations', () => {
      it('should format successful remove result correctly', () => {
        const removeResult: RemoveResult = {
          success: true,
          operation: 'remove',
          stage: 'staging',
          app: 'test-app',
          rawOutput: 'Remove completed',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          resourcesRemoved: 2,
          removedResources: [
            { type: 'Function', name: 'MyFunction', status: 'removed' },
            { type: 'Api', name: 'MyApi', status: 'removed' },
          ],
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(removeResult);

        expect(outputs).toEqual({
          success: 'true',
          operation: 'remove',
          stage: 'staging',
          completion_status: 'complete',
          app: 'test-app',
          permalink: '',
          truncated: 'false',
          resource_changes: '2',
          error: '',
          urls: '',
          resources: '',
          diff_summary: '',
          planned_changes: '',
          resources_removed: '2',
          removed_resources: JSON.stringify(removeResult.removedResources),
          computed_stage: '',
          ref: '',
          event_name: '',
          is_pull_request: '',
        });
      });

      it('should handle remove result with partial failure', () => {
        const removeResult: RemoveResult = {
          success: true,
          operation: 'remove',
          stage: 'staging',
          app: 'test-app',
          rawOutput: 'Remove partially completed',
          exitCode: 0,
          truncated: false,
          completionStatus: 'partial',
          resourcesRemoved: 1,
          removedResources: [
            { type: 'Function', name: 'MyFunction', status: 'removed' },
            { type: 'Api', name: 'MyApi', status: 'failed' },
          ],
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(removeResult);

        expect(outputs.success).toBe('true');
        expect(outputs.completion_status).toBe('partial');
        expect(outputs.resource_changes).toBe('1');
        expect(outputs.resources_removed).toBe('1');
        expect(outputs.removed_resources).toBe(
          JSON.stringify(removeResult.removedResources)
        );
      });
    });

    describe('stage operations', () => {
      it('should format successful stage result correctly', () => {
        const stageResult: StageResult = {
          success: true,
          operation: 'stage',
          stage: 'feature-branch',
          app: 'stage-calculator',
          rawOutput:
            'Stage computation successful\nEvent: pull_request\nRef: feature/branch\nComputed Stage: feature-branch',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          computedStage: 'feature-branch',
          ref: 'feature/branch',
          eventName: 'pull_request',
          isPullRequest: true,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(stageResult);

        expect(outputs).toEqual({
          success: 'true',
          operation: 'stage',
          stage: 'feature-branch',
          completion_status: 'complete',
          app: '',
          permalink: '',
          truncated: 'false',
          resource_changes: '',
          error: '',
          urls: '',
          resources: '',
          diff_summary: '',
          planned_changes: '',
          resources_removed: '',
          removed_resources: '',
          computed_stage: 'feature-branch',
          ref: 'feature/branch',
          event_name: 'pull_request',
          is_pull_request: 'true',
        });
      });

      it('should format stage result for push event', () => {
        const stageResult: StageResult = {
          success: true,
          operation: 'stage',
          stage: 'main',
          app: 'stage-calculator',
          rawOutput: 'Stage computation successful',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          computedStage: 'main',
          ref: 'refs/heads/main',
          eventName: 'push',
          isPullRequest: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(stageResult);

        expect(outputs.computed_stage).toBe('main');
        expect(outputs.ref).toBe('refs/heads/main');
        expect(outputs.event_name).toBe('push');
        expect(outputs.is_pull_request).toBe('false');
      });

      it('should handle stage result with missing optional fields', () => {
        const stageResult: StageResult = {
          success: false,
          operation: 'stage',
          stage: 'fallback',
          app: 'stage-calculator',
          rawOutput: 'Stage computation failed',
          exitCode: 1,
          truncated: false,
          error: 'Failed to compute stage from ref',
          completionStatus: 'failed',
          computedStage: 'fallback',
          ref: '',
          eventName: 'push',
          isPullRequest: false,
        };

        const outputs =
          OutputFormatter.formatOperationForGitHubActions(stageResult);

        expect(outputs.success).toBe('false');
        expect(outputs.error).toBe('Failed to compute stage from ref');
        expect(outputs.computed_stage).toBe('fallback');
        expect(outputs.ref).toBe('');
        expect(outputs.is_pull_request).toBe('false');
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle null and undefined values gracefully', () => {
        const result: OperationResult = {
          success: true,
          operation: 'deploy',
          stage: 'staging',
          app: '',
          rawOutput: '',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          resourceChanges: 0,
          urls: [],
          resources: [],
        };

        const outputs = OutputFormatter.formatOperationForGitHubActions(result);

        expect(outputs.app).toBe('');
        expect(outputs.permalink).toBe('');
        expect(outputs.error).toBe('');
        expect(outputs.urls).toBe('[]');
        expect(outputs.resources).toBe('[]');
      });

      it('should handle JSON serialization errors gracefully', () => {
        const result: DeployResult = {
          success: true,
          operation: 'deploy',
          stage: 'staging',
          app: 'test-app',
          rawOutput: 'Deploy completed',
          exitCode: 0,
          truncated: false,
          completionStatus: 'complete',
          resourceChanges: 1,
          urls: [],
          resources: [],
        };

        // Create a circular reference that would cause JSON.stringify to fail
        const circularObj: any = { name: 'test' };
        circularObj.self = circularObj;
        result.urls = [circularObj];

        const outputs = OutputFormatter.formatOperationForGitHubActions(result);

        // Should handle the error gracefully by returning empty string
        expect(outputs.urls).toBe('');
      });

      it('should convert all values to strings', () => {
        const result: DiffResult = {
          success: true,
          operation: 'diff',
          stage: 'staging',
          app: 'test-app',
          rawOutput: 'Diff completed',
          exitCode: 0,
          truncated: true,
          completionStatus: 'complete',
          plannedChanges: 5,
          changeSummary: 'Found changes',
          changes: [],
        };

        const outputs = OutputFormatter.formatOperationForGitHubActions(result);

        // All outputs should be strings
        for (const [_key, value] of Object.entries(outputs)) {
          expect(typeof value).toBe('string');
        }
      });
    });
  });

  describe('validateOutputs', () => {
    it('should pass validation for valid outputs', () => {
      const validOutputs = {
        success: 'true',
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'complete',
        app: 'test-app',
        permalink: '',
        truncated: 'false',
        resource_changes: '3',
        error: '',
        urls: '[]',
        resources: '[]',
        diff_summary: '',
        planned_changes: '',
        resources_removed: '',
        removed_resources: '',
      };

      expect(() => {
        OutputFormatter.validateOutputs(validOutputs);
      }).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidOutputs = {
        success: 'true',
        operation: 'deploy',
        // missing stage and completion_status
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow('Required output fields missing: stage, completion_status');
    });

    it('should validate boolean field values', () => {
      const invalidOutputs = {
        success: 'invalid', // Should be 'true' or 'false'
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'complete',
        truncated: 'false',
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(
        "Invalid 'success' value: 'invalid'. Must be 'true' or 'false'."
      );
    });

    it('should validate operation field values', () => {
      const invalidOutputs = {
        success: 'true',
        operation: 'invalid-operation',
        stage: 'staging',
        completion_status: 'complete',
        truncated: 'false',
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(
        "Invalid 'operation' value: 'invalid-operation'. Must be one of: deploy, diff, remove, stage."
      );
    });

    it('should validate completion_status field values', () => {
      const invalidOutputs = {
        success: 'true',
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'invalid-status',
        truncated: 'false',
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(
        "Invalid 'completion_status' value: 'invalid-status'. Must be one of: complete, partial, failed."
      );
    });

    it('should validate numeric field values', () => {
      const invalidOutputs = {
        success: 'true',
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'complete',
        truncated: 'false',
        resource_changes: 'not-a-number',
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(
        "Invalid 'resource_changes' value: 'not-a-number'. Must be a non-negative number."
      );
    });

    it('should validate negative numbers are not allowed', () => {
      const invalidOutputs = {
        success: 'true',
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'complete',
        truncated: 'false',
        resource_changes: '-5',
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow(
        "Invalid 'resource_changes' value: '-5'. Must be a non-negative number."
      );
    });

    it('should validate JSON field values', () => {
      const invalidOutputs = {
        success: 'true',
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'complete',
        truncated: 'false',
        urls: 'invalid-json',
      };

      expect(() => {
        OutputFormatter.validateOutputs(invalidOutputs);
      }).toThrow("Invalid 'urls' value: not valid JSON.");
    });

    it('should allow empty strings for optional fields', () => {
      const validOutputs = {
        success: 'true',
        operation: 'deploy',
        stage: 'staging',
        completion_status: 'complete',
        truncated: 'false',
        app: '',
        permalink: '',
        error: '',
        resource_changes: '',
        urls: '',
        resources: '',
      };

      expect(() => {
        OutputFormatter.validateOutputs(validOutputs);
      }).not.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should return expected field names', () => {
      const fields = OutputFormatter.getExpectedFields();

      expect(fields).toContain('success');
      expect(fields).toContain('operation');
      expect(fields).toContain('stage');
      expect(fields).toContain('completion_status');
      expect(fields).toContain('urls');
      expect(fields).toContain('diff_summary');
      expect(fields).toContain('resources_removed');
      expect(fields.length).toBe(19);
    });

    it('should return required field names', () => {
      const requiredFields = OutputFormatter.getRequiredFields();

      expect(requiredFields).toEqual([
        'success',
        'operation',
        'stage',
        'completion_status',
      ]);
    });

    describe('validateOperationConsistency', () => {
      it('should set default values for deploy operations', () => {
        const outputs: Record<string, string> = {
          success: 'true',
          operation: 'deploy',
          stage: 'staging',
          completion_status: 'complete',
        };

        OutputFormatter.validateOperationConsistency(outputs, 'deploy');

        expect(outputs.urls).toBe('[]');
        expect(outputs.resources).toBe('[]');
      });

      it('should set default values for diff operations', () => {
        const outputs: Record<string, string> = {
          success: 'true',
          operation: 'diff',
          stage: 'staging',
          completion_status: 'complete',
        };

        OutputFormatter.validateOperationConsistency(outputs, 'diff');

        expect(outputs.planned_changes).toBe('0');
        expect(outputs.diff_summary).toBe('');
      });

      it('should set default values for remove operations', () => {
        const outputs: Record<string, string> = {
          success: 'true',
          operation: 'remove',
          stage: 'staging',
          completion_status: 'complete',
        };

        OutputFormatter.validateOperationConsistency(outputs, 'remove');

        expect(outputs.resources_removed).toBe('0');
        expect(outputs.removed_resources).toBe('[]');
      });

      it('should preserve existing values if already set', () => {
        const outputs: Record<string, string> = {
          success: 'true',
          operation: 'deploy',
          stage: 'staging',
          completion_status: 'complete',
          urls: '[{"name":"API","url":"https://api.com"}]',
          resources: '[{"type":"Function","name":"MyFunc"}]',
        };

        OutputFormatter.validateOperationConsistency(outputs, 'deploy');

        expect(outputs.urls).toBe('[{"name":"API","url":"https://api.com"}]');
        expect(outputs.resources).toBe('[{"type":"Function","name":"MyFunc"}]');
      });

      it('should set default values for stage operations', () => {
        const outputs: Record<string, string> = {};

        OutputFormatter.validateOperationConsistency(outputs, 'stage');

        expect(outputs.computed_stage).toBe('');
        expect(outputs.ref).toBe('');
        expect(outputs.event_name).toBe('');
        expect(outputs.is_pull_request).toBe('false');
      });

      it('should preserve existing stage values if already set', () => {
        const outputs: Record<string, string> = {
          computed_stage: 'feature-branch',
          ref: 'feature/branch',
          event_name: 'pull_request',
          is_pull_request: 'true',
        };

        OutputFormatter.validateOperationConsistency(outputs, 'stage');

        expect(outputs.computed_stage).toBe('feature-branch');
        expect(outputs.ref).toBe('feature/branch');
        expect(outputs.event_name).toBe('pull_request');
        expect(outputs.is_pull_request).toBe('true');
      });
    });
  });
});
