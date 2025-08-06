/**
 * Process management utilities for SST CLI operations
 * Handles process lifecycle, signal management, and resource cleanup
 */

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * Process status enumeration
 */
export enum ProcessStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

/**
 * Process execution metadata
 */
export interface ProcessMetadata {
  /** Unique process identifier */
  id: string;
  /** Command being executed */
  command: string;
  /** Process ID */
  pid?: number | undefined;
  /** Start time timestamp */
  startTime: number;
  /** End time timestamp */
  endTime?: number | undefined;
  /** Current status */
  status: ProcessStatus;
  /** Exit code */
  exitCode?: number | undefined;
  /** Signal that terminated the process */
  signal?: NodeJS.Signals | undefined;
}

/**
 * Process manager events
 */
export interface ProcessManagerEvents {
  'process-started': [ProcessMetadata];
  'process-completed': [ProcessMetadata];
  'process-failed': [ProcessMetadata];
  'process-timeout': [ProcessMetadata];
  'process-cancelled': [ProcessMetadata];
  'output-data': [string, ProcessMetadata];
  'error-data': [string, ProcessMetadata];
}

/**
 * Process manager for handling multiple SST CLI operations
 */
export class ProcessManager extends EventEmitter<ProcessManagerEvents> {
  private processes = new Map<
    string,
    { process: ChildProcess; metadata: ProcessMetadata }
  >();
  private processIdCounter = 0;

  /**
   * Register a new process for management
   */
  registerProcess(process: ChildProcess, command: string): ProcessMetadata {
    const id = `sst-process-${++this.processIdCounter}`;
    const metadata: ProcessMetadata = {
      id,
      command,
      pid: process.pid,
      startTime: Date.now(),
      status: ProcessStatus.RUNNING,
    };

    this.processes.set(id, { process, metadata });
    this.setupProcessHandlers(process, metadata);
    this.emit('process-started', metadata);

    return metadata;
  }

  /**
   * Get process metadata by ID
   */
  getProcess(id: string): ProcessMetadata | undefined {
    return this.processes.get(id)?.metadata;
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): ProcessMetadata[] {
    return Array.from(this.processes.values())
      .map((p) => p.metadata)
      .filter((m) => m.status === ProcessStatus.RUNNING);
  }

  /**
   * Cancel a specific process
   */
  async cancelProcess(
    id: string,
    signal: NodeJS.Signals = 'SIGTERM'
  ): Promise<boolean> {
    const entry = this.processes.get(id);
    if (!entry) {
      return false;
    }

    const { process, metadata } = entry;

    if (metadata.status === ProcessStatus.RUNNING && process.pid) {
      return this.terminateProcess(process, metadata, signal);
    }

    return false;
  }

