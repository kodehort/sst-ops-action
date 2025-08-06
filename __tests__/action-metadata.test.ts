import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('Action Metadata (action.yml)', () => {
  const actionYmlPath = resolve(__dirname, '..', 'action.yml');
  let actionMetadata: Record<string, unknown>;

  beforeEach(() => {
    const actionYmlContent = readFileSync(actionYmlPath, 'utf-8');
    actionMetadata = parse(actionYmlContent);
  });

  describe('Basic metadata', () => {
    it('should have required metadata fields', () => {
      expect(actionMetadata.name).toBe('SST Operations');
      expect(actionMetadata.description).toBe(
        'A unified GitHub Action for SST operations: deploy, diff, and remove'
      );
      expect(actionMetadata.author).toBe('Kodehort');
    });

    it('should have proper branding', () => {
      expect(actionMetadata.branding).toEqual({
        icon: 'cloud',
        color: 'orange',
      });
    });

    it('should use Node.js 20 runtime', () => {
      expect(actionMetadata.runs).toEqual({
        using: 'node20',
        main: 'dist/index.cjs',
      });
    });
  });

  describe('Inputs validation', () => {
    it('should have operation input with correct defaults', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const operation = inputs.operation as Record<string, unknown>;
      expect(operation.description).toBe(
        'SST operation to perform (deploy, diff, remove)'
      );
      expect(operation.required).toBe(false);
      expect(operation.default).toBe('deploy');
    });

    it('should have token input as required', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const token = inputs.token as Record<string, unknown>;
      expect(token.description).toBe('GitHub token for authentication');
      expect(token.required).toBe(true);
    });

    it('should have stage input as required', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const stage = inputs.stage as Record<string, unknown>;
      expect(stage.description).toBe('SST stage to operate on');
      expect(stage.required).toBe(true);
    });

    it('should have comment-mode input with correct default', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const commentMode = inputs['comment-mode'] as Record<string, unknown>;
      expect(commentMode.description).toBe(
        'When to post PR comments (always, on-success, on-failure, never)'
      );
      expect(commentMode.required).toBe(false);
      expect(commentMode.default).toBe('on-success');
    });

    it('should have fail-on-error input with correct default', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const failOnError = inputs['fail-on-error'] as Record<string, unknown>;
      expect(failOnError.description).toBe(
        'Whether to fail the action when SST operation fails'
      );
      expect(failOnError.required).toBe(false);
      expect(failOnError.default).toBe('true');
    });

    it('should have max-output-size input with correct default', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const maxOutputSize = inputs['max-output-size'] as Record<
        string,
        unknown
      >;
      expect(maxOutputSize.description).toBe(
        'Maximum output size before truncation (bytes)'
      );
      expect(maxOutputSize.required).toBe(false);
      expect(maxOutputSize.default).toBe('50000');
    });

    it('should have all required PRD inputs', () => {
      const expectedInputs = [
        'operation',
        'token',
        'stage',
        'comment-mode',
        'fail-on-error',
        'max-output-size',
      ];

      const inputs = actionMetadata.inputs as Record<string, unknown>;
      for (const input of expectedInputs) {
        expect(inputs).toHaveProperty(input);
      }
    });
  });

  describe('Outputs validation', () => {
    const expectedOutputs = [
      {
        name: 'success',
        description: 'Whether SST operation completed successfully',
      },
      { name: 'operation', description: 'The operation that was performed' },
      { name: 'stage', description: 'The stage that was operated on' },
      {
        name: 'resource_changes',
        description: 'Number of resource changes made (deploy/remove only)',
      },
      {
        name: 'urls',
        description: 'JSON array of deployed URLs (deploy only)',
      },
      { name: 'app', description: 'The SST app name' },
      {
        name: 'completion_status',
        description: 'Operation completion status (complete, partial, failed)',
      },
      {
        name: 'permalink',
        description: 'SST Console permalink for operation details',
      },
      {
        name: 'truncated',
        description: 'Whether the operation output was truncated',
      },
      {
        name: 'diff_summary',
        description: 'Summary of planned changes (diff only)',
      },
    ];

    it('should have all required PRD outputs', () => {
      const outputs = actionMetadata.outputs as Record<string, unknown>;
      for (const expectedOutput of expectedOutputs) {
        expect(outputs).toHaveProperty(expectedOutput.name);
        const output = outputs[expectedOutput.name] as Record<string, unknown>;
        expect(output.description).toBe(expectedOutput.description);
      }
    });

    it('should have correct number of outputs', () => {
      const outputs = actionMetadata.outputs as Record<string, unknown>;
      expect(Object.keys(outputs)).toHaveLength(expectedOutputs.length);
    });
  });

  describe('GitHub Actions schema compliance', () => {
    it('should have valid runs configuration', () => {
      expect(actionMetadata.runs).toBeDefined();
      const runs = actionMetadata.runs as Record<string, unknown>;
      expect(runs.using).toBe('node20');
      expect(runs.main).toBe('dist/index.cjs');
    });

    it('should have string descriptions for all inputs', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      for (const inputName of Object.keys(inputs)) {
        const input = inputs[inputName] as Record<string, unknown>;
        expect(typeof input.description).toBe('string');
        expect((input.description as string).length).toBeGreaterThan(10);
      }
    });

    it('should have string descriptions for all outputs', () => {
      const outputs = actionMetadata.outputs as Record<string, unknown>;
      for (const outputName of Object.keys(outputs)) {
        const output = outputs[outputName] as Record<string, unknown>;
        expect(typeof output.description).toBe('string');
        expect((output.description as string).length).toBeGreaterThan(10);
      }
    });

    it('should have valid input defaults that are strings', () => {
      const inputsWithDefaults = [
        'operation',
        'comment-mode',
        'fail-on-error',
        'max-output-size',
      ];

      const inputs = actionMetadata.inputs as Record<string, unknown>;
      for (const inputName of inputsWithDefaults) {
        const input = inputs[inputName] as Record<string, unknown>;
        expect(typeof input.default).toBe('string');
      }
    });

    it('should have consistent required field types', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      for (const inputName of Object.keys(inputs)) {
        const input = inputs[inputName] as Record<string, unknown>;
        if (Object.hasOwn(input, 'required')) {
          expect(typeof input.required).toBe('boolean');
        }
      }
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain deploy as default operation for compatibility', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const operation = inputs.operation as Record<string, unknown>;
      expect(operation.default).toBe('deploy');
    });

    it('should have on-success as default comment mode', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const commentMode = inputs['comment-mode'] as Record<string, unknown>;
      expect(commentMode.default).toBe('on-success');
    });

    it('should have fail-on-error default to true', () => {
      const inputs = actionMetadata.inputs as Record<string, unknown>;
      const failOnError = inputs['fail-on-error'] as Record<string, unknown>;
      expect(failOnError.default).toBe('true');
    });
  });
});
