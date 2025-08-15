import { access } from 'node:fs';
import * as mockExecModule from '@actions/exec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SSTOperation } from '../../src/types/index.js';
import {
  type CLIOptions,
  createSSTExecutor,
  executeSST,
  SSTCLIExecutor,
} from '../../src/utils/cli.js';

const mockExec = mockExecModule as any;
const mockAccess = access as any;

describe('SST CLI Utilities - Command Execution', () => {
  let executor: SSTCLIExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new SSTCLIExecutor();

    // Mock file system access
    (access as any).__promisify__ = vi.fn().mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);

    // Set up default exec mock
    mockExec.exec.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSTCLIExecutor', () => {
    describe('executeSST', () => {
      it('should execute deploy operation successfully', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';

        // Mock successful execution with output via listeners
        mockExec.exec.mockImplementation(
          (_command: string, _args: string[], options: any) => {
            if (options?.listeners?.stdout) {
              options.listeners.stdout(
                Buffer.from('Deploying app: test-app\n')
              );
              options.listeners.stdout(Buffer.from('Stage: staging\n'));
              options.listeners.stdout(Buffer.from('✓ Complete\n'));
            }
            return 0;
          }
        );

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('deploy');
        expect(result.stage).toBe('staging');
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Deploying app: test-app');
        expect(result.command).toContain('sst deploy --stage staging');
        expect(mockExec.exec).toHaveBeenCalledWith(
          'bun',
          ['sst', 'deploy', '--stage', 'staging'],
          expect.any(Object)
        );
      });

      it('should execute diff operation successfully', async () => {
        const operation: SSTOperation = 'diff';
        const stage = 'staging';

        mockExec.exec.mockImplementation(
          (_command: string, _args: string[], options: any) => {
            if (options?.listeners?.stdout) {
              options.listeners.stdout(
                Buffer.from('~ Resource will be updated\n')
              );
            }
            return 0;
          }
        );

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('diff');
        expect(result.stage).toBe('staging');
        expect(result.output).toContain('~ Resource will be updated');
        expect(mockExec.exec).toHaveBeenCalledWith(
          'bun',
          ['sst', 'diff', '--stage', 'staging'],
          expect.any(Object)
        );
      });

      it('should execute remove operation with auto-confirmation', async () => {
        const operation: SSTOperation = 'remove';
        const stage = 'pr-123';

        mockExec.exec.mockImplementation(
          (_command: string, _args: string[], options: any) => {
            if (options?.listeners?.stdout) {
              options.listeners.stdout(Buffer.from('Removing resources...\n'));
              options.listeners.stdout(
                Buffer.from('✓ All resources removed\n')
              );
            }
            return 0;
          }
        );

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('remove');
        expect(result.stage).toBe('pr-123');
        expect(mockExec.exec).toHaveBeenCalledWith(
          'bun',
          ['sst', 'remove', '--stage', 'pr-123', '--yes'],
          expect.any(Object)
        );
      });

      it('should handle command failure', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';

        mockExec.exec.mockImplementation(
          (_command: string, _args: string[], options: any) => {
            if (options?.listeners?.stderr) {
              options.listeners.stderr(
                Buffer.from('Error: Deployment failed\n')
              );
            }
            return 1;
          }
        );

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Error: Deployment failed');
        expect(result.error).toContain('Command failed with exit code 1');
      });

      it('should handle timeout', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';
        const options: CLIOptions = { timeout: 100 };

        mockExec.exec.mockRejectedValue(
          new Error('Command timeout after 100ms')
        );

        const result = await executor.executeSST(operation, stage, options);

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(124); // Timeout exit code
        expect(result.error).toContain('Command timed out after 100ms');
      });

      it('should handle large output with truncation', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';
        const cliOptions: CLIOptions = { maxOutputSize: 50 };

        mockExec.exec.mockImplementation(
          (_command: string, _args: string[], execOptions: any) => {
            if (execOptions?.listeners?.stdout) {
              // Generate output larger than maxOutputSize
              const largeOutput = 'x'.repeat(100);
              execOptions.listeners.stdout(Buffer.from(largeOutput));
            }
            return 0;
          }
        );

        const result = await executor.executeSST(operation, stage, cliOptions);

        expect(result.success).toBe(true);
        expect(result.truncated).toBe(true);
        expect(result.output.length).toBe(50);
      });

      it('should build environment variables correctly', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';
        const options: CLIOptions = {
          env: {
            AWS_REGION: 'us-west-2',
            CUSTOM_VAR: 'test-value',
          },
        };

        await executor.executeSST(operation, stage, options);

        expect(mockExec.exec).toHaveBeenCalledWith(
          'bun',
          ['sst', 'deploy', '--stage', 'staging'],
          expect.objectContaining({
            env: expect.objectContaining({
              AWS_REGION: 'us-west-2',
              CUSTOM_VAR: 'test-value',
              SST_TELEMETRY_DISABLED: '1',
              CI: '1',
            }),
          })
        );
      });
    });

  });

  describe('Factory Functions', () => {
    it('should execute SST command with default executor', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'production';

      mockExec.exec.mockImplementation(
        (_command: string, _args: string[], options: any) => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('Deploy complete\n'));
          }
          return 0;
        }
      );

      const result = await executeSST(operation, stage);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('production');
    });

    it('should create new executor instance', () => {
      const executor1 = createSSTExecutor();
      const executor2 = createSSTExecutor();

      expect(executor1).toBeInstanceOf(SSTCLIExecutor);
      expect(executor2).toBeInstanceOf(SSTCLIExecutor);
      expect(executor1).not.toBe(executor2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle custom working directory', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const customCwd = '/custom/path';

      await executor.executeSST(operation, stage, { cwd: customCwd });

      expect(mockExec.exec).toHaveBeenCalledWith(
        'bun',
        ['sst', 'deploy', '--stage', 'staging'],
        expect.objectContaining({
          cwd: customCwd,
        })
      );
    });

    it('should handle custom arguments', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const customArgs = ['--verbose', '--debug'];

      await executor.executeSST(operation, stage, { args: customArgs });

      expect(mockExec.exec).toHaveBeenCalledWith(
        'bun',
        ['sst', 'deploy', '--stage', 'staging', '--verbose', '--debug'],
        expect.any(Object)
      );
    });

    it('should handle mixed stdout and stderr output', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';

      mockExec.exec.mockImplementation(
        (_command: string, _args: string[], options: any) => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('Deploying...\n'));
          }
          if (options?.listeners?.stderr) {
            options.listeners.stderr(
              Buffer.from('Warning: deprecated feature\n')
            );
          }
          return 0;
        }
      );

      const result = await executor.executeSST(operation, stage);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Deploying...');
      expect(result.stderr).toContain('Warning: deprecated feature');
      expect(result.output).toContain('Deploying...');
      expect(result.output).toContain('Warning: deprecated feature');
    });
  });

  describe('Performance and Reliability', () => {
    it('should track execution duration accurately', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';

      mockExec.exec.mockImplementation(async () => {
        // Simulate some execution time
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 0;
      });

      const result = await executor.executeSST(operation, stage);

      expect(result.duration).toBeGreaterThanOrEqual(90);
      expect(result.duration).toBeLessThan(200);
    });

    it('should handle concurrent executions', async () => {
      const operation: SSTOperation = 'deploy';
      const concurrentCount = 3;

      mockExec.exec.mockImplementation(
        (_command: string, _args: string[], options: any) => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('Deploy complete\n'));
          }
          return 0;
        }
      );

      const promises = Array.from({ length: concurrentCount }, (_, index) =>
        executor.executeSST(operation, `stage-${index}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentCount);
      expect(results.every((r) => r.success)).toBe(true);
      results.forEach((result, index) => {
        expect(result.stage).toBe(`stage-${index}`);
      });
    });
  });
});
