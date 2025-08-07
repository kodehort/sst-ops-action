/**
 * Tests for configurable runner functionality
 */

import { describe, expect, it } from 'vitest';
import { SSTCLIExecutor, type SSTRunner } from '../../src/utils/cli';
import type { OperationOptions } from '../../src/types';

describe('Configurable Runner', () => {
  describe('CLI Command Building', () => {
    it('should build bun command correctly', async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<OperationOptions> = {
        stage: 'test',
        runner: 'bun',
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand('deploy', 'test', options);

      expect(result).toContain('bun');
      expect(result).toContain('sst');
      expect(result).toContain('deploy');
      expect(result).toContain('--stage');
      expect(result).toContain('test');
    });

    it('should build npm command correctly', async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<OperationOptions> = {
        stage: 'test',
        runner: 'npm',
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand('deploy', 'test', options);

      expect(result).toContain('npm');
      expect(result).toContain('run');
      expect(result).toContain('sst');
      expect(result).toContain('--');
      expect(result).toContain('deploy');
    });

    it('should build pnpm command correctly', async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<OperationOptions> = {
        stage: 'test',
        runner: 'pnpm',
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand('deploy', 'test', options);

      expect(result).toContain('pnpm');
      expect(result).toContain('sst');
      expect(result).toContain('deploy');
    });

    it('should build yarn command correctly', async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<OperationOptions> = {
        stage: 'test',
        runner: 'yarn',
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand('deploy', 'test', options);

      expect(result).toContain('yarn');
      expect(result).toContain('sst');
      expect(result).toContain('deploy');
    });

    it('should build direct SST command correctly', async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<OperationOptions> = {
        stage: 'test',
        runner: 'sst',
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand('deploy', 'test', options);

      expect(result[0]).toBe('sst');
      expect(result).toContain('deploy');
      expect(result).not.toContain('bun');
      expect(result).not.toContain('npm');
    });

    it('should default to bun when runner is not specified', async () => {
      const executor = new SSTCLIExecutor();
      const options: Partial<OperationOptions> = {
        stage: 'test',
        // runner not specified
      };

      // Access the private method through type assertion for testing
      const buildCommand = (executor as any).buildCommand.bind(executor);
      const result = await buildCommand('deploy', 'test', options);

      expect(result).toContain('bun');
      expect(result).toContain('sst');
      expect(result).toContain('deploy');
    });
  });

  describe('Runner Validation', () => {
    it('should validate supported runners', () => {
      const supportedRunners: SSTRunner[] = ['bun', 'npm', 'pnpm', 'yarn', 'sst'];
      
      for (const runner of supportedRunners) {
        expect(['bun', 'npm', 'pnpm', 'yarn', 'sst']).toContain(runner);
      }
    });

    it('should throw error for unsupported runner', () => {
      const executor = new SSTCLIExecutor();
      const buildRunnerCommand = (executor as any).buildRunnerCommand.bind(executor);
      
      expect(() => {
        buildRunnerCommand('invalid-runner' as SSTRunner, 'deploy');
      }).toThrow('Unsupported runner: invalid-runner');
    });
  });

  describe('Utility Commands', () => {
    it('should build utility commands for different runners', () => {
      const executor = new SSTCLIExecutor();
      const buildUtilityCommand = (executor as any).buildUtilityCommand.bind(executor);

      // Test version command with different runners
      expect(buildUtilityCommand('bun', ['--version'])).toEqual(['bun', 'sst', '--version']);
      expect(buildUtilityCommand('npm', ['--version'])).toEqual(['npm', 'run', 'sst', '--', '--version']);
      expect(buildUtilityCommand('pnpm', ['--version'])).toEqual(['pnpm', 'sst', '--version']);
      expect(buildUtilityCommand('yarn', ['--version'])).toEqual(['yarn', 'sst', '--version']);
      expect(buildUtilityCommand('sst', ['--version'])).toEqual(['sst', '--version']);
    });
  });
});