import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { access } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SSTOperation } from '../../src/types/index.js';
import {
  type CLIOptions,
  createSSTExecutor,
  executeSST,
  SSTCLIExecutor,
} from '../../src/utils/cli.js';

// Mock Node.js modules
vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('node:util', () => ({
  promisify: vi.fn((fn) => vi.fn(fn)),
}));

const mockSpawn = vi.mocked(spawn);
const mockAccess = vi.mocked(access);

// Mock child process implementation
class MockChildProcess extends EventEmitter {
  public pid = 12_345;
  public killed = false;
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();

  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    setTimeout(() => {
      this.emit('close', signal === 'SIGKILL' ? null : 0, signal || 'SIGTERM');
    }, 10);
    return true;
  }

  // Simulate process output
  emitOutput(stdout: string, stderr = '') {
    if (stdout) {
      this.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      this.stderr.emit('data', Buffer.from(stderr));
    }
  }

  // Simulate process completion
  complete(exitCode = 0) {
    setTimeout(() => {
      this.emit('close', exitCode, null);
    }, 10);
  }

  // Simulate process error
  error(error: Error) {
    setTimeout(() => {
      this.emit('error', error);
    }, 10);
  }
}

describe('SST CLI Utilities', () => {
  let mockChildProcess: MockChildProcess;
  let executor: SSTCLIExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChildProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChildProcess as unknown as ChildProcess);
    executor = new SSTCLIExecutor();

    // Mock file system access
    (access as any).__promisify__ = vi.fn().mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSTCLIExecutor', () => {
    describe('executeSST', () => {
      it('should execute deploy operation successfully', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';

        // Simulate successful deployment output
        setTimeout(() => {
          mockChildProcess.emitOutput('Deploying app: test-app\n');
          mockChildProcess.emitOutput('Stage: staging\n');
          mockChildProcess.emitOutput('✓ Complete\n');
          mockChildProcess.complete(0);
        }, 10);

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('deploy');
        expect(result.stage).toBe('staging');
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Deploying app: test-app');
        expect(result.truncated).toBe(false);
        expect(mockSpawn).toHaveBeenCalledWith(
          'sst',
          ['deploy', '--stage', 'staging'],
          expect.objectContaining({
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
          })
        );
      });

      it('should execute diff operation successfully', async () => {
        const operation: SSTOperation = 'diff';
        const stage = 'staging';

        setTimeout(() => {
          mockChildProcess.emitOutput('~ Resource will be updated\n');
          mockChildProcess.emitOutput('+ Resource will be created\n');
          mockChildProcess.complete(0);
        }, 10);

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('diff');
        expect(result.stage).toBe('staging');
        expect(result.output).toContain('~ Resource will be updated');
        expect(mockSpawn).toHaveBeenCalledWith(
          'sst',
          ['diff', '--stage', 'staging'],
          expect.any(Object)
        );
      });

      it('should execute remove operation with auto-confirmation', async () => {
        const operation: SSTOperation = 'remove';
        const stage = 'pr-123';

        setTimeout(() => {
          mockChildProcess.emitOutput('Removing resources...\n');
          mockChildProcess.emitOutput('✓ All resources removed\n');
          mockChildProcess.complete(0);
        }, 10);

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('remove');
        expect(result.stage).toBe('pr-123');
        expect(mockSpawn).toHaveBeenCalledWith(
          'sst',
          ['remove', '--stage', 'pr-123', '--yes'],
          expect.any(Object)
        );
      });

      it('should handle command failure', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';

        setTimeout(() => {
          mockChildProcess.emitOutput('', 'Error: Deployment failed\n');
          mockChildProcess.complete(1);
        }, 10);

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Error: Deployment failed');
        expect(result.error).toContain('Command failed with exit code 1');
      });

      it('should handle timeout', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';
        const options: CLIOptions = { timeout: 100 }; // 100ms timeout

        setTimeout(() => {
          mockChildProcess.emitOutput('Starting deployment...\n');
          // Don't complete the process to trigger timeout
        }, 10);

        const result = await executor.executeSST(operation, stage, options);

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(124); // Timeout exit code
        expect(result.error).toContain('Command timed out after 100ms');
      });

      it('should handle large output with truncation', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';
        const options: CLIOptions = { maxOutputSize: 50 }; // 50 bytes limit

        setTimeout(() => {
          // Generate output larger than limit
          const largeOutput = 'x'.repeat(100);
          mockChildProcess.emitOutput(largeOutput);
          mockChildProcess.complete(0);
        }, 10);

        const result = await executor.executeSST(operation, stage, options);

        expect(result.success).toBe(true);
        expect(result.truncated).toBe(true);
        expect(result.output.length).toBe(50);
      });

      it('should build environment variables correctly', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';
        const options: CLIOptions = {
          env: {
            AWS_REGION: 'us-east-1',
            AWS_PROFILE: 'production',
            CUSTOM_VAR: 'value',
          },
        };

        setTimeout(() => {
          mockChildProcess.complete(0);
        }, 10);

        await executor.executeSST(operation, stage, options);

        expect(mockSpawn).toHaveBeenCalledWith(
          'sst',
          ['deploy', '--stage', 'staging'],
          expect.objectContaining({
            env: expect.objectContaining({
              AWS_REGION: 'us-east-1',
              AWS_PROFILE: 'production',
              CUSTOM_VAR: 'value',
              SST_TELEMETRY_DISABLED: '1',
              CI: '1',
            }),
          })
        );
      });

      it('should handle process spawn error', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';

        mockSpawn.mockImplementation(() => {
          const errorProcess = new MockChildProcess();
          setTimeout(() => {
            errorProcess.error(new Error('Command not found'));
          }, 10);
          return errorProcess as unknown as ChildProcess;
        });

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to execute command');
      });

      it('should validate SST configuration exists', async () => {
        const operation: SSTOperation = 'deploy';
        const stage = 'staging';

        // Mock missing config file
        (access as any).__promisify__ = vi
          .fn()
          .mockRejectedValue(new Error('ENOENT'));

        const result = await executor.executeSST(operation, stage);

        expect(result.success).toBe(false);
        expect(result.error).toContain('SST configuration file not found');
      });
    });

    describe('checkSSTAvailability', () => {
      it('should detect available SST CLI', async () => {
        setTimeout(() => {
          mockChildProcess.emitOutput('2.34.0\n');
          mockChildProcess.complete(0);
        }, 10);

        const result = await executor.checkSSTAvailability();

        expect(result.available).toBe(true);
        expect(result.version).toBe('2.34.0');
        expect(mockSpawn).toHaveBeenCalledWith(
          'sst',
          ['--version'],
          expect.any(Object)
        );
      });

      it('should detect unavailable SST CLI', async () => {
        setTimeout(() => {
          mockChildProcess.error(new Error('Command not found'));
        }, 10);

        const result = await executor.checkSSTAvailability();

        expect(result.available).toBe(false);
        expect(result.error).toContain('SST CLI not available');
      });

      it('should handle SST CLI error response', async () => {
        setTimeout(() => {
          mockChildProcess.emitOutput('', 'Unknown command\n');
          mockChildProcess.complete(1);
        }, 10);

        const result = await executor.checkSSTAvailability();

        expect(result.available).toBe(false);
        expect(result.error).toContain('SST CLI check failed with exit code 1');
      });
    });

    describe('getProjectInfo', () => {
      it('should extract project information', async () => {
        setTimeout(() => {
          mockChildProcess.emitOutput(
            'App: my-app\nStage: staging\nRegion: us-east-1\n'
          );
          mockChildProcess.complete(0);
        }, 10);

        const result = await executor.getProjectInfo();

        expect(result.app).toBe('my-app');
        expect(result.stage).toBe('staging');
        expect(mockSpawn).toHaveBeenCalledWith(
          'sst',
          ['env'],
          expect.any(Object)
        );
      });

      it('should handle project info command failure', async () => {
        setTimeout(() => {
          mockChildProcess.emitOutput('', 'No SST app found\n');
          mockChildProcess.complete(1);
        }, 10);

        const result = await executor.getProjectInfo();

        expect(result.error).toContain('Failed to get project info');
        expect(result.app).toBeUndefined();
        expect(result.stage).toBeUndefined();
      });
    });
  });

  describe('Factory Functions', () => {
    it('should create SST executor', () => {
      const executor = createSSTExecutor();
      expect(executor).toBeInstanceOf(SSTCLIExecutor);
    });

    it('should execute SST command with default executor', async () => {
      setTimeout(() => {
        mockChildProcess.emitOutput('Deployment successful\n');
        mockChildProcess.complete(0);
      }, 10);

      const result = await executeSST('deploy', 'staging');

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined environment variables', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const options: CLIOptions = {
        env: {
          DEFINED_VAR: 'value',
          UNDEFINED_VAR: undefined as any,
          NULL_VAR: null as any,
          EMPTY_VAR: '',
        },
      };

      setTimeout(() => {
        mockChildProcess.complete(0);
      }, 10);

      await executor.executeSST(operation, stage, options);

      const spawnCall = mockSpawn.mock.calls[0];
      const env = spawnCall?.[2]?.env;

      expect(env).toHaveProperty('DEFINED_VAR', 'value');
      expect(env).toHaveProperty('EMPTY_VAR', '');
      expect(env).not.toHaveProperty('UNDEFINED_VAR');
      expect(env).not.toHaveProperty('NULL_VAR');
    });

    it('should handle custom working directory', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const options: CLIOptions = {
        cwd: '/custom/path',
      };

      setTimeout(() => {
        mockChildProcess.complete(0);
      }, 10);

      await executor.executeSST(operation, stage, options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'sst',
        ['deploy', '--stage', 'staging'],
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('should handle custom arguments', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const options: CLIOptions = {
        args: ['--verbose', '--output', 'json'],
      };

      setTimeout(() => {
        mockChildProcess.complete(0);
      }, 10);

      await executor.executeSST(operation, stage, options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'sst',
        ['deploy', '--stage', 'staging', '--verbose', '--output', 'json'],
        expect.any(Object)
      );
    });

    it('should handle process without PID', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';

      // Mock process without PID
      const processWithoutPid = new MockChildProcess();
      processWithoutPid.pid = undefined as any;
      mockSpawn.mockReturnValue(processWithoutPid as unknown as ChildProcess);

      setTimeout(() => {
        processWithoutPid.complete(0);
      }, 10);

      const result = await executor.executeSST(operation, stage);

      expect(result.success).toBe(true);
    });

    it('should handle mixed stdout and stderr output', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';

      setTimeout(() => {
        mockChildProcess.emitOutput('Starting deployment...\n');
        mockChildProcess.emitOutput('', 'Warning: deprecated feature\n');
        mockChildProcess.emitOutput('Deployment complete\n');
        mockChildProcess.complete(0);
      }, 10);

      const result = await executor.executeSST(operation, stage);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Starting deployment...');
      expect(result.stdout).toContain('Deployment complete');
      expect(result.stderr).toContain('Warning: deprecated feature');
      expect(result.output).toContain('Starting deployment...');
      expect(result.output).toContain('Warning: deprecated feature');
      expect(result.output).toContain('Deployment complete');
    });

    it('should handle process termination signals', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const options: CLIOptions = { timeout: 100 };

      // Override the mock to emit SIGKILL instead of SIGTERM
      const killProcess = new MockChildProcess();
      killProcess.kill = vi.fn((_signal?: NodeJS.Signals) => {
        killProcess.killed = true;
        setTimeout(() => {
          killProcess.emit('close', null, 'SIGKILL');
        }, 10);
        return true;
      });

      mockSpawn.mockReturnValue(killProcess as unknown as ChildProcess);

      setTimeout(() => {
        // Don't complete the process to trigger timeout
      }, 10);

      const result = await executor.executeSST(operation, stage, options);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124);
      expect(result.error).toContain('Command timed out');
    });
  });

  describe('Performance and Reliability', () => {
    it('should track execution duration accurately', async () => {
      const operation: SSTOperation = 'deploy';
      const stage = 'staging';
      const delay = 100; // 100ms

      setTimeout(() => {
        mockChildProcess.complete(0);
      }, delay);

      const startTime = Date.now();
      const result = await executor.executeSST(operation, stage);
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThanOrEqual(delay - 10); // Allow some margin
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 10);
    });

    it('should handle rapid successive executions', async () => {
      const operations: SSTOperation[] = ['deploy', 'diff', 'remove'];
      const promises = operations.map((operation, index) => {
        const mockProcess = new MockChildProcess();
        mockSpawn.mockReturnValueOnce(mockProcess as unknown as ChildProcess);

        setTimeout(
          () => {
            mockProcess.complete(0);
          },
          10 * (index + 1)
        );

        return executor.executeSST(operation, 'staging');
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].operation).toBe('deploy');
      expect(results[1].operation).toBe('diff');
      expect(results[2].operation).toBe('remove');
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should handle concurrent executions', async () => {
      const concurrentCount = 5;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentCount; i++) {
        const mockProcess = new MockChildProcess();
        mockSpawn.mockReturnValueOnce(mockProcess as unknown as ChildProcess);

        setTimeout(
          () => {
            mockProcess.emitOutput(`Output ${i}\n`);
            mockProcess.complete(0);
          },
          10 + i * 5
        );

        promises.push(executor.executeSST('deploy', `stage-${i}`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentCount);
      expect(results.every((r) => r.success)).toBe(true);
      results.forEach((result, index) => {
        expect(result.stage).toBe(`stage-${index}`);
      });
    });
  });
});