  /**
   * Cancel all active processes
   */
  async cancelAllProcesses(
    signal: NodeJS.Signals = 'SIGTERM'
  ): Promise<number> {
    const activeProcesses = this.getActiveProcesses();
    let cancelledCount = 0;

    for (const metadata of activeProcesses) {
      const success = await this.cancelProcess(metadata.id, signal);
      if (success) {
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Clean up completed processes from memory
   */
  cleanup(): number {
    const toRemove = Array.from(this.processes.entries()).filter(
      ([, { metadata }]) =>
        metadata.status !== ProcessStatus.RUNNING &&
        metadata.status !== ProcessStatus.PENDING
    );

    for (const [id] of toRemove) {
      this.processes.delete(id);
    }

    return toRemove.length;
  }

  /**
   * Get process statistics
   */
  getStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    timeout: number;
    cancelled: number;
  } {
    const allProcesses = Array.from(this.processes.values()).map(
      (p) => p.metadata
    );

    return {
      total: allProcesses.length,
      running: allProcesses.filter((p) => p.status === ProcessStatus.RUNNING)
        .length,
      completed: allProcesses.filter(
        (p) => p.status === ProcessStatus.COMPLETED
      ).length,
      failed: allProcesses.filter((p) => p.status === ProcessStatus.FAILED)
        .length,
      timeout: allProcesses.filter((p) => p.status === ProcessStatus.TIMEOUT)
        .length,
      cancelled: allProcesses.filter(
        (p) => p.status === ProcessStatus.CANCELLED
      ).length,
    };
  }

  /**
   * Set up event handlers for a process
   */
  private setupProcessHandlers(
    process: ChildProcess,
    metadata: ProcessMetadata
  ): void {
    // Handle process completion
    process.on(
      'close',
      (code: number | null, signal: NodeJS.Signals | null) => {
        metadata.endTime = Date.now();
        metadata.exitCode = code || undefined;
        metadata.signal = signal || undefined;

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          metadata.status = ProcessStatus.TIMEOUT;
          this.emit('process-timeout', metadata);
        } else if (code === 0) {
          metadata.status = ProcessStatus.COMPLETED;
          this.emit('process-completed', metadata);
        } else {
          metadata.status = ProcessStatus.FAILED;
          this.emit('process-failed', metadata);
        }
      }
    );

    // Handle process errors
    process.on('error', (_error) => {
      metadata.endTime = Date.now();
      metadata.status = ProcessStatus.FAILED;
      this.emit('process-failed', metadata);
    });

    // Handle stdout data
    if (process.stdout) {
      process.stdout.on('data', (data: Buffer) => {
        this.emit('output-data', data.toString(), metadata);
      });
    }

    // Handle stderr data
    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        this.emit('error-data', data.toString(), metadata);
      });
    }
  }

  /**
   * Terminate a process gracefully with fallback to force kill
   */
  private async terminateProcess(
    process: ChildProcess,
    metadata: ProcessMetadata,
    signal: NodeJS.Signals
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!process.pid) {
        resolve(false);
        return;
      }

      // Set up timeout for forced termination
      const forceKillTimeout = setTimeout(() => {
        if (!process.killed && process.pid) {
          process.kill('SIGKILL');
        }
      }, 5000); // 5 second timeout

      // Listen for process termination
      const onClose = () => {
        clearTimeout(forceKillTimeout);
        metadata.status = ProcessStatus.CANCELLED;
        metadata.endTime = Date.now();
        this.emit('process-cancelled', metadata);
        resolve(true);
      };

      process.once('close', onClose);
      process.once('error', () => {
        clearTimeout(forceKillTimeout);
        resolve(false);
      });

      // Send the termination signal
      try {
        process.kill(signal);
      } catch (_error) {
        clearTimeout(forceKillTimeout);
        resolve(false);
      }
    });
  }
}

/**
 * Global process manager instance
 */
let globalProcessManager: ProcessManager | null = null;

/**
 * Get or create the global process manager
 */
export function getProcessManager(): ProcessManager {
  if (!globalProcessManager) {
    globalProcessManager = new ProcessManager();

    // Set up cleanup on process exit
    const cleanup = () => {
      if (globalProcessManager) {
        globalProcessManager.cancelAllProcesses('SIGTERM').catch(() => {
          // Ignore cleanup errors
        });
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGUSR1', cleanup);
    process.on('SIGUSR2', cleanup);
    process.on('uncaughtException', cleanup);
    process.on('unhandledRejection', cleanup);
  }

  return globalProcessManager;
}

/**
 * Process resource monitor for tracking memory and CPU usage
 */
export class ProcessResourceMonitor {
  private monitors = new Map<string, NodeJS.Timer>();

  /**
   * Start monitoring a process
   */
  startMonitoring(
    process: ChildProcess,
    metadata: ProcessMetadata,
    callback: (resources: ProcessResources) => void
  ): void {
    if (!process.pid || this.monitors.has(metadata.id)) {
      return;
    }

    const monitor = setInterval(() => {
      if (!process.pid || process.killed) {
        this.stopMonitoring(metadata.id);
        return;
      }

      try {
        const resources = this.getProcessResources(process.pid);
        callback(resources);
      } catch (_error) {
        // Process might have terminated, stop monitoring
        this.stopMonitoring(metadata.id);
      }
    }, 1000); // Check every second

    this.monitors.set(metadata.id, monitor);
  }

  /**
   * Stop monitoring a process
   */
  stopMonitoring(processId: string): void {
    const monitor = this.monitors.get(processId);
    if (monitor) {
      clearInterval(monitor);
      this.monitors.delete(processId);
    }
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const [processId] of this.monitors) {
      this.stopMonitoring(processId);
    }
  }

  /**
   * Get current resource usage for a process (simplified implementation)
   */
  private getProcessResources(pid: number): ProcessResources {
    // This is a simplified implementation
    // In a real implementation, you might use process monitoring libraries
    // or system calls to get actual resource usage
    return {
      pid,
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
      },
      cpuUsage: {
        user: 0,
        system: 0,
      },
      timestamp: Date.now(),
    };
  }
}

