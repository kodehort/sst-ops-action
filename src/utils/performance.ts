/**
 * Performance Monitoring Utilities
 *
 * Provides lightweight performance monitoring and timing utilities for
 * tracking operation execution times and resource usage.
 *
 * These utilities help identify performance bottlenecks and optimize
 * critical code paths.
 */

import * as core from '@actions/core';

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  /** Name of the measured operation */
  name: string;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds (if completed) */
  endTime?: number;
  /** Duration in milliseconds */
  duration: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Simple performance timer for measuring operation duration
 *
 * @example
 * ```typescript
 * const timer = new PerformanceTimer('parse-output');
 * // ... do work ...
 * const duration = timer.stop();
 * core.info(`Parsing took ${duration}ms`);
 * ```
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = Date.now();
  }

  /**
   * Stop the timer and return the duration
   * @returns Duration in milliseconds
   */
  stop(): number {
    this.endTime = Date.now();
    return this.getDuration();
  }

  /**
   * Get the current duration (even if not stopped)
   * @returns Duration in milliseconds
   */
  getDuration(): number {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * Get a formatted duration string
   * @returns Formatted duration (e.g., "1.23s" or "456ms")
   */
  getFormattedDuration(): string {
    const duration = this.getDuration();
    if (duration >= 1000) {
      return `${(duration / 1000).toFixed(2)}s`;
    }
    return `${duration.toFixed(0)}ms`;
  }

  /**
   * Get the full measurement result
   */
  getMeasurement(): PerformanceMeasurement {
    return {
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
    };
  }

  /**
   * Log the duration using GitHub Actions core
   * @param logFn Optional custom log function (defaults to core.info)
   */
  log(logFn: (message: string) => void = core.info): void {
    const duration = this.getFormattedDuration();
    logFn(`⏱️  ${this.name}: ${duration}`);
  }
}

/**
 * Performance tracker for collecting multiple measurements
 *
 * @example
 * ```typescript
 * const tracker = new PerformanceTracker();
 *
 * tracker.start('parse');
 * // ... parsing ...
 * tracker.stop('parse');
 *
 * tracker.start('validate');
 * // ... validation ...
 * tracker.stop('validate');
 *
 * tracker.logSummary();
 * ```
 */
export class PerformanceTracker {
  private measurements = new Map<string, PerformanceTimer>();
  private completed = new Map<string, PerformanceMeasurement>();

  /**
   * Start measuring an operation
   * @param name Operation name
   */
  start(name: string): void {
    if (this.measurements.has(name)) {
      core.warning(`Performance measurement '${name}' already started`);
      return;
    }
    this.measurements.set(name, new PerformanceTimer(name));
  }

  /**
   * Stop measuring an operation
   * @param name Operation name
   * @param metadata Optional metadata to attach
   * @returns Duration in milliseconds
   */
  stop(name: string, metadata?: Record<string, unknown>): number {
    const timer = this.measurements.get(name);
    if (!timer) {
      core.warning(`Performance measurement '${name}' was not started`);
      return 0;
    }

    const duration = timer.stop();
    const measurement = timer.getMeasurement();
    if (metadata) {
      measurement.metadata = metadata;
    }

    this.completed.set(name, measurement);
    this.measurements.delete(name);

    return duration;
  }

  /**
   * Measure an async function execution
   *
   * @example
   * ```typescript
   * const result = await tracker.measure('fetch-data', async () => {
   *   return await fetchData();
   * });
   * ```
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.stop(name, metadata);
      return result;
    } catch (error) {
      this.stop(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure a synchronous function execution
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    this.start(name);
    try {
      const result = fn();
      this.stop(name, metadata);
      return result;
    } catch (error) {
      this.stop(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Get all completed measurements
   */
  getMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.completed.values());
  }

  /**
   * Get total duration of all measurements
   */
  getTotalDuration(): number {
    return this.getMeasurements().reduce((sum, m) => sum + m.duration, 0);
  }

  /**
   * Get a specific measurement
   */
  getMeasurement(name: string): PerformanceMeasurement | undefined {
    return this.completed.get(name);
  }

  /**
   * Log a summary of all measurements
   */
  logSummary(): void {
    const measurements = this.getMeasurements();
    if (measurements.length === 0) {
      core.info('📊 No performance measurements recorded');
      return;
    }

    core.info('📊 Performance Summary:');

    // Sort by duration (longest first)
    const sorted = [...measurements].sort((a, b) => b.duration - a.duration);

    for (const measurement of sorted) {
      const duration =
        measurement.duration >= 1000
          ? `${(measurement.duration / 1000).toFixed(2)}s`
          : `${measurement.duration.toFixed(0)}ms`;

      const metadata = measurement.metadata
        ? ` (${JSON.stringify(measurement.metadata)})`
        : '';

      core.info(`  - ${measurement.name}: ${duration}${metadata}`);
    }

    const total = this.getTotalDuration();
    const totalFormatted =
      total >= 1000 ? `${(total / 1000).toFixed(2)}s` : `${total.toFixed(0)}ms`;

    core.info(`  Total: ${totalFormatted}`);
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
    this.completed.clear();
  }
}

/**
 * Global performance tracker instance
 * Can be used across the application for centralized performance monitoring
 */
export const globalPerformanceTracker = new PerformanceTracker();

/**
 * Decorator for measuring method execution time
 * Note: Experimental, requires decorator support
 *
 * @example
 * ```typescript
 * class MyClass {
 *   @measured('myMethod')
 *   async myMethod() {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function measured(name?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const measurementName = name || `${target?.constructor?.name}.${propertyKey}`;

    descriptor.value = async function (...args: unknown[]) {
      const timer = new PerformanceTimer(measurementName);
      try {
        const result = await originalMethod.apply(this, args);
        timer.stop();
        timer.log(core.debug); // Log at debug level to avoid noise
        return result;
      } catch (error) {
        timer.stop();
        timer.log(core.debug);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Simple utility to format bytes
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get memory usage information (if available)
 */
export function getMemoryUsage(): {
  heapUsed: string;
  heapTotal: string;
  external: string;
} | null {
  try {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: formatBytes(usage.heapUsed),
        heapTotal: formatBytes(usage.heapTotal),
        external: formatBytes(usage.external),
      };
    }
  } catch {
    // Not available in this environment
  }
  return null;
}

/**
 * Log memory usage
 */
export function logMemoryUsage(label = 'Memory'): void {
  const usage = getMemoryUsage();
  if (usage) {
    core.debug(
      `💾 ${label}: Heap ${usage.heapUsed}/${usage.heapTotal}, External ${usage.external}`
    );
  }
}
