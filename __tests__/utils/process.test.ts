import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getProcessManager,
  ProcessExecutionContext,
  ProcessManager,
  type ProcessMetadata,
  ProcessResourceMonitor,
  ProcessStatus,
} from '../../src/utils/process.js';

// Mock child process implementation
class MockChildProcess extends EventEmitter {
  public pid = Math.floor(Math.random() * 10_000) + 1000;
  public killed = false;
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();

  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    const actualSignal = signal || 'SIGTERM';

    // Simulate process termination
    setTimeout(() => {
      if (actualSignal === 'SIGKILL') {
        this.emit('close', null, actualSignal);
      } else {
        this.emit('close', 0, actualSignal);
      }
    }, 10);

    return true;
  }

  // Helper methods for testing
  emitOutput(data: string) {
    this.stdout.emit('data', Buffer.from(data));
  }

  emitError(data: string) {
    this.stderr.emit('data', Buffer.from(data));
  }

  complete(exitCode = 0) {
    setTimeout(() => {
      this.emit('close', exitCode, null);
    }, 10);
  }

  fail(error?: Error) {
    if (error) {
      setTimeout(() => {
        this.emit('error', error);
      }, 10);
    } else {
      this.complete(1);
    }
  }
}

describe('Process Management Utilities', () => {
  let processManager: ProcessManager;

  beforeEach(() => {
    processManager = new ProcessManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ProcessManager', () => {
    describe('registerProcess', () => {
      it('should register a new process with metadata', () => {
        const mockProcess = new MockChildProcess() as unknown as ChildProcess;
        const command = 'sst deploy --stage staging';

        const metadata = processManager.registerProcess(mockProcess, command);

        expect(metadata.id).toMatch(/^sst-process-\d+$/);
        expect(metadata.command).toBe(command);
        expect(metadata.pid).toBe(mockProcess.pid);
        expect(metadata.status).toBe(ProcessStatus.RUNNING);
        expect(metadata.startTime).toBeGreaterThan(0);
        expect(metadata.endTime).toBeUndefined();
      });

      it('should emit process-started event', () => {
        const mockProcess = new MockChildProcess() as unknown as ChildProcess;
        const command = 'sst deploy --stage staging';
        const startedSpy = vi.fn();

        processManager.on('process-started', startedSpy);
        const metadata = processManager.registerProcess(mockProcess, command);

        expect(startedSpy).toHaveBeenCalledWith(metadata);
      });

      it('should generate unique process IDs', () => {
        const process1 = new MockChildProcess() as unknown as ChildProcess;
        const process2 = new MockChildProcess() as unknown as ChildProcess;

        const metadata1 = processManager.registerProcess(process1, 'command1');
        const metadata2 = processManager.registerProcess(process2, 'command2');

        expect(metadata1.id).not.toBe(metadata2.id);
      });
    });

    describe('process lifecycle events', () => {
      it('should handle successful process completion', async () => {
        const mockProcess = new MockChildProcess();
        const completedSpy = vi.fn();

        processManager.on('process-completed', completedSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        mockProcess.complete(0);
        vi.advanceTimersByTime(20);

        await vi.waitFor(() => {
          expect(completedSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              id: metadata.id,
              status: ProcessStatus.COMPLETED,
              exitCode: 0,
            })
          );
        });
      });

      it('should handle failed process completion', async () => {
        const mockProcess = new MockChildProcess();
        const failedSpy = vi.fn();

        processManager.on('process-failed', failedSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        mockProcess.complete(1);
        vi.advanceTimersByTime(20);

        await vi.waitFor(() => {
          expect(failedSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              id: metadata.id,
              status: ProcessStatus.FAILED,
              exitCode: 1,
            })
          );
        });
      });

      it('should handle process timeout', async () => {
        const mockProcess = new MockChildProcess();
        const timeoutSpy = vi.fn();

        processManager.on('process-timeout', timeoutSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        mockProcess.emit('close', null, 'SIGTERM');
        vi.advanceTimersByTime(20);

        await vi.waitFor(() => {
          expect(timeoutSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              id: metadata.id,
              status: ProcessStatus.TIMEOUT,
              signal: 'SIGTERM',
            })
          );
        });
      });

      it('should handle process errors', async () => {
        const mockProcess = new MockChildProcess();
        const failedSpy = vi.fn();

        processManager.on('process-failed', failedSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        const error = new Error('Process failed');
        mockProcess.fail(error);
        vi.advanceTimersByTime(20);

        await vi.waitFor(() => {
          expect(failedSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              id: metadata.id,
              status: ProcessStatus.FAILED,
            })
          );
        });
      });

      it('should handle stdout data events', () => {
        const mockProcess = new MockChildProcess();
        const outputSpy = vi.fn();

        processManager.on('output-data', outputSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        const testData = 'Test output data';
        mockProcess.emitOutput(testData);

        expect(outputSpy).toHaveBeenCalledWith(testData, metadata);
      });

      it('should handle stderr data events', () => {
        const mockProcess = new MockChildProcess();
        const errorSpy = vi.fn();

        processManager.on('error-data', errorSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        const testData = 'Error output data';
        mockProcess.emitError(testData);

        expect(errorSpy).toHaveBeenCalledWith(testData, metadata);
      });
    });

    describe('getProcess', () => {
      it('should return process metadata by ID', () => {
        const mockProcess = new MockChildProcess() as unknown as ChildProcess;
        const metadata = processManager.registerProcess(
          mockProcess,
          'test command'
        );

        const retrieved = processManager.getProcess(metadata.id);

        expect(retrieved).toEqual(metadata);
      });

      it('should return undefined for non-existent process ID', () => {
        const retrieved = processManager.getProcess('non-existent-id');

        expect(retrieved).toBeUndefined();
      });
    });

    describe('getActiveProcesses', () => {
      it('should return only running processes', () => {
        const process1 = new MockChildProcess() as unknown as ChildProcess;
        const process2 = new MockChildProcess() as unknown as ChildProcess;
        const process3 = new MockChildProcess() as unknown as ChildProcess;

        const metadata1 = processManager.registerProcess(process1, 'command1');
        const metadata2 = processManager.registerProcess(process2, 'command2');
        const metadata3 = processManager.registerProcess(process3, 'command3');

        // Complete process2
        (process2 as any).emit('close', 0, null);
        vi.advanceTimersByTime(20);

        const activeProcesses = processManager.getActiveProcesses();

        expect(activeProcesses).toHaveLength(2);
        expect(activeProcesses.map((p) => p.id)).toContain(metadata1.id);
        expect(activeProcesses.map((p) => p.id)).toContain(metadata3.id);
        expect(activeProcesses.map((p) => p.id)).not.toContain(metadata2.id);
      });

      it('should return empty array when no processes are running', () => {
        const activeProcesses = processManager.getActiveProcesses();
        expect(activeProcesses).toEqual([]);
      });
    });

    describe('cancelProcess', () => {
      it('should cancel a running process', async () => {
        const mockProcess = new MockChildProcess();
        const cancelledSpy = vi.fn();

        processManager.on('process-cancelled', cancelledSpy);
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        const result = await processManager.cancelProcess(
          metadata.id,
          'SIGTERM'
        );
        vi.advanceTimersByTime(20);

        expect(result).toBe(true);
        await vi.waitFor(() => {
          expect(cancelledSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              id: metadata.id,
              status: ProcessStatus.CANCELLED,
            })
          );
        });
      });

      it('should return false for non-existent process', async () => {
        const result = await processManager.cancelProcess('non-existent-id');

        expect(result).toBe(false);
      });

      it('should return false for already completed process', async () => {
        const mockProcess = new MockChildProcess();
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        // Complete the process first
        mockProcess.complete(0);
        vi.advanceTimersByTime(20);

        const result = await processManager.cancelProcess(metadata.id);

        expect(result).toBe(false);
      });

      it('should handle forced termination with SIGKILL', async () => {
        const mockProcess = new MockChildProcess();
        const metadata = processManager.registerProcess(
          mockProcess as unknown as ChildProcess,
          'test command'
        );

        // Mock process that doesn't respond to SIGTERM
        mockProcess.kill = vi.fn((signal) => {
          if (signal === 'SIGKILL') {
            mockProcess.killed = true;
            setTimeout(() => mockProcess.emit('close', null, 'SIGKILL'), 10);
          }
          return true;
        });

        const result = processManager.cancelProcess(metadata.id, 'SIGTERM');
        vi.advanceTimersByTime(6000); // Advance past forced termination timeout

        await expect(result).resolves.toBe(true);
      });
    });

    describe('cancelAllProcesses', () => {
      it('should cancel all active processes', async () => {
        const processes = [
          new MockChildProcess() as unknown as ChildProcess,
          new MockChildProcess() as unknown as ChildProcess,
          new MockChildProcess() as unknown as ChildProcess,
        ];

        const _metadataList = processes.map((process, index) =>
          processManager.registerProcess(process, `command-${index}`)
        );

        const cancelledCount = await processManager.cancelAllProcesses();
        vi.advanceTimersByTime(20);

        expect(cancelledCount).toBe(3);
      });

      it('should return 0 when no processes are active', async () => {
        const cancelledCount = await processManager.cancelAllProcesses();

        expect(cancelledCount).toBe(0);
      });
    });

    describe('cleanup', () => {
      it('should remove completed processes from memory', async () => {
        const process1 = new MockChildProcess();
        const process2 = new MockChildProcess();

        const metadata1 = processManager.registerProcess(
          process1 as unknown as ChildProcess,
          'command1'
        );
        const metadata2 = processManager.registerProcess(
          process2 as unknown as ChildProcess,
          'command2'
        );

        // Complete process1
        process1.complete(0);
        vi.advanceTimersByTime(20);

        const cleanedCount = processManager.cleanup();

        expect(cleanedCount).toBe(1);
        expect(processManager.getProcess(metadata1.id)).toBeUndefined();
        expect(processManager.getProcess(metadata2.id)).toBeDefined();
      });
    });

    describe('getStats', () => {
      it('should return accurate statistics', async () => {
        const processes = [
          new MockChildProcess(),
          new MockChildProcess(),
          new MockChildProcess(),
        ];

        processes.forEach((process, index) =>
          processManager.registerProcess(
            process as unknown as ChildProcess,
            `command-${index}`
          )
        );

        // Complete one successfully, fail one
        processes[0].complete(0);
        processes[1].complete(1);
        vi.advanceTimersByTime(20);

        const stats = processManager.getStats();

        expect(stats.total).toBe(3);
        expect(stats.running).toBe(1);
        expect(stats.completed).toBe(1);
        expect(stats.failed).toBe(1);
        expect(stats.timeout).toBe(0);
        expect(stats.cancelled).toBe(0);
      });
    });
  });

  describe('ProcessResourceMonitor', () => {
    let resourceMonitor: ProcessResourceMonitor;

    beforeEach(() => {
      resourceMonitor = new ProcessResourceMonitor();
    });

    afterEach(() => {
      resourceMonitor.stopAllMonitoring();
    });

    describe('startMonitoring', () => {
      it('should start monitoring a process', () => {
        const mockProcess = new MockChildProcess() as unknown as ChildProcess;
        const metadata: ProcessMetadata = {
          id: 'test-process',
          command: 'test command',
          pid: mockProcess.pid,
          startTime: Date.now(),
          status: ProcessStatus.RUNNING,
        };
        const callback = vi.fn();

        resourceMonitor.startMonitoring(mockProcess, metadata, callback);
        vi.advanceTimersByTime(1100); // Advance past monitoring interval

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            pid: mockProcess.pid,
            timestamp: expect.any(Number),
          })
        );
      });

      it('should not start monitoring if process has no PID', () => {
        const mockProcess = { pid: undefined } as unknown as ChildProcess;
        const metadata: ProcessMetadata = {
          id: 'test-process',
          command: 'test command',
          startTime: Date.now(),
          status: ProcessStatus.RUNNING,
        };
        const callback = vi.fn();

        resourceMonitor.startMonitoring(mockProcess, metadata, callback);
        vi.advanceTimersByTime(1100);

        expect(callback).not.toHaveBeenCalled();
      });

      it('should not start monitoring if already monitoring', () => {
        const mockProcess = new MockChildProcess() as unknown as ChildProcess;
        const metadata: ProcessMetadata = {
          id: 'test-process',
          command: 'test command',
          pid: mockProcess.pid,
          startTime: Date.now(),
          status: ProcessStatus.RUNNING,
        };
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        resourceMonitor.startMonitoring(mockProcess, metadata, callback1);
        resourceMonitor.startMonitoring(mockProcess, metadata, callback2);
        vi.advanceTimersByTime(1100);

        expect(callback1).toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();
      });
    });

    describe('stopMonitoring', () => {
      it('should stop monitoring a process', () => {
        const mockProcess = new MockChildProcess() as unknown as ChildProcess;
        const metadata: ProcessMetadata = {
          id: 'test-process',
          command: 'test command',
          pid: mockProcess.pid,
          startTime: Date.now(),
          status: ProcessStatus.RUNNING,
        };
        const callback = vi.fn();

        resourceMonitor.startMonitoring(mockProcess, metadata, callback);
        resourceMonitor.stopMonitoring(metadata.id);
        vi.advanceTimersByTime(1100);

        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('stopAllMonitoring', () => {
      it('should stop monitoring all processes', () => {
        const processes = [
          new MockChildProcess() as unknown as ChildProcess,
          new MockChildProcess() as unknown as ChildProcess,
        ];

        const callbacks = [vi.fn(), vi.fn()];

        processes.forEach((process, index) => {
          const metadata: ProcessMetadata = {
            id: `test-process-${index}`,
            command: `test command ${index}`,
            pid: process.pid,
            startTime: Date.now(),
            status: ProcessStatus.RUNNING,
          };
          resourceMonitor.startMonitoring(process, metadata, callbacks[index]);
        });

        resourceMonitor.stopAllMonitoring();
        vi.advanceTimersByTime(1100);

        expect(callbacks[0]).not.toHaveBeenCalled();
        expect(callbacks[1]).not.toHaveBeenCalled();
      });
    });
  });

  describe('ProcessExecutionContext', () => {
    let executionContext: ProcessExecutionContext;

    beforeEach(() => {
      executionContext = new ProcessExecutionContext();
    });

    afterEach(() => {
      executionContext.cleanup();
    });

    describe('execute', () => {
      it('should execute process with lifecycle management', async () => {
        const mockProcess = new MockChildProcess();
        const processFactory = () => mockProcess as unknown as ChildProcess;
        const command = 'test command';
        const onOutput = vi.fn();
        const onError = vi.fn();

        const metadataPromise = executionContext.execute(
          processFactory,
          command,
          {
            onOutput,
            onError,
          }
        );

        // Simulate output and completion
        mockProcess.emitOutput('test output');
        mockProcess.emitError('test error');
        mockProcess.complete(0);
        vi.advanceTimersByTime(20);

        const metadata = await metadataPromise;

        expect(metadata.command).toBe(command);
        expect(metadata.status).toBe(ProcessStatus.RUNNING);
        expect(onOutput).toHaveBeenCalledWith('test output');
        expect(onError).toHaveBeenCalledWith('test error');
      });

      it('should handle process timeout', async () => {
        const mockProcess = new MockChildProcess();
        const processFactory = () => mockProcess as unknown as ChildProcess;
        const command = 'test command';

        const metadataPromise = executionContext.execute(
          processFactory,
          command,
          {
            timeout: 100,
          }
        );

        // Don't complete the process to trigger timeout
        vi.advanceTimersByTime(150);

        const metadata = await metadataPromise;
        expect(metadata.command).toBe(command);
      });

      it('should start resource monitoring when requested', async () => {
        const mockProcess = new MockChildProcess();
        const processFactory = () => mockProcess as unknown as ChildProcess;
        const command = 'test command';

        const metadataPromise = executionContext.execute(
          processFactory,
          command,
          {
            monitorResources: true,
          }
        );

        const metadata = await metadataPromise;
        expect(metadata.command).toBe(command);
      });
    });

    describe('cancel', () => {
      it('should cancel running process', async () => {
        const mockProcess = new MockChildProcess();
        const processFactory = () => mockProcess as unknown as ChildProcess;
        const command = 'test command';

        await executionContext.execute(processFactory, command);
        const result = await executionContext.cancel();

        expect(result).toBe(true);
      });

      it('should return false when no process is running', async () => {
        const result = await executionContext.cancel();

        expect(result).toBe(false);
      });
    });

    describe('waitForCompletion', () => {
      it('should wait for process completion', async () => {
        const mockProcess = new MockChildProcess();
        const processFactory = () => mockProcess as unknown as ChildProcess;
        const command = 'test command';

        await executionContext.execute(processFactory, command);

        setTimeout(() => {
          mockProcess.complete(0);
          vi.advanceTimersByTime(20);
        }, 50);

        vi.advanceTimersByTime(50);

        const completedMetadata = await executionContext.waitForCompletion();
        expect(completedMetadata.status).toBe(ProcessStatus.COMPLETED);
      });

      it('should reject when no process is executing', async () => {
        await expect(executionContext.waitForCompletion()).rejects.toThrow(
          'No process is currently executing'
        );
      });
    });
  });

  describe('getProcessManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getProcessManager();
      const manager2 = getProcessManager();

      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(ProcessManager);
    });
  });
});