/**
 * Process resource usage information
 */
export interface ProcessResources {
  pid: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  timestamp: number;
}

/**
 * Process execution context with lifecycle management
 */
export class ProcessExecutionContext {
  private readonly processManager: ProcessManager;
  private readonly resourceMonitor: ProcessResourceMonitor;
  private metadata?: ProcessMetadata;

  constructor() {
    this.processManager = getProcessManager();
    this.resourceMonitor = new ProcessResourceMonitor();
  }

  /**
   * Execute a process with full lifecycle management
   */
  async execute(
    processFactory: () => ChildProcess,
    command: string,
    options: {
      timeout?: number;
      monitorResources?: boolean;
      onOutput?: (data: string) => void;
      onError?: (data: string) => void;
    } = {}
  ): Promise<ProcessMetadata> {
    const process = processFactory();
    this.metadata = this.processManager.registerProcess(process, command);

    // Set up event listeners
    if (options.onOutput) {
      this.processManager.on('output-data', (data, meta) => {
        if (meta.id === this.metadata?.id) {
          options.onOutput?.(data);
        }
      });
    }

    if (options.onError) {
      this.processManager.on('error-data', (data, meta) => {
        if (meta.id === this.metadata?.id) {
          options.onError?.(data);
        }
      });
    }

    // Start resource monitoring if requested
    if (options.monitorResources) {
      this.resourceMonitor.startMonitoring(
        process,
        this.metadata,
        (_resources) => {
          // Could emit resource events or store metrics
        }
      );
    }

    // Set up timeout if specified
    if (options.timeout) {
      setTimeout(() => {
        if (this.metadata?.status === ProcessStatus.RUNNING) {
          this.cancel('SIGTERM');
        }
      }, options.timeout);
    }

    return this.metadata;
  }

  /**
   * Cancel the current process execution
   */
  async cancel(signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    if (!this.metadata) {
      return false;
    }

    this.resourceMonitor.stopMonitoring(this.metadata.id);
    return this.processManager.cancelProcess(this.metadata.id, signal);
  }

  /**
   * Get current process metadata
   */
  getMetadata(): ProcessMetadata | undefined {
    return this.metadata;
  }

  /**
   * Wait for process completion
   */
  async waitForCompletion(): Promise<ProcessMetadata> {
    if (!this.metadata) {
      throw new Error('No process is currently executing');
    }

    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (!this.metadata) {
          reject(new Error('Process metadata lost'));
          return;
        }

        if (
          this.metadata.status === ProcessStatus.COMPLETED ||
          this.metadata.status === ProcessStatus.FAILED ||
          this.metadata.status === ProcessStatus.TIMEOUT ||
          this.metadata.status === ProcessStatus.CANCELLED
        ) {
          resolve(this.metadata);
        } else {
          // Check again in 100ms
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.metadata) {
      this.resourceMonitor.stopMonitoring(this.metadata.id);
    }
  }
}
