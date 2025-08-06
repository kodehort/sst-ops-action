import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

interface GitHubWorkflow {
  jobs: Record<string, unknown>;
  on: string[] | Record<string, unknown>;
}

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowJob {
  steps: WorkflowStep[];
}

interface ReleaseWorkflow extends GitHubWorkflow {
  on: {
    push: {
      tags: string[];
    };
  };
}

describe('CI/CD Workflows', () => {
  describe('CI Workflow', () => {
    it('should have valid YAML syntax', () => {
      const ciPath = join(__dirname, '../../.github/workflows/ci.yml');
      const ciContent = readFileSync(ciPath, 'utf8');

      expect(() => yaml.load(ciContent)).not.toThrow();
    });

    it('should include all required jobs', () => {
      const ciPath = join(__dirname, '../../.github/workflows/ci.yml');
      const ciContent = readFileSync(ciPath, 'utf8');
      const ciConfig = yaml.load(ciContent) as GitHubWorkflow;

      expect(ciConfig.jobs).toHaveProperty('test');
      expect(ciConfig.jobs).toHaveProperty('build');
    });

    it('should run on push and pull_request events', () => {
      const ciPath = join(__dirname, '../../.github/workflows/ci.yml');
      const ciContent = readFileSync(ciPath, 'utf8');
      const ciConfig = yaml.load(ciContent) as GitHubWorkflow;

      expect(ciConfig.on).toContain('push');
      expect(ciConfig.on).toContain('pull_request');
    });

    it('should include coverage reporting', () => {
      const ciPath = join(__dirname, '../../.github/workflows/ci.yml');
      const ciContent = readFileSync(ciPath, 'utf8');
      const ciConfig = yaml.load(ciContent) as GitHubWorkflow;

      const testJob = ciConfig.jobs.test as WorkflowJob;
      const steps = testJob.steps.map(
        (step: WorkflowStep) => step.name || step.run
      );

      expect(
        steps.some((step: string | undefined) => step?.includes('coverage'))
      ).toBe(true);
    });
  });

  describe('Build Workflow', () => {
    it('should exist and have valid YAML syntax', () => {
      const buildPath = join(__dirname, '../../.github/workflows/build.yml');

      expect(() => {
        const buildContent = readFileSync(buildPath, 'utf8');
        yaml.load(buildContent);
      }).not.toThrow();
    });

    it('should include bundle size validation', () => {
      const buildPath = join(__dirname, '../../.github/workflows/build.yml');
      const buildContent = readFileSync(buildPath, 'utf8');
      const buildConfig = yaml.load(buildContent) as GitHubWorkflow;

      const steps = JSON.stringify(buildConfig);
      expect(steps).toMatch(/bundle.*size/i);
    });
  });

  describe('Release Workflow', () => {
    it('should exist and have valid YAML syntax', () => {
      const releasePath = join(
        __dirname,
        '../../.github/workflows/release.yml'
      );

      expect(() => {
        const releaseContent = readFileSync(releasePath, 'utf8');
        yaml.load(releaseContent);
      }).not.toThrow();
    });

    it('should trigger on version tags', () => {
      const releasePath = join(
        __dirname,
        '../../.github/workflows/release.yml'
      );
      const releaseContent = readFileSync(releasePath, 'utf8');
      const releaseConfig = yaml.load(releaseContent) as ReleaseWorkflow;

      expect(releaseConfig.on.push.tags).toContain('v*');
    });

    it('should include quality gates before release', () => {
      const releasePath = join(
        __dirname,
        '../../.github/workflows/release.yml'
      );
      const releaseContent = readFileSync(releasePath, 'utf8');
      const releaseConfig = yaml.load(releaseContent) as GitHubWorkflow;

      const steps = JSON.stringify(releaseConfig);
      expect(steps).toMatch(/typecheck/);
      expect(steps).toMatch(/lint/);
      expect(steps).toMatch(/test/);
    });
  });
});
